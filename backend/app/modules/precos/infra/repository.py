import uuid

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError
from app.modules.precos.domain.entities import (
    CategoriaMensagem,
    NovoPreco,
    NovoPrecoMensagem,
    PrecoMensagem,
    PrecoModelo,
)
from app.modules.precos.infra.models import PrecoMensagem as PrecoMensagemRow
from app.modules.precos.infra.models import PrecoModelo as PrecoModeloRow


def _para_dominio(linha: PrecoModeloRow) -> PrecoModelo:
    return PrecoModelo(
        id=linha.id,
        provedor=linha.provedor,
        modelo=linha.modelo,
        vigencia_inicio=linha.vigencia_inicio,
        moeda=linha.moeda,
        entrada_por_milhao=linha.entrada_por_milhao,
        saida_por_milhao=linha.saida_por_milhao,
        cache_leitura_por_milhao=linha.cache_leitura_por_milhao,
        cache_escrita_por_milhao=linha.cache_escrita_por_milhao,
    )


class PrecoRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def listar(self, modelo: str | None = None) -> list[PrecoModelo]:
        stmt = select(PrecoModeloRow).order_by(
            PrecoModeloRow.modelo,
            PrecoModeloRow.vigencia_inicio.desc(),
        )
        if modelo:
            stmt = stmt.where(PrecoModeloRow.modelo == modelo)

        return [_para_dominio(linha) for linha in (await self._session.scalars(stmt))]

    async def criar(self, novo: NovoPreco) -> PrecoModelo:
        """Grava um preço.

        Quem detecta a duplicata é o `UNIQUE (modelo, vigencia_inicio)`, e não um `SELECT` antes:
        entre a leitura e a escrita cabe outro cadastro."""

        linha = PrecoModeloRow(
            id=uuid.uuid7(),
            provedor=novo.provedor,
            modelo=novo.modelo,
            vigencia_inicio=novo.vigencia_inicio,
            moeda=novo.moeda,
            entrada_por_milhao=novo.entrada_por_milhao,
            saida_por_milhao=novo.saida_por_milhao,
            cache_leitura_por_milhao=novo.cache_leitura_por_milhao,
            cache_escrita_por_milhao=novo.cache_escrita_por_milhao,
        )
        self._session.add(linha)

        try:
            await self._session.flush()
        except IntegrityError as erro:
            raise ConflictError(
                f"Já existe preço para {novo.modelo} a partir de {novo.vigencia_inicio}."
            ) from erro

        return _para_dominio(linha)


def _mensagem_para_dominio(linha: PrecoMensagemRow) -> PrecoMensagem:
    return PrecoMensagem(
        id=linha.id,
        categoria=CategoriaMensagem(linha.categoria),
        pais=linha.pais,
        vigencia_inicio=linha.vigencia_inicio,
        moeda=linha.moeda,
        por_mensagem=linha.por_mensagem,
    )


class PrecoMensagemRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def listar(
        self, categoria: str | None = None, pais: str | None = None
    ) -> list[PrecoMensagem]:
        stmt = select(PrecoMensagemRow).order_by(
            PrecoMensagemRow.categoria,
            PrecoMensagemRow.pais,
            PrecoMensagemRow.vigencia_inicio.desc(),
        )
        if categoria:
            stmt = stmt.where(PrecoMensagemRow.categoria == categoria)
        if pais:
            stmt = stmt.where(PrecoMensagemRow.pais == pais.strip().upper())

        return [_mensagem_para_dominio(linha) for linha in (await self._session.scalars(stmt))]

    async def criar(self, novo: NovoPrecoMensagem) -> PrecoMensagem:
        """Grava uma tarifa de mensagem.

        Como no de modelo, quem detecta a duplicata é o `UNIQUE (categoria, pais,
        vigencia_inicio)`: entre um `SELECT` de conferência e a escrita cabe outro cadastro."""

        linha = PrecoMensagemRow(
            id=uuid.uuid7(),
            categoria=novo.categoria,
            pais=novo.pais,
            vigencia_inicio=novo.vigencia_inicio,
            moeda=novo.moeda,
            por_mensagem=novo.por_mensagem,
        )
        self._session.add(linha)

        try:
            await self._session.flush()
        except IntegrityError as erro:
            raise ConflictError(
                f"Já existe preço de {novo.categoria} em {novo.pais} "
                f"a partir de {novo.vigencia_inicio}."
            ) from erro

        return _mensagem_para_dominio(linha)
