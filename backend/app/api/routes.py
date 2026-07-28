from fastapi import APIRouter

from app.modules.acesso.api.routes import router as acesso_router
from app.modules.precos.api.routes import router as precos_router
from app.modules.uso.api.routes import router as uso_router


def montar_rotas(api: APIRouter) -> None:
    """Pendura os módulos no router `/v1`. Um módulo novo é uma linha aqui."""

    api.include_router(acesso_router)
    api.include_router(uso_router)
    api.include_router(precos_router)
