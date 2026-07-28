"""O repositório de `registro_mensagem`: ingestão idempotente, listagem crua e agregação.

Espelha o de `registro_llm` na estrutura e discorda dele em tudo que é específico — que é o ponto
de serem dois módulos. Importa `precos/infra/custo_mensagem.py` pelo mesmo motivo que o do LLM
importa `custo.py`: a fórmula do dinheiro vive num lugar só, e é usada tanto na listagem quanto
na agregação."""

import uuid
from typing import Any

from sqlalchemy import Select, func, literal, select, true
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import InstrumentedAttribute
from sqlalchemy.sql import ColumnElement

from app.core.exceptions import ConflictError
from app.core.periodo import Intervalo, janela, truncar
from app.modules.precos.infra.custo_mensagem import (
    MOEDA_PADRAO,
    PrecoMensagemVigente,
    preco_vigente_de_mensagem,
)
from app.modules.whatsapp.domain.entities import (
    SEM_CATEGORIA,
    Balde,
    Categoria,
    Direcao,
    Filtro,
    Grupo,
    Ingestao,
    NovaMensagem,
    RegistroMensagem,
)
from app.modules.whatsapp.infra.models import RegistroMensagem as RegistroMensagemRow

_COLUNA_GRUPO: dict[Grupo, ColumnElement[str] | InstrumentedAttribute[str]] = {
    # `categoria` é a única nulável das cinco, e é por isso que ela é a única que não é a coluna
    # crua: o `coalesce` mantém `grupo` ausente na resposta significando uma coisa só ("não foi
    # pedido agrupamento"). Sem ele, o balde das recebidas sairia `null` no meio de uma lista de
    # totais por categoria.
    Grupo.CATEGORIA: func.coalesce(RegistroMensagemRow.categoria, literal(SEM_CATEGORIA)),
    Grupo.ATOR: RegistroMensagemRow.ator,
    Grupo.APLICACAO: RegistroMensagemRow.aplicacao,
    Grupo.PAIS: RegistroMensagemRow.pais,
    Grupo.DIRECAO: RegistroMensagemRow.direcao,
}
"""O mapa fechado é o que impede um `grupo` vindo da query string de virar coluna arbitrária."""


class RegistroMensagemRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def inserir(self, nova: NovaMensagem) -> Ingestao:
        """Grava uma mensagem, ou reconhece que ela já estava lá.

        `ON CONFLICT DO NOTHING` sobre `(aplicacao, id_externo)`, como no LLM. Aqui a
        idempotência trabalha mais: o webhook manda `sent`, `delivered` e `read` para o mesmo
        `wamid`, e quem reporta pode repassar os três sem se preocupar — o segundo e o terceiro
        voltam `duplicado: true`."""

        valores: dict[str, Any] = {
            "id": uuid.uuid4(),
            "aplicacao": nova.aplicacao,
            "ator": nova.ator,
            "direcao": nova.direcao.value,
            "categoria": nova.categoria.value if nova.categoria is not None else None,
            "pais": nova.pais,
            "cobravel": nova.cobravel,
            "id_externo": nova.id_externo,
            "conteudo": nova.conteudo,
            "metadados": nova.metadados,
        }
        # Omitido quando não vem, para o `server_default` do banco (`now()`) valer.
        if nova.criado_em is not None:
            valores["criado_em"] = nova.criado_em

        stmt = (
            pg_insert(RegistroMensagemRow)
            .values(**valores)
            .on_conflict_do_nothing(
                index_elements=["aplicacao", "id_externo"],
                index_where=RegistroMensagemRow.id_externo.is_not(None),
            )
            .returning(RegistroMensagemRow.id)
        )

        inserido = await self._session.scalar(stmt)
        if inserido is not None:
            return Ingestao(id=inserido, duplicado=False)

        # Não inseriu: já existia. Devolve o `id` da linha original, e não o sorteado agora —
        # quem reenviou precisa poder correlacionar com o primeiro envio.
        existente = await self._session.scalar(
            select(RegistroMensagemRow.id).where(
                RegistroMensagemRow.aplicacao == nova.aplicacao,
                RegistroMensagemRow.id_externo == nova.id_externo,
            )
        )
        if existente is None:
            raise ConflictError("O banco recusou a mensagem e não há original correspondente.")

        return Ingestao(id=existente, duplicado=True)

    async def listar(
        self, filtro: Filtro, limite: int, offset: int
    ) -> tuple[list[RegistroMensagem], int]:
        preco = self._preco()

        stmt = self._filtrar(
            select(
                RegistroMensagemRow.id,
                RegistroMensagemRow.criado_em,
                RegistroMensagemRow.aplicacao,
                RegistroMensagemRow.ator,
                RegistroMensagemRow.direcao,
                RegistroMensagemRow.categoria,
                RegistroMensagemRow.pais,
                RegistroMensagemRow.cobravel,
                RegistroMensagemRow.id_externo,
                RegistroMensagemRow.conteudo,
                RegistroMensagemRow.metadados,
                preco.custo(cobravel=RegistroMensagemRow.cobravel).label("custo"),
                func.coalesce(preco.moeda, literal(MOEDA_PADRAO)).label("moeda"),
            )
            .select_from(RegistroMensagemRow)
            .outerjoin(preco.lateral, true()),
            filtro,
        )

        linhas = (
            await self._session.execute(
                stmt.order_by(RegistroMensagemRow.criado_em.desc()).limit(limite).offset(offset)
            )
        ).all()

        total = await self._session.scalar(
            self._filtrar(select(func.count()).select_from(RegistroMensagemRow), filtro)
        )

        itens = [
            RegistroMensagem(
                id=linha.id,
                criado_em=linha.criado_em,
                aplicacao=linha.aplicacao,
                ator=linha.ator,
                direcao=Direcao(linha.direcao),
                categoria=Categoria(linha.categoria) if linha.categoria is not None else None,
                pais=linha.pais,
                cobravel=linha.cobravel,
                custo=linha.custo,
                moeda=linha.moeda,
                id_externo=linha.id_externo,
                conteudo=linha.conteudo,
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
        """As mesmas quatro combinações de `grupo` × `intervalo` do LLM, numa consulta só."""

        preco = self._preco()

        chaves: list[ColumnElement[Any]] = []
        if grupo is not None:
            chaves.append(_COLUNA_GRUPO[grupo].label("grupo"))
        if intervalo is not None:
            chaves.append(truncar(intervalo, RegistroMensagemRow.criado_em).label("periodo"))

        stmt = self._filtrar(
            select(
                *chaves,
                func.count().label("mensagens"),
                # `FILTER (WHERE cobravel)` na mesma varredura: "quantas das N foram pagas" é a
                # conta que o painel mais mostra, e uma segunda consulta para ela seria dobrar o
                # trabalho para responder metade da mesma pergunta.
                func.count().filter(RegistroMensagemRow.cobravel).label("cobraveis"),
                # `SUM` ignora `NULL`: as não-cobráveis entram com `0` e não zeram o total, as
                # cobráveis sem preço cadastrado não entram, e o balde só sai `NULL` quando
                # nenhuma linha dele soube dizer quanto custou.
                func.sum(preco.custo(cobravel=RegistroMensagemRow.cobravel)).label("custo"),
                func.coalesce(func.max(preco.moeda), literal(MOEDA_PADRAO)).label("moeda"),
            )
            .select_from(RegistroMensagemRow)
            .outerjoin(preco.lateral, true()),
            filtro,
        )

        if chaves:
            stmt = stmt.group_by(*chaves).order_by(*chaves)

        return [
            Balde(
                mensagens=linha.mensagens,
                cobraveis=linha.cobraveis,
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
    def _preco() -> PrecoMensagemVigente:
        return preco_vigente_de_mensagem(
            RegistroMensagemRow.categoria,
            RegistroMensagemRow.pais,
            RegistroMensagemRow.criado_em,
        )

    @staticmethod
    def _filtrar(stmt: Select[Any], filtro: Filtro) -> Select[Any]:
        """Os mesmos filtros na listagem, na contagem e na agregação.

        O recorte de período vem de `app.core.periodo.janela`, o mesmo do LLM: `ate` é o dia
        inteiro. Os outros cinco são deste módulo — é por isso que o `Filtro` não subiu junto."""

        stmt = stmt.where(*janela(RegistroMensagemRow.criado_em, filtro.de, filtro.ate))

        if filtro.aplicacao:
            stmt = stmt.where(RegistroMensagemRow.aplicacao == filtro.aplicacao)
        if filtro.ator:
            stmt = stmt.where(RegistroMensagemRow.ator == filtro.ator)
        if filtro.categoria:
            stmt = stmt.where(RegistroMensagemRow.categoria == filtro.categoria.value)
        if filtro.pais:
            stmt = stmt.where(RegistroMensagemRow.pais == filtro.pais.strip().upper())
        if filtro.direcao:
            stmt = stmt.where(RegistroMensagemRow.direcao == filtro.direcao.value)
        return stmt
