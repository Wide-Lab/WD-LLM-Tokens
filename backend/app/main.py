from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import montar_rotas
from app.core.config import get_config
from app.core.exceptions import AppError
from app.core.logging import setup_logging
from app.db.session import dispose_engine


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    setup_logging(get_config().LOG_LEVEL)
    yield
    await dispose_engine()


def setup_middleware(app: FastAPI) -> None:
    """CORS para clientes de outra origem.

    Atrás do nginx de borda, painel e API compartilham origem e `CORS_ORIGINS` fica vazio — este
    middleware não faz nada, e é o caso normal. Ele existe para o consumidor externo eventual.

    `allow_credentials` é o que permite o cookie de sessão viajar numa chamada cross-origin; com
    ele ligado, o navegador **recusa** `allow_origins=["*"]`, então toda origem aqui é explícita.
    `DELETE` está na lista por causa do logout."""

    app.add_middleware(
        CORSMiddleware,
        allow_origins=get_config().CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["GET", "POST", "DELETE"],
        allow_headers=["X-API-Key", "Content-Type"],
    )


def setup_exception_handlers(app: FastAPI) -> None:
    """O formato de erro uniforme de `docs/api.md`: `{"erro": ..., "detalhe": ...}`.

    O handler do `RequestValidationError` está aqui pelo mesmo motivo: sem ele, o 422 do FastAPI
    sairia no formato dele (`{"detail": [...]}`) e o painel teria dois formatos de erro para
    tratar."""

    @app.exception_handler(AppError)
    async def _app_error(_: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={"erro": exc.message, "detalhe": exc.details},
        )

    @app.exception_handler(RequestValidationError)
    async def _validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content={
                "erro": "Payload inválido.",
                "detalhe": jsonable_encoder({"erros": exc.errors()}),
            },
        )


def create_app() -> FastAPI:
    app = FastAPI(
        title="Controle de Tokens",
        lifespan=lifespan,
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        openapi_url="/api/openapi.json",
    )

    setup_middleware(app)
    setup_exception_handlers(app)

    @app.get("/health", tags=["infra"])
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    api = APIRouter()
    montar_rotas(api)
    app.include_router(api, prefix="/api/v1")

    return app


app = create_app()
