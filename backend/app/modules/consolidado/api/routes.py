from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.api.dependencies import requer_leitura
from app.core.periodo import Intervalo
from app.db.uow import UowDep
from app.modules.consolidado.api.dependencies import FiltroDep
from app.modules.consolidado.api.schemas import MetricaOut
from app.modules.consolidado.application.services import ConsolidadoService
from app.modules.consolidado.domain.entities import Grupo

router = APIRouter(tags=["consolidado"])
"""Os caminhos vão inteiros no decorador, em vez de um `prefix` no `include_router`: as duas rotas
daqui não moram no mesmo lugar. As métricas são do consolidado (`/v1/consolidado/metricas`), mas
`/v1/aplicacoes` é caminho de raiz — é o que o painel sempre chamou, e o que mudou foi só quem
responde."""


@router.get("/consolidado/metricas", dependencies=[Depends(requer_leitura)])
async def metricas(
    uow: UowDep,
    filtro: FiltroDep,
    grupo: Annotated[Grupo | None, Query(description="Dimensão do agrupamento.")] = None,
    intervalo: Annotated[Intervalo | None, Query(description="Balde temporal.")] = None,
    por_origem: Annotated[bool, Query(description="Reparte cada balde entre as origens.")] = False,
) -> list[MetricaOut]:
    """O custo das duas origens somado no banco, numa consulta só.

    Somado aqui e não no browser: `custo: null` não pode virar zero ao encontrar um número, as
    moedas precisam concordar antes de somar e o período precisa recortar igual dos dois lados —
    três regras que já existem uma vez no backend.

    `por_origem` acrescenta `origem` ao balde sem gastar o `grupo`, que é o que permite perguntar
    "custo por aplicação **repartido** entre LLM e WhatsApp". `grupo=origem` continua respondendo a
    pergunta sem recorte, e é a forma certa quando origem é a pergunta inteira."""

    baldes = await ConsolidadoService(uow).metricas(filtro, grupo, intervalo, por_origem)
    return [
        MetricaOut(
            grupo=balde.grupo,
            periodo=balde.periodo,
            origem=balde.origem,
            lancamentos=balde.lancamentos,
            custo=float(balde.custo) if balde.custo is not None else None,
            moeda=balde.moeda,
        )
        for balde in baldes
    ]


@router.get("/aplicacoes", dependencies=[Depends(requer_leitura)])
async def listar_aplicacoes(uow: UowDep) -> list[str]:
    """Popula o dropdown de filtro: as aplicações que já reportaram alguma coisa.

    Mora aqui, e não no `llm`, porque a lista é das duas origens — uma aplicação que só reportou
    WhatsApp precisa aparecer. O caminho é o mesmo de sempre e `/v1/llm/aplicacoes` deixou de
    existir: manter os dois seria manter duas listas de aplicação divergindo em silêncio."""

    return await ConsolidadoService(uow).aplicacoes()
