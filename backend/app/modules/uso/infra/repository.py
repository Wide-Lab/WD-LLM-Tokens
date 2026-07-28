"""O repositório de `registro_uso`: ingestão idempotente, listagem crua e agregação.

É o único arquivo que importa outro módulo (`precos`, pela expressão de custo). A alternativa
era repetir a fórmula do dinheiro na listagem e na agregação — ver o docstring de
`precos/infra/custo.py`."""

import uuid
from datetime import UTC, date, datetime, time, timedelta
from typing import Any

from sqlalchemy import Date, Select, cast, func, literal, select, true
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import InstrumentedAttribute
from sqlalchemy.sql import ColumnElement

from app.core.exceptions import ConflictError
from app.modules.precos.infra.custo import MOEDA_PADRAO, PrecoVigente, preco_vigente_para
from app.modules.uso.domain.entities import (
    Balde,
    Filtro,
    Grupo,
    Ingestao,
    Intervalo,
    NovoRegistro,
    RegistroUso,
)
from app.modules.uso.infra.models import RegistroUso as RegistroUsoRow

_UNIDADE = {Intervalo.DIA: "day", Intervalo.SEMANA: "week", Intervalo.MES: "month"}
"""`Intervalo` → argumento do `date_trunc`. O enum não guarda o termo SQL porque `dia`/`semana`/
`mes` é o vocabulário do contrato público, e `day`/`week`/`month` é detalhe do Postgres."""

_COLUNA_GRUPO: dict[Grupo, InstrumentedAttribute[str]] = {
    Grupo.MODELO: RegistroUsoRow.modelo,
    Grupo.ATOR: RegistroUsoRow.ator,
    Grupo.APLICACAO: RegistroUsoRow.aplicacao,
}
"""O mapa fechado é o que impede um `grupo` vindo da query string de virar coluna arbitrária."""


def _meia_noite(dia: date) -> datetime:
    return datetime.combine(dia, time.min, tzinfo=UTC)


class RegistroUsoRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def inserir(self, novo: NovoRegistro) -> Ingestao:
        """Grava um evento, ou reconhece que ele já estava lá.

        `ON CONFLICT DO NOTHING` sobre `(aplicacao, id_externo)`, e não um `SELECT` antes: entre
        a leitura e a escrita cabe o retry concorrente que a idempotência existe para absorver.
        Sem `id_externo` a linha não entra no índice parcial e sempre insere — quem não manda id
        do provedor abriu mão da idempotência, e isso é escolha de quem reporta."""

        valores: dict[str, Any] = {
            "id": uuid.uuid4(),
            "aplicacao": novo.aplicacao,
            "ator": novo.ator,
            "modelo": novo.modelo,
            "provedor": novo.provedor,
            "tokens_entrada": novo.tokens_entrada,
            "tokens_saida": novo.tokens_saida,
            "tokens_cache_leitura": novo.tokens_cache_leitura,
            "tokens_cache_escrita": novo.tokens_cache_escrita,
            "id_externo": novo.id_externo,
            "metadados": novo.metadados,
        }
        # Omitido quando o app não manda, para o `server_default` do banco (`now()`) valer.
        if novo.criado_em is not None:
            valores["criado_em"] = novo.criado_em

        stmt = (
            pg_insert(RegistroUsoRow)
            .values(**valores)
            .on_conflict_do_nothing(
                index_elements=["aplicacao", "id_externo"],
                index_where=RegistroUsoRow.id_externo.is_not(None),
            )
            .returning(RegistroUsoRow.id)
        )

        inserido = await self._session.scalar(stmt)
        if inserido is not None:
            return Ingestao(id=inserido, duplicado=False)

        # Não inseriu: já existia. Devolve o `id` da linha original, e não o que foi sorteado
        # agora — quem fez o retry precisa poder correlacionar com o primeiro envio.
        existente = await self._session.scalar(
            select(RegistroUsoRow.id).where(
                RegistroUsoRow.aplicacao == novo.aplicacao,
                RegistroUsoRow.id_externo == novo.id_externo,
            )
        )
        if existente is None:
            raise ConflictError("O banco recusou o evento e não há original correspondente.")

        return Ingestao(id=existente, duplicado=True)

    async def listar(
        self, filtro: Filtro, limite: int, offset: int
    ) -> tuple[list[RegistroUso], int]:
        preco = preco_vigente_para(RegistroUsoRow.modelo, RegistroUsoRow.criado_em)

        stmt = self._filtrar(
            select(
                RegistroUsoRow.id,
                RegistroUsoRow.criado_em,
                RegistroUsoRow.aplicacao,
                RegistroUsoRow.ator,
                RegistroUsoRow.modelo,
                RegistroUsoRow.provedor,
                RegistroUsoRow.tokens_entrada,
                RegistroUsoRow.tokens_saida,
                RegistroUsoRow.tokens_cache_leitura,
                RegistroUsoRow.tokens_cache_escrita,
                RegistroUsoRow.id_externo,
                RegistroUsoRow.metadados,
                self._custo(preco).label("custo"),
                func.coalesce(preco.moeda, literal(MOEDA_PADRAO)).label("moeda"),
            )
            .select_from(RegistroUsoRow)
            .outerjoin(preco.lateral, true()),
            filtro,
        )

        linhas = (
            await self._session.execute(
                stmt.order_by(RegistroUsoRow.criado_em.desc()).limit(limite).offset(offset)
            )
        ).all()

        total = await self._session.scalar(
            self._filtrar(select(func.count()).select_from(RegistroUsoRow), filtro)
        )

        itens = [
            RegistroUso(
                id=linha.id,
                criado_em=linha.criado_em,
                aplicacao=linha.aplicacao,
                ator=linha.ator,
                modelo=linha.modelo,
                provedor=linha.provedor,
                tokens_entrada=linha.tokens_entrada,
                tokens_saida=linha.tokens_saida,
                tokens_cache_leitura=linha.tokens_cache_leitura,
                tokens_cache_escrita=linha.tokens_cache_escrita,
                custo=linha.custo,
                moeda=linha.moeda,
                id_externo=linha.id_externo,
                metadados=linha.metadados,
            )
            for linha in linhas
        ]
        return itens, total or 0

    async def agregar(
        self,
        filtro: Filtro,
        grupo: Grupo | None,
        intervalo: Intervalo | None,
    ) -> list[Balde]:
        """Os quatro modos do painel numa consulta só.

        `grupo` e `intervalo` são independentes e opcionais: ambos → série temporal por dimensão;
        só `grupo` → total por dimensão; só `intervalo` → série geral; nenhum → os cards de KPI.

        Com ~50 req/dia, isto roda em tempo de consulta sem rollup nem cache. O dia em que não
        rodar mais é o dia de materializar — e não antes."""

        preco = preco_vigente_para(RegistroUsoRow.modelo, RegistroUsoRow.criado_em)

        chaves: list[ColumnElement[Any]] = []
        if grupo is not None:
            chaves.append(_COLUNA_GRUPO[grupo].label("grupo"))
        if intervalo is not None:
            chaves.append(
                cast(
                    func.date_trunc(_UNIDADE[intervalo], RegistroUsoRow.criado_em),
                    Date,
                ).label("periodo")
            )

        stmt = self._filtrar(
            select(
                *chaves,
                func.count().label("requisicoes"),
                *(
                    func.coalesce(func.sum(coluna), 0).label(coluna.key)
                    for coluna in (
                        RegistroUsoRow.tokens_entrada,
                        RegistroUsoRow.tokens_saida,
                        RegistroUsoRow.tokens_cache_leitura,
                        RegistroUsoRow.tokens_cache_escrita,
                    )
                ),
                # `SUM` ignora `NULL`, então o balde soma o custo dos eventos que **têm** preço e
                # sai `NULL` só quando nenhum tem. É o comportamento que o painel quer: os tokens
                # aparecem desde sempre, o custo aparece quando o preço entra.
                func.sum(self._custo(preco)).label("custo"),
                func.coalesce(func.max(preco.moeda), literal(MOEDA_PADRAO)).label("moeda"),
            )
            .select_from(RegistroUsoRow)
            .outerjoin(preco.lateral, true()),
            filtro,
        )

        if chaves:
            stmt = stmt.group_by(*chaves).order_by(*chaves)

        return [
            Balde(
                requisicoes=linha.requisicoes,
                tokens_entrada=linha.tokens_entrada,
                tokens_saida=linha.tokens_saida,
                tokens_cache_leitura=linha.tokens_cache_leitura,
                tokens_cache_escrita=linha.tokens_cache_escrita,
                custo=linha.custo,
                moeda=linha.moeda,
                grupo=linha.grupo if grupo is not None else None,
                periodo=linha.periodo if intervalo is not None else None,
            )
            for linha in (await self._session.execute(stmt)).all()
        ]

    async def distintos(self, grupo: Grupo) -> list[str]:
        """Os valores já vistos numa dimensão — é o que popula os dropdowns de filtro."""

        coluna = _COLUNA_GRUPO[grupo]
        return list(await self._session.scalars(select(coluna).distinct().order_by(coluna)))

    @staticmethod
    def _custo(preco: PrecoVigente) -> ColumnElement[Any]:
        return preco.custo(
            entrada=RegistroUsoRow.tokens_entrada,
            saida=RegistroUsoRow.tokens_saida,
            cache_leitura=RegistroUsoRow.tokens_cache_leitura,
            cache_escrita=RegistroUsoRow.tokens_cache_escrita,
        )

    @staticmethod
    def _filtrar(stmt: Select[Any], filtro: Filtro) -> Select[Any]:
        """Os mesmos filtros na listagem, na contagem e na agregação.

        `ate` é **inclusive o dia inteiro**: o painel manda datas (`2026-07-23`), e um `<=` sobre
        a meia-noite cortaria fora quase todo o último dia do período."""

        if filtro.de is not None:
            stmt = stmt.where(RegistroUsoRow.criado_em >= _meia_noite(filtro.de))
        if filtro.ate is not None:
            stmt = stmt.where(
                RegistroUsoRow.criado_em < _meia_noite(filtro.ate + timedelta(days=1))
            )
        if filtro.aplicacao:
            stmt = stmt.where(RegistroUsoRow.aplicacao == filtro.aplicacao)
        if filtro.ator:
            stmt = stmt.where(RegistroUsoRow.ator == filtro.ator)
        if filtro.modelo:
            stmt = stmt.where(RegistroUsoRow.modelo == filtro.modelo)
        return stmt
