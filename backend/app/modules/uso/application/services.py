from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ForbiddenError
from app.modules.uso.domain.entities import (
    Balde,
    Filtro,
    Grupo,
    Ingestao,
    Intervalo,
    NovoRegistro,
    Pagina,
)
from app.modules.uso.infra.repository import RegistroUsoRepository


class UsoService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
        self._registros = RegistroUsoRepository(session)

    async def ingerir(self, novos: list[NovoRegistro], aplicacao: str) -> list[Ingestao]:
        """Grava o lote e devolve um resultado por evento, **na mesma ordem**.

        Um commit no fim, e não um por evento: o app dispara isto fire-and-forget depois de cada
        chamada ao LLM, e um lote que grava metade seria pior que um que não grava nada — o
        retry reenviaria o lote inteiro e a idempotência já cobre a repetição.

        Insere um a um em vez de um `INSERT ... VALUES (...), (...)`: com ~50 eventos por dia o
        ganho de um insert em lote é zero, e o `ON CONFLICT` por linha é o que permite dizer
        **qual** dos eventos era duplicado."""

        for novo in novos:
            if novo.aplicacao != aplicacao:
                raise ForbiddenError(
                    f"Esta chave só pode reportar eventos da aplicação '{aplicacao}'."
                )

        resultados = [await self._registros.inserir(novo) for novo in novos]
        await self._session.commit()
        return resultados

    async def metricas(
        self,
        filtro: Filtro,
        grupo: Grupo | None,
        intervalo: Intervalo | None,
    ) -> list[Balde]:
        return await self._registros.agregar(filtro, grupo, intervalo)

    async def listar(self, filtro: Filtro, limite: int, offset: int) -> Pagina:
        itens, total = await self._registros.listar(filtro, limite, offset)
        return Pagina(itens=itens, total=total, limite=limite, offset=offset)

    async def distintos(self, grupo: Grupo) -> list[str]:
        return await self._registros.distintos(grupo)
