from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.precos.domain.entities import (
    NovoPreco,
    NovoPrecoMensagem,
    PrecoMensagem,
    PrecoModelo,
)
from app.modules.precos.infra.repository import PrecoMensagemRepository, PrecoRepository


class PrecoService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._precos = PrecoRepository(session)

    async def listar(self, modelo: str | None = None) -> list[PrecoModelo]:
        return await self._precos.listar(modelo)

    async def criar(self, novo: NovoPreco) -> PrecoModelo:
        preco = await self._precos.criar(novo)
        await self._session.commit()
        return preco


class PrecoMensagemService:
    """O mesmo par de operações para a tarifa de mensagem.

    Serviço próprio, e não dois métodos a mais no `PrecoService`: são duas tabelas com chaves
    diferentes, e o que elas têm em comum já está no módulo — não numa classe."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._precos = PrecoMensagemRepository(session)

    async def listar(
        self, categoria: str | None = None, pais: str | None = None
    ) -> list[PrecoMensagem]:
        return await self._precos.listar(categoria, pais)

    async def criar(self, novo: NovoPrecoMensagem) -> PrecoMensagem:
        preco = await self._precos.criar(novo)
        await self._session.commit()
        return preco
