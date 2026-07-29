"""A projeção de custo de `registro_mensagem` — a única superfície que o `consolidado` enxerga.

Gêmea da do LLM, de propósito: mesmas colunas, mesma ordem, mesmos quatro filtros
(`app/core/lancamento.py`). O que muda é só de onde o dinheiro sai. Uma terceira origem depois é
mais um arquivo como este, e não uma reescrita do consolidado.

Nem `categoria`, nem `pais`, nem `direcao`, nem `cobravel` atravessam: eles não existem do outro
lado, e uma soma recortada por uma dimensão que só metade das linhas tem é um total que parece
completo e não é. Essas perguntas têm endereço — `/v1/whatsapp/metricas`."""

from typing import Any

from sqlalchemy import Select, func, literal, select, true

from app.core.lancamento import FiltroComum
from app.core.periodo import janela
from app.modules.precos.infra.custo_mensagem import MOEDA_PADRAO
from app.modules.whatsapp.infra.models import RegistroMensagem as RegistroMensagemRow
from app.modules.whatsapp.infra.repository import custo_vigente

ORIGEM = "whatsapp"
"""O nome desta origem na coluna `origem` — é o rótulo do balde em `grupo=origem`."""


def projecao_de_custo(filtro: FiltroComum) -> Select[Any]:
    """As linhas de `registro_mensagem` no formato de lançamento, já recortadas pelo período.

    As três saídas de `custo` seguem valendo dentro da soma, e cada uma faz uma coisa diferente
    lá: `0` (não cobrável) entra e não muda o total, a tarifa entra e soma, e `NULL` (cobrável sem
    preço para o país) fica de fora — que é como o painel continua denunciando o buraco em vez de
    somar zero e mostrar um total confortável e errado."""

    preco, custo = custo_vigente()

    stmt = (
        select(
            RegistroMensagemRow.criado_em.label("criado_em"),
            RegistroMensagemRow.aplicacao.label("aplicacao"),
            RegistroMensagemRow.ator.label("ator"),
            literal(ORIGEM).label("origem"),
            custo.label("custo"),
            func.coalesce(preco.moeda, literal(MOEDA_PADRAO)).label("moeda"),
        )
        .select_from(RegistroMensagemRow)
        .outerjoin(preco.lateral, true())
        # A mesma `janela` do LLM: as duas origens recortam o período igual, ou o consolidado
        # somaria períodos diferentes sem avisar.
        .where(*janela(RegistroMensagemRow.criado_em, filtro.de, filtro.ate))
    )

    if filtro.aplicacao:
        stmt = stmt.where(RegistroMensagemRow.aplicacao == filtro.aplicacao)
    if filtro.ator:
        stmt = stmt.where(RegistroMensagemRow.ator == filtro.ator)

    return stmt
