from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from enum import StrEnum


class Grupo(StrEnum):
    """A dimensão do `GROUP BY` do consolidado. Ausente = agrega tudo.

    Três, e não as três do LLM mais as cinco do WhatsApp: aqui só existe o que existe nos dois
    lados. `modelo` e `categoria` ficam de fora porque agrupar uma soma das duas origens por uma
    dimensão que só uma tem devolveria um balde sem nome com metade do dinheiro dentro.

    `origem` é a única que não é coluna de tabela nenhuma: ela nasce do literal que cada projeção
    carimba nas próprias linhas, e é o agrupamento que responde "quanto foi LLM e quanto foi
    WhatsApp"."""

    ORIGEM = "origem"
    APLICACAO = "aplicacao"
    ATOR = "ator"


@dataclass(frozen=True, slots=True)
class Balde:
    """Uma linha da resposta de `/v1/consolidado/metricas`.

    **Sem `tokens_*`, sem `mensagens`, sem `requisicoes`.** Volume tem unidade, e as unidades não
    se somam: um `requisicoes` somado a um `mensagens` é um número sem significado, e um painel que
    mostra um número sem significado ensina o leitor a desconfiar dos outros. Token fica no painel
    de LLM, mensagem no de WhatsApp.

    `lancamentos` é a contagem dos fatos que entraram nesta soma — honesto como "está chegando
    dado?", e deliberadamente sem pretensão de ser indicador de volume."""

    lancamentos: int
    custo: Decimal | None
    """`None` quando **nenhum** lançamento do balde soube dizer quanto custou. Uma origem sem preço
    cadastrado não zera a outra: o `sum` ignora `NULL` em vez de tratá-lo como zero."""

    moeda: str
    grupo: str | None = None
    periodo: date | None = None
