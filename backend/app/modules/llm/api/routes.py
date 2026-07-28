from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from app.api.dependencies import AplicacaoDep, requer_leitura
from app.db.session import SessionDep
from app.modules.llm.api.dependencies import FiltroDep
from app.modules.llm.api.schemas import (
    EventoIn,
    EventoOut,
    EventosOut,
    IngestaoOut,
    MetricaOut,
)
from app.modules.llm.application.services import LlmService
from app.modules.llm.domain.entities import Grupo, Intervalo

router = APIRouter(tags=["llm"])


@router.post("/eventos", status_code=status.HTTP_201_CREATED)
async def ingerir_eventos(
    payload: EventoIn | list[EventoIn],
    aplicacao: AplicacaoDep,
    session: SessionDep,
) -> IngestaoOut | list[IngestaoOut]:
    """Ingestão. Aceita um objeto ou um array, e responde na mesma forma que recebeu.

    Idempotente por `(aplicacao, id_externo)`: reenviar devolve `duplicado: true` e o `id` da
    linha original, em vez de contar a mesma chamada duas vezes."""

    lote = payload if isinstance(payload, list) else [payload]
    resultados = await LlmService(session).ingerir(
        [evento.para_dominio() for evento in lote],
        aplicacao,
    )
    saida = [IngestaoOut(id=r.id, duplicado=r.duplicado) for r in resultados]

    return saida if isinstance(payload, list) else saida[0]


@router.get("/metricas", dependencies=[Depends(requer_leitura)])
async def metricas(
    session: SessionDep,
    filtro: FiltroDep,
    grupo: Annotated[Grupo | None, Query(description="Dimensão do agrupamento.")] = None,
    intervalo: Annotated[Intervalo | None, Query(description="Balde temporal.")] = None,
) -> list[MetricaOut]:
    """O coração do painel: as quatro combinações de `grupo` × `intervalo` cobrem os KPIs, a
    série temporal, o total por dimensão e a série por dimensão."""

    baldes = await LlmService(session).metricas(filtro, grupo, intervalo)
    return [
        MetricaOut(
            grupo=balde.grupo,
            periodo=balde.periodo,
            requisicoes=balde.requisicoes,
            tokens_entrada=balde.tokens_entrada,
            tokens_saida=balde.tokens_saida,
            tokens_cache_leitura=balde.tokens_cache_leitura,
            tokens_cache_escrita=balde.tokens_cache_escrita,
            custo=float(balde.custo) if balde.custo is not None else None,
            moeda=balde.moeda,
        )
        for balde in baldes
    ]


@router.get("/eventos", dependencies=[Depends(requer_leitura)])
async def listar_eventos(
    session: SessionDep,
    filtro: FiltroDep,
    limite: Annotated[int, Query(ge=1, le=500)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> EventosOut:
    """A lista crua, para auditoria."""

    pagina = await LlmService(session).listar(filtro, limite, offset)
    return EventosOut(
        total=pagina.total,
        limite=pagina.limite,
        offset=pagina.offset,
        itens=[EventoOut.model_validate(item) for item in pagina.itens],
    )


@router.get("/aplicacoes", dependencies=[Depends(requer_leitura)])
async def listar_aplicacoes(session: SessionDep) -> list[str]:
    """Popula o dropdown de filtro: as aplicações que já reportaram alguma coisa."""

    return await LlmService(session).distintos(Grupo.APLICACAO)


@router.get("/modelos", dependencies=[Depends(requer_leitura)])
async def listar_modelos(session: SessionDep) -> list[str]:
    return await LlmService(session).distintos(Grupo.MODELO)
