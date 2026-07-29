from fastapi import APIRouter

from app.modules.acesso.api.routes import router as acesso_router
from app.modules.consolidado.api.routes import router as consolidado_router
from app.modules.llm.api.routes import router as llm_router
from app.modules.precos.api.routes import router as precos_router
from app.modules.whatsapp.api.routes import router as whatsapp_router


def montar_rotas(api: APIRouter) -> None:
    """Pendura os módulos no router `/v1`. Um módulo novo é uma linha aqui."""

    api.include_router(acesso_router)
    api.include_router(llm_router, prefix="/llm")
    # Os caminhos sem prefixo, de quando o LLM era a única origem de fato: há aplicação em
    # produção reportando para `POST /v1/eventos` e painel lendo `GET /v1/metricas`. Virar a
    # chave dos dois no mesmo dia é risco sem contrapartida — manter os dois vivos custa esta
    # linha. `include_in_schema=False` deixa o `/api/docs` com uma rota de cada: a lista dobrada
    # seria o tipo de ruído que faz ninguém mais ler a doc.
    api.include_router(llm_router, include_in_schema=False)
    # O WhatsApp nasce com prefixo e sem alias: não há legado a preservar aqui.
    api.include_router(whatsapp_router, prefix="/whatsapp")
    # Sem `prefix`: o consolidado leva `/v1/consolidado/metricas` e `/v1/aplicacoes`, que é caminho
    # de raiz porque a lista de aplicações é das duas origens. Os caminhos estão nos decoradores.
    api.include_router(consolidado_router)
    api.include_router(precos_router)
