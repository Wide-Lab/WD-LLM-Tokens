from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.precos.domain.entities import NovoPreco, PrecoModelo
from app.modules.precos.infra.repository import PrecoRepository


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
