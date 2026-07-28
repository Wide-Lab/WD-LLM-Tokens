# Etapa 3 — o módulo `whatsapp`

## Objetivo

O segundo módulo de fato: uma linha por mensagem, ingestão idempotente pelo `wamid`, listagem
crua e métricas. Espelha o `llm` em estrutura e discorda dele em tudo que é específico —
que é o ponto de serem dois módulos.

## O núcleo compartilhado nasce aqui

`app/core/periodo.py`. Não antes: extrair vocabulário comum com um consumidor só é adivinhação,
e o segundo consumidor é este.

```python
class Intervalo(StrEnum):   # dia | semana | mes
def truncar(intervalo, coluna) -> ColumnElement   # cast(date_trunc(unidade, coluna), Date)
def janela(coluna, de, ate) -> list[ColumnElement]  # os WHERE do período
```

`janela` carrega a regra que os dois módulos precisam acertar igual: `ate` é **o dia inteiro**
(`coluna < meia_noite(ate + 1 dia)`), porque o painel filtra por data e um `<=` sobre a
meia-noite cortaria fora quase todo o último dia. Duas cópias dessa regra divergem no dia em que
alguém mexer numa.

O `Filtro` **não** sobe para o core: o do LLM tem `modelo`, o do WhatsApp tem `categoria`, `pais`
e `direcao`. Um `Filtro` genérico com os dois conjuntos seria uma estrutura em que metade dos
campos é sempre ignorada. Cada módulo mantém o seu, com `de`/`ate` planos, e chama `janela`.

`llm` passa a importar `Intervalo`, `truncar` e `janela` de `app.core.periodo` — `Intervalo` sai
de `llm/domain/entities.py`. Importar `core` não é import de módulo a módulo: `core` já é a casa
do transversal (config, exceções, logging).

## Tabela `registro_mensagem`

Uma linha por mensagem. Append-only, como tudo que é fato consumado. `COUNT(*)` = mensagens.

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` PK | |
| `criado_em` | `timestamptz not null default now()` | a hora da mensagem |
| `recebido_em` | `timestamptz not null default now()` | a hora em que o servidor recebeu |
| `aplicacao` | `text not null` | |
| `ator` | `text not null` | o `wa_id` do cliente, E.164 só dígitos — **o mesmo texto do `ator` do LLM** |
| `direcao` | `text not null` | `enviada` \| `recebida` |
| `categoria` | `text null` | `marketing` \| `utility` \| `authentication` \| `service`; `null` em `recebida` |
| `pais` | `text not null` | ISO-3166 alfa-2 |
| `cobravel` | `bool not null default false` | de `pricing.billable`, da Meta |
| `id_externo` | `text null` | o `wamid` |
| `conteudo` | `text null` | o texto da mensagem |
| `metadados` | `jsonb not null default '{}'` | o objeto `pricing` cru, id da conversa, nome do template |

```sql
unique (aplicacao, id_externo) where id_externo is not null
index (aplicacao, criado_em)
index (aplicacao, ator, criado_em)
index (aplicacao, categoria, criado_em)
```

`text` e não `enum` em `direcao` e `categoria`, pelo mesmo motivo de `chave_api.escopo`: categoria
nova da Meta não vira `ALTER TYPE` numa janela de manutenção.

**`conteudo` é um campo só, não `mensagem` + `resposta`.** No LLM, uma linha é uma troca; aqui,
uma linha é uma fala, e `direcao` diz de quem. É a diferença que torna a lista de WhatsApp um
registro de conversa mais fiel que o do LLM — e a razão de valer a pena gravar a mensagem
recebida, que não custa nada.

Mensagem que falhou no envio (`failed`) **não vira evento**: a Meta não cobra, e um evento
gravado que depois deixasse de valer exigiria `UPDATE` numa tabela append-only.

## Domínio

`NovaMensagem` e `RegistroMensagem`, mais os enums `Direcao` e `Categoria` (este com `service`, ao
contrário do enum de `precos`, que só tem as três categorias cobráveis — listas diferentes,
propositalmente não compartilhadas).

`Grupo` do WhatsApp: `categoria`, `ator`, `aplicacao`, `pais`, `direcao`. Mapa fechado para
coluna, igual ao do LLM — é o que impede um `grupo` da query string de virar coluna arbitrária.

`Balde`: `mensagens`, `cobraveis`, `custo`, `moeda`, `grupo?`, `periodo?`. `cobraveis` é
`count(*) filter (where cobravel)` e responde "quantas das N foram pagas" sem uma segunda
consulta.

Validação em `__post_init__` — só o que é **impossível**, nunca o que é regra de cobrança da Meta:

| Regra | Motivo |
|---|---|
| `direcao = recebida` → `cobravel` tem de ser `false` | a Meta não cobra entrada, em hipótese nenhuma |
| `cobravel = true` → `categoria` obrigatória | sem categoria não há linha de preço para casar |

E **nada além disso**. Nada de recusar `service` cobrável, nada de inferir janela de atendimento:
se a Meta mandar `billable: true` numa combinação que hoje parece grátis, quem está errado é a
nossa suposição, e o evento tem de entrar do jeito que ela mandou.

## Ingestão

`POST /v1/whatsapp/mensagens`, um objeto ou um array, autenticado pela mesma chave de escrita da
aplicação — a chave é a identidade de quem reporta, não do tipo de fato. `403` se a `aplicacao`
do payload não for a dona da chave, igual ao LLM.

Idempotência por `(aplicacao, id_externo)` com `ON CONFLICT DO NOTHING`, mesmo padrão. O
`wamid` é chave natural perfeita: o webhook manda `sent`, depois `delivered`, depois `read` para
o mesmo id, e quem reporta pode mandar os três sem pensar — o segundo e o terceiro devolvem
`duplicado: true`.

**Quem reporta ingere no status que traz o `pricing`** (o `sent`). O mapeamento webhook → este
contrato é responsabilidade de quem reporta; o objeto `pricing` cru vai inteiro em `metadados`
para que qualquer conferência futura seja uma consulta.

```json
{
  "aplicacao": "famossul",
  "ator": "5547999999999",
  "direcao": "enviada",
  "categoria": "utility",
  "pais": "BR",
  "cobravel": true,
  "criado_em": "2026-07-28T14:00:00Z",
  "id_externo": "wamid.HBgNNTU0Nzk5OTk5OTk5ORUCABEYEjc...",
  "conteudo": "Seu pedido #4312 saiu para entrega.",
  "metadados": {
    "pricing": { "billable": true, "category": "utility", "pricing_model": "PMP" },
    "conversa_id": "d1f2...",
    "template": "pedido_em_transito"
  }
}
```

Resposta idêntica à do LLM: `{"id": ..., "duplicado": false}`, array para lote, na mesma ordem.

## Leitura

```
GET /v1/whatsapp/metricas?grupo=&intervalo=&de=&ate=&aplicacao=&ator=&categoria=&pais=&direcao=
GET /v1/whatsapp/mensagens?…&limite=50&offset=0
GET /v1/whatsapp/paises
```

Mesma mecânica de `grupo` × `intervalo` do LLM: as quatro combinações cobrem KPI, série temporal,
total por dimensão e série por dimensão.

Não há `GET /v1/whatsapp/categorias`: a lista é fixa e cabe no frontend. Um endpoint para quatro
valores constantes é uma ida ao banco para descobrir o que já se sabe.

Balde:

```json
{
  "grupo": "utility",
  "periodo": "2026-07-28",
  "mensagens": 120,
  "cobraveis": 84,
  "custo": 0.672,
  "moeda": "USD"
}
```

`grupo` e `periodo` omitidos — não `null` — quando o parâmetro não foi passado, com o mesmo
`model_serializer` do `MetricaOut` do LLM e pelo mesmo motivo: `custo: null` é informação e um
`exclude_none` genérico o comeria junto.

## Documentos

- `docs/modelo-de-dados.md` — `registro_mensagem`, a convenção do `ator` compartilhado e por que
  `failed` não vira evento.
- `docs/api.md` — as rotas, o exemplo de payload e a nota de que a categoria e o `cobravel` vêm
  da Meta, não de regra nossa.
- `backend/README.md` — o módulo novo na estrutura e o terceiro import cruzado.
- `CLAUDE.md` — a lista de módulos.

## Critérios de pronto

- `alembic upgrade head`, `alembic check` limpo.
- Reenviar o mesmo `wamid` devolve `duplicado: true` e não duplica linha.
- Chave de escrita de `app-a` reportando `aplicacao: "app-b"` leva `403`.
- `direcao: "recebida"` com `cobravel: true` leva `400`.
- Com preço cadastrado para `(utility, BR)`, `GET /v1/whatsapp/metricas` traz `custo` batendo com
  `cobraveis × por_mensagem`; sem preço, `custo: null` e `mensagens` continua preenchido.
- Mensagem com `cobravel: false` entra com custo `0` — e o total do período **não** vira `null`
  por causa dela.
- Painel de LLM segue intacto (esta etapa mexeu no `Intervalo` dele).
- `ruff check`, `mypy app` limpos.
