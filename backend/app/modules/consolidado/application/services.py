from app.core.lancamento import FiltroComum
from app.core.periodo import Intervalo
from app.db.uow import UnitOfWork
from app.modules.consolidado.domain.entities import Balde, Grupo
from app.modules.consolidado.infra.repository import ConsolidadoRepository


class ConsolidadoService:
    """Só leitura: o consolidado não ingere nada.

    Fino de propósito — não há regra de negócio que caiba aqui e não caiba no `SELECT`. Existe
    para a rota continuar falando com um serviço, como as outras, e para o dia em que a soma
    precisar de algo que o banco não faz."""

    def __init__(self, uow: UnitOfWork) -> None:
        self._lancamentos = ConsolidadoRepository(uow.session)

    async def metricas(
        self,
        filtro: FiltroComum,
        grupo: Grupo | None,
        intervalo: Intervalo | None,
        por_origem: bool = False,
    ) -> list[Balde]:
        return await self._lancamentos.agregar(filtro, grupo, intervalo, por_origem)

    async def aplicacoes(self) -> list[str]:
        return await self._lancamentos.aplicacoes()
