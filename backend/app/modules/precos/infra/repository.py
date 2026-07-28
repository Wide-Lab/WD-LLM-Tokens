import uuid

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError
from app.modules.precos.domain.entities import NovoPreco, PrecoModelo
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
            id=uuid.uuid4(),
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
