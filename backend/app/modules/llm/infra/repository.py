"""O repositório de `registro_llm`: ingestão idempotente, listagem crua e agregação.

Importa `precos` pela expressão de custo — a alternativa era repetir a fórmula do dinheiro na
listagem e na agregação, ver o docstring de `precos/infra/custo.py`. Quem liga essa fórmula às
colunas daqui é o `custo_vigente` logo abaixo, e é ele que `projecao.py` também usa: o custo do
consolidado é o mesmo desta listagem, por construção."""

import uuid
from typing import Any

from sqlalchemy import Select, func, literal, select, true
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import InstrumentedAttribute
from sqlalchemy.sql import ColumnElement

from app.core.exceptions import ConflictError
from app.core.periodo import Intervalo, janela, truncar
from app.modules.llm.domain.entities import (
    Balde,
    Filtro,
    Grupo,
    Ingestao,
    NovoRegistro,
    RegistroLlm,
)
from app.modules.llm.infra.models import RegistroLlm as RegistroLlmRow
from app.modules.precos.infra.custo import MOEDA_PADRAO, PrecoVigente, preco_vigente_para

_COLUNA_GRUPO: dict[Grupo, InstrumentedAttribute[str]] = {
    Grupo.MODELO: RegistroLlmRow.modelo,
    Grupo.ATOR: RegistroLlmRow.ator,
    Grupo.APLICACAO: RegistroLlmRow.aplicacao,
}
"""O mapa fechado é o que impede um `grupo` vindo da query string de virar coluna arbitrária."""


def custo_vigente() -> tuple[PrecoVigente, ColumnElement[Any]]:
    """O preço válido em cada linha e a expressão do custo dela, ligados às colunas desta tabela.

    Os dois juntos porque saem do mesmo `LEFT JOIN LATERAL` e porque quem soma custo também
    precisa nomear a moeda (`preco.moeda`).

    Público e fora da classe porque `projecao.py` usa exatamente isto: a **fórmula** mora no
    `precos`, e **qual coluna entra em qual balde** mora aqui — uma vez só, valendo para a
    listagem, para a agregação e para o consolidado. Um balde de token novo se resolve nestes dois
    lugares, e não em três."""

    preco = preco_vigente_para(RegistroLlmRow.modelo, RegistroLlmRow.criado_em)
    return preco, preco.custo(
        entrada=RegistroLlmRow.tokens_entrada,
        saida=RegistroLlmRow.tokens_saida,
        cache_leitura=RegistroLlmRow.tokens_cache_leitura,
        cache_escrita=RegistroLlmRow.tokens_cache_escrita,
    )


class RegistroLlmRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def inserir(self, novo: NovoRegistro) -> Ingestao:
        """Grava um evento, ou reconhece que ele já estava lá.

        `ON CONFLICT DO NOTHING` sobre `(aplicacao, id_externo)`, e não um `SELECT` antes: entre
        a leitura e a escrita cabe o retry concorrente que a idempotência existe para absorver.
        Sem `id_externo` a linha não entra no índice parcial e sempre insere — quem não manda id
        do provedor abriu mão da idempotência, e isso é escolha de quem reporta."""

        valores: dict[str, Any] = {
            "id": uuid.uuid7(),
            "aplicacao": novo.aplicacao,
            "ator": novo.ator,
            "modelo": novo.modelo,
            "provedor": novo.provedor,
            "tokens_entrada": novo.tokens_entrada,
            "tokens_saida": novo.tokens_saida,
            "tokens_cache_leitura": novo.tokens_cache_leitura,
            "tokens_cache_escrita": novo.tokens_cache_escrita,
            "id_externo": novo.id_externo,
            "mensagem": novo.mensagem,
            "resposta": novo.resposta,
            "metadados": novo.metadados,
        }
        # Omitido quando o app não manda, para o `server_default` do banco (`now()`) valer.
        if novo.criado_em is not None:
            valores["criado_em"] = novo.criado_em

        stmt = (
            pg_insert(RegistroLlmRow)
            .values(**valores)
            .on_conflict_do_nothing(
                index_elements=["aplicacao", "id_externo"],
                index_where=RegistroLlmRow.id_externo.is_not(None),
            )
            .returning(RegistroLlmRow.id)
        )

        inserido = await self._session.scalar(stmt)
        if inserido is not None:
            return Ingestao(id=inserido, duplicado=False)

        # Não inseriu: já existia. Devolve o `id` da linha original, e não o que foi sorteado
        # agora — quem fez o retry precisa poder correlacionar com o primeiro envio.
        existente = await self._session.scalar(
            select(RegistroLlmRow.id).where(
                RegistroLlmRow.aplicacao == novo.aplicacao,
                RegistroLlmRow.id_externo == novo.id_externo,
            )
        )
        if existente is None:
            raise ConflictError("O banco recusou o evento e não há original correspondente.")

        return Ingestao(id=existente, duplicado=True)

    async def listar(
        self, filtro: Filtro, limite: int, offset: int
    ) -> tuple[list[RegistroLlm], int]:
        preco, custo = custo_vigente()

        stmt = self._filtrar(
            select(
                RegistroLlmRow.id,
                RegistroLlmRow.criado_em,
                RegistroLlmRow.aplicacao,
                RegistroLlmRow.ator,
                RegistroLlmRow.modelo,
                RegistroLlmRow.provedor,
                RegistroLlmRow.tokens_entrada,
                RegistroLlmRow.tokens_saida,
                RegistroLlmRow.tokens_cache_leitura,
                RegistroLlmRow.tokens_cache_escrita,
                RegistroLlmRow.id_externo,
                RegistroLlmRow.mensagem,
                RegistroLlmRow.resposta,
                RegistroLlmRow.metadados,
                custo.label("custo"),
                func.coalesce(preco.moeda, literal(MOEDA_PADRAO)).label("moeda"),
            )
            .select_from(RegistroLlmRow)
            .outerjoin(preco.lateral, true()),
            filtro,
        )

        linhas = (
            await self._session.execute(
                stmt.order_by(RegistroLlmRow.criado_em.desc()).limit(limite).offset(offset)
            )
        ).all()

        total = await self._session.scalar(
            self._filtrar(select(func.count()).select_from(RegistroLlmRow), filtro)
        )

        itens = [
            RegistroLlm(
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
                mensagem=linha.mensagem,
                resposta=linha.resposta,
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

        preco, custo = custo_vigente()

        chaves: list[ColumnElement[Any]] = []
        if grupo is not None:
            chaves.append(_COLUNA_GRUPO[grupo].label("grupo"))
        if intervalo is not None:
            chaves.append(truncar(intervalo, RegistroLlmRow.criado_em).label("periodo"))

        stmt = self._filtrar(
            select(
                *chaves,
                func.count().label("requisicoes"),
                *(
                    func.coalesce(func.sum(coluna), 0).label(coluna.key)
                    for coluna in (
                        RegistroLlmRow.tokens_entrada,
                        RegistroLlmRow.tokens_saida,
                        RegistroLlmRow.tokens_cache_leitura,
                        RegistroLlmRow.tokens_cache_escrita,
                    )
                ),
                # `SUM` ignora `NULL`, então o balde soma o custo dos eventos que **têm** preço e
                # sai `NULL` só quando nenhum tem. É o comportamento que o painel quer: os tokens
                # aparecem desde sempre, o custo aparece quando o preço entra.
                func.sum(custo).label("custo"),
                func.coalesce(func.max(preco.moeda), literal(MOEDA_PADRAO)).label("moeda"),
            )
            .select_from(RegistroLlmRow)
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
    def _filtrar(stmt: Select[Any], filtro: Filtro) -> Select[Any]:
        """Os mesmos filtros na listagem, na contagem e na agregação.

        O recorte de período vem de `app.core.periodo.janela` — `ate` é o dia inteiro, e a regra
        é a mesma no WhatsApp de propósito."""

        stmt = stmt.where(*janela(RegistroLlmRow.criado_em, filtro.de, filtro.ate))

        if filtro.aplicacao:
            stmt = stmt.where(RegistroLlmRow.aplicacao == filtro.aplicacao)
        if filtro.ator:
            stmt = stmt.where(RegistroLlmRow.ator == filtro.ator)
        if filtro.modelo:
            stmt = stmt.where(RegistroLlmRow.modelo == filtro.modelo)
        return stmt
