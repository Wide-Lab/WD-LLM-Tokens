# Modelo de dados

No centro, o que aconteceu (`registro_llm`) e quanto custa (`preco_modelo`, `preco_mensagem`).
O custo nunca é gravado no evento — é derivado. Em volta, quem tem permissão de chegar perto:
`usuario` e `chave_api`.

As duas tabelas de preço moram juntas de propósito: **dinheiro mora num lugar só**. São duas, e
não uma com `tipo`, porque a chave do preço é diferente em cada — `preco_modelo` casa por
`modelo`, o WhatsApp cobra por `(categoria, país do destinatário)`. Uma tabela com metade das
colunas nula em cada linha são duas tabelas fingindo ser uma.

## `registro_llm` — uma linha por chamada ao LLM

Como é **uma linha por requisição**, o "número de requisições" é só `COUNT(*)`.

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` PK | gerado pelo servidor |
| `criado_em` | `timestamptz not null` | hora da chamada; o app pode enviar, default `now()` |
| `recebido_em` | `timestamptz not null default now()` | hora que o servidor recebeu (ajuda a depurar relógio torto) |
| `aplicacao` | `text not null` | qual app/projeto reportou |
| `ator` | `text not null` | quem consumiu: `wa_id`, telefone, `user_id`... |
| `modelo` | `text not null` | ex.: `gpt-5.6-terra`, `claude-opus-4-8` |
| `provedor` | `text null` | ex.: `openai`, `anthropic` |
| `tokens_entrada` | `int not null default 0` | entrada **não** cacheada (ver convenção abaixo) |
| `tokens_saida` | `int not null default 0` | |
| `tokens_cache_leitura` | `int not null default 0` | input servido do cache |
| `tokens_cache_escrita` | `int not null default 0` | criação de cache |
| `id_externo` | `text null` | id do provedor (ex.: `response.id`) para idempotência |
| `mensagem` | `text null` | o que o ator mandou nesta chamada |
| `resposta` | `text null` | o que o agente devolveu |
| `metadados` | `jsonb not null default '{}'` | conversa_id, latência, etc. |

`mensagem` e `resposta` são colunas próprias, e não chaves em `metadados`: é o conteúdo que a
tela de detalhe do ator abre em toda linha, então é contrato, não bagagem livre. As duas são
nuláveis e sem default — `NULL` quer dizer "não veio no evento" (inclusive nos eventos gravados
antes das colunas existirem), que é diferente de "o agente respondeu vazio". Quem reporta decide
se manda; o evento continua valendo pela contagem de token sem elas.

**Restrições e índices:**

```sql
unique (aplicacao, id_externo)            -- só quando id_externo não é nulo (partial index)
index (aplicacao, criado_em)
index (aplicacao, ator, criado_em)
index (aplicacao, modelo, criado_em)
```

O `unique` dá idempotência: se o app reenviar por causa de um retry, o `INSERT`
usa `ON CONFLICT (aplicacao, id_externo) DO NOTHING` e não conta em dobro.

## Convenção crítica: os quatro baldes de token não se sobrepõem

Cada provedor reporta cache de um jeito diferente:

- **Anthropic** devolve `input_tokens`, `cache_creation_input_tokens` e
  `cache_read_input_tokens` como baldes **separados** — já não se sobrepõem.
- **OpenAI** devolve `prompt_tokens` **incluindo** os cacheados, e reporta
  `cached_tokens` como subconjunto.

A convenção do serviço é: **os quatro campos são não-sobrepostos**. Quem reporta
normaliza **antes** do `POST`:

| Campo do serviço | Anthropic | OpenAI |
|---|---|---|
| `tokens_entrada` | `input_tokens` | `prompt_tokens - cached_tokens` |
| `tokens_cache_leitura` | `cache_read_input_tokens` | `cached_tokens` |
| `tokens_cache_escrita` | `cache_creation_input_tokens` | `0` (OpenAI não cobra escrita de cache) |
| `tokens_saida` | `output_tokens` | `completion_tokens` |

Sem isso o custo infla silenciosamente (o mesmo token é cobrado duas vezes).

## `preco_modelo` — preço com vigência

Preço por vigência para que reajuste do provedor não corrompa o custo histórico.

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` PK | |
| `provedor` | `text null` | |
| `modelo` | `text not null` | casa com `registro_llm.modelo` |
| `vigencia_inicio` | `date not null` | a partir de quando este preço vale |
| `moeda` | `text not null` | `USD` no v1 (mesma moeda em todas as linhas) |
| `entrada_por_milhao` | `numeric not null` | custo por 1.000.000 tokens de entrada |
| `saida_por_milhao` | `numeric not null` | |
| `cache_leitura_por_milhao` | `numeric not null default 0` | |
| `cache_escrita_por_milhao` | `numeric not null default 0` | |

```sql
unique (modelo, vigencia_inicio)
```

## `preco_mensagem` — a tarifa da mensagem de WhatsApp

Mesmo padrão de vigência, chave diferente: a Meta cobra por categoria e país do destinatário.

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` PK | |
| `categoria` | `text not null` | `marketing`, `utility`, `authentication` |
| `pais` | `text not null` | ISO-3166 alfa-2 do destinatário (`BR`, `US`), maiúsculo |
| `vigencia_inicio` | `date not null` | a partir de quando este preço vale |
| `moeda` | `text not null` | `USD` |
| `por_mensagem` | `numeric not null` | o valor de **uma** mensagem cobrável |

```sql
unique (categoria, pais, vigencia_inicio)
index (categoria, pais, vigencia_inicio desc)   -- é a busca do lateral
```

`service` **não** entra na tabela: mensagem de serviço não é cobrada, e quem resolve isso é o
`cobravel = false` do evento. Cadastrá-la com valor zero seria dizer a mesma coisa em dois
lugares que podem discordar.

Uma coluna de valor só, e não `por_mensagem` + `taxa_plataforma`: indo direto na Cloud API não há
BSP nem markup. Se um dia entrar, é uma coluna e uma parcela a mais na fórmula.

O `pais` casa por igualdade exata, sem curinga de mercado — país não cadastrado sai com custo
`null`, e é esse buraco visível que pede o cadastro.

## `usuario` — quem entra no painel

Não tem relação com as outras duas tabelas: ninguém "pertence" a um usuário, e nenhum evento
aponta para ele. É só a lista de quem pode abrir o painel — que passou a existir quando o painel
foi exposto na internet e a chave no `localStorage` deixou de servir de tranca.

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` PK | |
| `email` | `text not null unique` | guardado em minúsculas; o `UNIQUE` do Postgres é sensível a caixa |
| `nome` | `text not null` | o que aparece na barra lateral |
| `senha_hash` | `text not null` | Argon2id; a senha em claro nunca é gravada nem devolvida |
| `ativo` | `bool not null default true` | `false` derruba a sessão em aberto no request seguinte |
| `criado_em` | `timestamptz not null default now()` | |

Não há tabela de sessões: o cookie é o id do usuário assinado com `SEGREDO_SESSAO`. A revogação
que uma tabela daria vem de `ativo`, relido a cada requisição.

## `chave_api` — quem fala com a API sem ser gente

Também solta das demais. Nasce em `POST /v1/chaves` (ver `docs/api.md`) e substitui, sem pressa,
as chaves que viviam em variável de ambiente.

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` PK | |
| `nome` | `text not null` | para gente: "famossul produção" |
| `escopo` | `text not null` | `escrita` ou `leitura`; `text` e não `enum` para escopo novo não virar `ALTER TYPE` |
| `aplicacao` | `text null` | só nas de escrita — a chave **é** a identidade de quem reporta |
| `prefixo` | `text not null unique` | o pedaço em claro da chave, para reconhecer qual é qual |
| `impressao` | `text not null unique` | SHA-256 da chave; é por ele que a autenticação busca |
| `criada_em` | `timestamptz not null default now()` | |
| `ultimo_uso_em` | `timestamptz null` | carimbado no máximo de hora em hora |
| `revogada_em` | `timestamptz null` | `NULL` = ativa; revogar é carimbar, não apagar |

É a única tabela que sofre `UPDATE` fora de `preco_modelo`. O append-only vale para o que é fato
consumado — um evento aconteceu e não desacontece; credencial é estado, e estado precisa poder
ser desligado.

## Cálculo de custo

### Chamada ao LLM

Para cada evento, escolhe-se a linha de preço do mesmo `modelo` com o maior
`vigencia_inicio <= registro_llm.criado_em`, e soma-se balde a balde:

```
custo =  tokens_entrada        / 1e6 * entrada_por_milhao
       + tokens_saida          / 1e6 * saida_por_milhao
       + tokens_cache_leitura  / 1e6 * cache_leitura_por_milhao
       + tokens_cache_escrita  / 1e6 * cache_escrita_por_milhao
```

Se não houver preço cadastrado para o modelo, o custo do evento é `null` (o
painel mostra tokens mesmo assim; o custo só aparece depois que o preço entra).

### Mensagem de WhatsApp

Mesma ideia, uma parcela só: escolhe-se a linha de `preco_mensagem` de mesma `(categoria, pais)`
com o maior `vigencia_inicio <= criado_em` da mensagem, e o custo é `por_mensagem` — quando a
mensagem é cobrável.

Quem decide se ela é cobrável **não é este serviço**: é o objeto `pricing` do webhook de status,
que já leva em conta janela de atendimento aberta, free entry point e as isenções que a Meta foi
criando. Recalcular a regra de cobrança de outra empresa é errar em silêncio no dia em que ela
mudar.

As três saídas precisam ser distinguíveis:

| Situação | Custo |
|---|---|
| `cobravel = false` (serviço, janela aberta, entrada, free entry point) | `0` |
| `cobravel = true` e há preço vigente | `por_mensagem` |
| `cobravel = true` e **não** há preço para `(categoria, pais, data)` | `null` |

O terceiro caso é o que faz o painel gritar que falta cadastrar um país, em vez de somar zero e
mostrar um total confortável e errado. É a mesma convenção do LLM: `null` é "não sei quanto
custou", `0` é "não custou nada" — e as duas nunca viram o mesmo número.

**Moeda:** todas as linhas de preço, das duas tabelas, na mesma moeda (USD) no v1. Misturar
moedas numa mesma agregação é o único jeito de o número sair errado. Conversão
para BRL, se necessária, acontece na exibição — fora do backend.
