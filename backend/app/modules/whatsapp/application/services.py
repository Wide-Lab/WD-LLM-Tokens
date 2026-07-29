from app.core.exceptions import ForbiddenError
from app.core.periodo import Intervalo
from app.db.uow import UnitOfWork
from app.modules.whatsapp.domain.entities import (
    Balde,
    Filtro,
    Grupo,
    Ingestao,
    NovaMensagem,
    Pagina,
)
from app.modules.whatsapp.infra.repository import RegistroMensagemRepository


class WhatsappService:
    def __init__(self, uow: UnitOfWork) -> None:
        self._mensagens = RegistroMensagemRepository(uow.session)

    async def ingerir(self, novas: list[NovaMensagem], aplicacao: str) -> list[Ingestao]:
        """Grava o lote e devolve um resultado por mensagem, **na mesma ordem**.

        A chave de escrita é a identidade de quem reporta, não do tipo de fato: a mesma que ingere
        evento de LLM ingere mensagem, e recusa com `403` a `aplicacao` que não é a dona dela.

        Tudo-ou-nada na transação do request, como no LLM — o retry reenvia o lote inteiro e a
        idempotência pelo `wamid` já cobre a repetição."""

        for nova in novas:
            if nova.aplicacao != aplicacao:
                raise ForbiddenError(
                    f"Esta chave só pode reportar mensagens da aplicação '{aplicacao}'."
                )

        return [await self._mensagens.inserir(nova) for nova in novas]

    async def metricas(
        self,
        filtro: Filtro,
        grupo: Grupo | None,
        intervalo: Intervalo | None,
    ) -> list[Balde]:
        return await self._mensagens.agregar(filtro, grupo, intervalo)

    async def listar(self, filtro: Filtro, limite: int, offset: int) -> Pagina:
        itens, total = await self._mensagens.listar(filtro, limite, offset)
        return Pagina(itens=itens, total=total, limite=limite, offset=offset)

    async def distintos(self, grupo: Grupo) -> list[str]:
        return await self._mensagens.distintos(grupo)
