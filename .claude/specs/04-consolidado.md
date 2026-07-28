# Etapa 4 — o módulo `consolidado`

## Objetivo

Somar o custo das duas origens no backend, e não no browser. É a etapa que transforma dois
painéis num produto.

## Por que não somar no frontend

Porque a soma tem semântica: `custo: null` ("não sei") não pode virar zero ao encontrar um
número, as moedas precisam concordar antes de somar, e o período precisa ser recortado igual dos
dois lados. Cada uma dessas regras já existe uma vez no backend; reimplementá-las em TypeScript
seria a segunda cópia — e a que ninguém lembra de atualizar. Fora que são duas viagens de rede
para desenhar um gráfico.

## O contrato entre os módulos

Cada módulo de fato ganha um `infra/projecao.py` com uma função só, devolvendo um `Select` de
**colunas fixas**:

```python
def projecao_de_custo(filtro) -> Select
# criado_em, aplicacao, ator, origem, custo, moeda
```

`origem` é um literal: `'llm'` no módulo `llm`, `'whatsapp'` no `whatsapp`. O `filtro` aqui é só
o que as duas origens têm em comum — `de`, `ate`, `aplicacao`, `ator`. Nada de `modelo`, nada de
`categoria`: um filtro que só existe de um lado, aplicado a uma soma dos dois, produz um total
que parece completo e não é.

Arquivo próprio, e não uma função a mais no `repository.py`, para que a superfície que o
consolidado enxerga seja exatamente uma função por módulo — visível no `import` e fácil de manter
honesta.

**A direção do acoplamento é a que importa:** o consolidado conhece as origens, as origens não
conhecem o consolidado. Ele é folha do grafo de imports, e é isso que permite deletá-lo sem
mexer em nada.

## O repositório

`UNION ALL` das projeções, agregando por cima:

```sql
select <grupo>, <periodo>, count(*) as lancamentos,
       sum(custo) as custo, max(moeda) as moeda
from ( <projecao llm> union all <projecao whatsapp> ) as lancamento
group by ...
```

`UNION ALL` e não `UNION`: não há linha duplicada a eliminar entre as origens, e o `DISTINCT`
implícito do `UNION` custaria uma ordenação para descobrir isso.

`sum` ignora `NULL`, então o balde soma o que tem preço e sai `NULL` só quando nada tem — o
mesmo comportamento que o painel de LLM já tem hoje, pelo mesmo motivo.

`Grupo` do consolidado: `origem`, `aplicacao`, `ator`. Só as três dimensões que existem dos dois
lados. `intervalo` é o de sempre, vindo de `app/core/periodo.py`.

## Rota

```
GET /v1/consolidado/metricas?grupo=origem|aplicacao|ator&intervalo=dia|semana|mes&de=&ate=&aplicacao=&ator=
```

```json
[
  { "grupo": "llm", "periodo": "2026-07-28", "lancamentos": 42, "custo": 1.23, "moeda": "USD" },
  { "grupo": "whatsapp", "periodo": "2026-07-28", "lancamentos": 120, "custo": 0.67, "moeda": "USD" }
]
```

**Sem `tokens_*`, sem `mensagens`, sem `requisicoes`.** `lancamentos` é a contagem de fatos
cobráveis somados — honesto como "está chegando dado?", e deliberadamente sem pretensão de ser
um indicador de volume. Volume tem unidade, e as unidades não se somam: token fica no painel de
LLM, mensagem no de WhatsApp.

## `GET /v1/aplicacoes` muda de dono

Sai do router de `llm` e nasce no consolidado, unindo os distintos das duas tabelas. Uma
aplicação que só reportou WhatsApp precisa aparecer no dropdown do painel.

Isso **remove** `/v1/llm/aplicacoes` (que nunca teve consumidor — o painel sempre chamou
`/v1/aplicacoes`, e é esse caminho que continua existindo, agora servido por outro módulo). Não é
alias: o endpoint legado do LLM some junto com a rota canônica dele, porque manter os dois
significaria duas listas de aplicação divergindo em silêncio.

`GET /v1/modelos` fica onde está, sob `/v1/llm/modelos` e no alias legado — modelo é dimensão de
uma origem só.

## Documentos

- `docs/api.md` — a rota nova, a regra "o consolidado fala só dinheiro" e a mudança de dono de
  `/v1/aplicacoes`.
- `backend/README.md` — o módulo e os imports cruzados 3 e 4, com a nota de que ninguém importa
  o consolidado.
- `CLAUDE.md` — a lista de módulos.

## Critérios de pronto

- Com dados nas duas tabelas, `grupo=origem` devolve dois baldes e a soma deles bate, ao centavo,
  com `custo` do balde sem `grupo`.
- O mesmo `ator` presente nas duas origens aparece **uma** vez em `grupo=ator`, com o custo
  somado.
- `de`/`ate` recortam as duas origens igual: um evento no último dia do período entra pelos dois
  lados (é a regra de `janela` valendo nas duas projeções).
- Origem sem nenhum preço cadastrado não zera o total da outra.
- `/v1/aplicacoes` lista aplicação que só reportou WhatsApp.
- `/v1/llm/aplicacoes` responde `404`.
- `ruff check`, `mypy app` limpos.
