"""O vocabulário do lançamento — o fato com dinheiro, visto de fora de quem o produziu.

Um lançamento é uma linha de `registro_llm` ou de `registro_mensagem` reduzida ao que as duas têm
em comum: quando, de quem, de que origem e quanto custou. É o que o `consolidado` soma, e é a
razão de cada módulo de fato ter um `infra/projecao.py`.

O contrato das projeções são estas colunas, nesta ordem:

    criado_em, aplicacao, ator, origem, custo, moeda

`origem` é a única que não vem da tabela: é o literal com o nome do módulo (`llm`, `whatsapp`), e
é ela que faz `grupo=origem` existir. Cada módulo declara o próprio, em vez de haver um enum
compartilhado, porque uma origem nova (transcrição, TTS) tem de ser um `projecao.py` a mais — e
não uma linha num enum que todo mundo importa.

Mora no `core` pelo mesmo motivo que `periodo.py`: é o que os dois módulos de fato precisam
acertar **igual**, e `core` é a casa do transversal — importar `core` não é import de módulo a
módulo. É também o que preserva a direção do acoplamento: o consolidado conhece as origens, as
origens não conhecem o consolidado."""

from dataclasses import dataclass
from datetime import date


@dataclass(frozen=True, slots=True)
class FiltroComum:
    """Os filtros que existem nos dois lados — e só eles.

    Nada de `modelo`, nada de `categoria`: um filtro que só existe numa origem, aplicado a uma
    soma das duas, produz um total que parece completo e não é. Quem quer recortar por modelo está
    perguntando sobre LLM, e a pergunta tem endereço (`/v1/llm/metricas`).

    O **mesmo objeto** vai para as duas projeções, e é isso que garante que o período recorte
    igual dos dois lados: não há como passar um `ate` para uma origem e outro para a outra."""

    de: date | None = None
    ate: date | None = None
    aplicacao: str | None = None
    ator: str | None = None
