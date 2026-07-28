from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from app.api.dependencies import AplicacaoDep, requer_leitura
from app.core.periodo import Intervalo
from app.db.session import SessionDep
from app.modules.whatsapp.api.dependencies import FiltroDep
from app.modules.whatsapp.api.schemas import (
    IngestaoOut,
    MensagemIn,
    MensagemOut,
    MensagensOut,
    MetricaOut,
)
from app.modules.whatsapp.application.services import WhatsappService
from app.modules.whatsapp.domain.entities import Grupo

router = APIRouter(tags=["whatsapp"])


@router.post("/mensagens", status_code=status.HTTP_201_CREATED)
async def ingerir_mensagens(
    payload: MensagemIn | list[MensagemIn],
    aplicacao: AplicacaoDep,
    session: SessionDep,
) -> IngestaoOut | list[IngestaoOut]:
    """Ingestão. Aceita um objeto ou um array, e responde na mesma forma que recebeu.

    Autenticada pela **mesma** chave de escrita da aplicação: a chave é a identidade de quem
    reporta, não do tipo de fato.

    Idempotente por `(aplicacao, id_externo)`, com o `wamid` no `id_externo`: o webhook manda
    `sent`, `delivered` e `read` para o mesmo id, e mandar os três devolve `duplicado: true` no
    segundo e no terceiro em vez de contar a mensagem três vezes."""

    lote = payload if isinstance(payload, list) else [payload]
    resultados = await WhatsappService(session).ingerir(
        [mensagem.para_dominio() for mensagem in lote],
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
    """As mesmas quatro combinações de `grupo` × `intervalo` do LLM: KPI, série temporal, total
    por dimensão e série por dimensão."""

    baldes = await WhatsappService(session).metricas(filtro, grupo, intervalo)
    return [
        MetricaOut(
            grupo=balde.grupo,
            periodo=balde.periodo,
            mensagens=balde.mensagens,
            cobraveis=balde.cobraveis,
            custo=float(balde.custo) if balde.custo is not None else None,
            moeda=balde.moeda,
        )
        for balde in baldes
    ]


@router.get("/mensagens", dependencies=[Depends(requer_leitura)])
async def listar_mensagens(
    session: SessionDep,
    filtro: FiltroDep,
    limite: Annotated[int, Query(ge=1, le=500)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> MensagensOut:
    """A lista crua. Com `conteudo` e `direcao`, ela é um registro de conversa — não só uma
    auditoria de contagem."""

    pagina = await WhatsappService(session).listar(filtro, limite, offset)
    return MensagensOut(
        total=pagina.total,
        limite=pagina.limite,
        offset=pagina.offset,
        itens=[MensagemOut.model_validate(item) for item in pagina.itens],
    )


@router.get("/paises", dependencies=[Depends(requer_leitura)])
async def listar_paises(session: SessionDep) -> list[str]:
    """Popula o dropdown de filtro: os países que já apareceram em alguma mensagem.

    Não há `/v1/whatsapp/categorias` ao lado: a lista é fixa em quatro valores e cabe no
    frontend. Um endpoint para isso seria uma ida ao banco para descobrir o que já se sabe."""

    return await WhatsappService(session).distintos(Grupo.PAIS)
