# Modelo de dados

Duas tabelas no centro. Uma guarda o que aconteceu (`registro_uso`), a outra guarda quanto
custa (`preco_modelo`). O custo nunca é gravado no evento — é derivado. Em volta, quem tem
permissão de chegar perto: `usuario` e `chave_api`.

## `registro_uso` — uma linha por chamada ao LLM

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
| `modelo` | `text not null` | casa com `registro_uso.modelo` |
| `vigencia_inicio` | `date not null` | a partir de quando este preço vale |
| `moeda` | `text not null` | `USD` no v1 (mesma moeda em todas as linhas) |
| `entrada_por_milhao` | `numeric not null` | custo por 1.000.000 tokens de entrada |
| `saida_por_milhao` | `numeric not null` | |
| `cache_leitura_por_milhao` | `numeric not null default 0` | |
| `cache_escrita_por_milhao` | `numeric not null default 0` | |

```sql
unique (modelo, vigencia_inicio)
```

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

Para cada evento, escolhe-se a linha de preço do mesmo `modelo` com o maior
`vigencia_inicio <= registro_uso.criado_em`, e soma-se balde a balde:

```
custo =  tokens_entrada        / 1e6 * entrada_por_milhao
       + tokens_saida          / 1e6 * saida_por_milhao
       + tokens_cache_leitura  / 1e6 * cache_leitura_por_milhao
       + tokens_cache_escrita  / 1e6 * cache_escrita_por_milhao
```

Se não houver preço cadastrado para o modelo, o custo do evento é `null` (o
painel mostra tokens mesmo assim; o custo só aparece depois que o preço entra).

**Moeda:** todas as linhas de `preco_modelo` na mesma moeda (USD) no v1. Misturar
moedas numa mesma agregação é o único jeito de o número sair errado. Conversão
para BRL, se necessária, acontece na exibição — fora do backend.
