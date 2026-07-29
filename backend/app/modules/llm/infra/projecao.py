"""A projeção de custo de `registro_llm` — a única superfície que o `consolidado` enxerga daqui.

Uma função, as colunas fixas de `app/core/lancamento.py`, e um arquivo só para ela: é o que
mantém honesta a promessa de que somar as duas origens não puxa junto o resto do módulo. Fosse uma
função a mais no `repository.py`, a superfície seria "o repositório inteiro", e a primeira coluna
de token a vazar para o consolidado passaria despercebida.

Devolve um `Select`, e não linhas: quem soma é o consolidado, e o que sai daqui é um pedaço de
consulta — a agregação acontece uma vez, no banco, sobre o `UNION ALL` das duas projeções.

Este arquivo não sabe que o consolidado existe, e é essa a direção que importa."""

from typing import Any

from sqlalchemy import Select, func, literal, select, true

from app.core.lancamento import FiltroComum
from app.core.periodo import janela
from app.modules.llm.infra.models import RegistroLlm as RegistroLlmRow
from app.modules.llm.infra.repository import custo_vigente
from app.modules.precos.infra.custo import MOEDA_PADRAO

ORIGEM = "llm"
"""O nome desta origem na coluna `origem` — é o rótulo do balde em `grupo=origem`."""


def projecao_de_custo(filtro: FiltroComum) -> Select[Any]:
    """As linhas de `registro_llm` no formato de lançamento, já recortadas pelo período.

    O custo é o **mesmo** da listagem e da agregação deste módulo (`custo_vigente`): um balde do
    consolidado e um balde de `/v1/llm/metricas` para o mesmo período dão o mesmo número. Se
    saíssem de fórmulas diferentes, a primeira pergunta de quem olhasse os dois painéis seria qual
    dos dois está errado — e não haveria resposta boa.

    `custo` continua saindo `NULL` quando o modelo não tem preço cadastrado. É o `sum` lá em cima
    que resolve isso do jeito certo: ele ignora `NULL`, então uma origem sem preço nenhum não zera
    o total da outra."""

    preco, custo = custo_vigente()

    stmt = (
        select(
            RegistroLlmRow.criado_em.label("criado_em"),
            RegistroLlmRow.aplicacao.label("aplicacao"),
            RegistroLlmRow.ator.label("ator"),
            literal(ORIGEM).label("origem"),
            custo.label("custo"),
            func.coalesce(preco.moeda, literal(MOEDA_PADRAO)).label("moeda"),
        )
        .select_from(RegistroLlmRow)
        .outerjoin(preco.lateral, true())
        # A mesma `janela` do resto do módulo, e é o que faz `ate` valer o dia inteiro dos dois
        # lados do `UNION ALL`.
        .where(*janela(RegistroLlmRow.criado_em, filtro.de, filtro.ate))
    )

    if filtro.aplicacao:
        stmt = stmt.where(RegistroLlmRow.aplicacao == filtro.aplicacao)
    if filtro.ator:
        stmt = stmt.where(RegistroLlmRow.ator == filtro.ator)

    return stmt
