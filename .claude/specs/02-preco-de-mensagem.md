# Etapa 2 — o preço da mensagem, dentro de `precos`

## Objetivo

Dar ao módulo `precos` a segunda tabela e a segunda fórmula. Nada consome isto ainda — a etapa 3
consome. Separar as duas etapas é o que mantém o commit da ingestão legível.

## Por que aqui e não dentro de `whatsapp`

Porque a divisão do projeto é *o que aconteceu* × *quanto custa* × *quem entra*, e não uma
divisão por produto. Se cada módulo de fato carregasse o próprio preço, a frase "dinheiro mora
num lugar só" deixaria de ser verdade no dia em que fosse mais útil — que é justamente quando há
duas moedas de conta diferentes na mesma tela.

## Tabela `preco_mensagem`

Preço por vigência, mesmo padrão de `preco_modelo`: reajuste da Meta não reescreve o histórico.

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` PK | |
| `categoria` | `text not null` | `marketing`, `utility`, `authentication` |
| `pais` | `text not null` | ISO-3166 alfa-2 do destinatário (`BR`, `US`) |
| `vigencia_inicio` | `date not null` | a partir de quando este preço vale |
| `moeda` | `text not null` | `USD` |
| `por_mensagem` | `numeric not null` | o valor de **uma** mensagem cobrável |

```sql
unique (categoria, pais, vigencia_inicio)
index (categoria, pais, vigencia_inicio desc)   -- é a busca do lateral
```

`service` não entra na tabela: mensagem de serviço não é cobrada, e é `cobravel = false` no
evento que resolve isso. Cadastrar `service` com valor zero seria dizer duas vezes a mesma coisa
em lugares que podem discordar.

Uma coluna de valor só, e não `por_mensagem` + `taxa_plataforma`: sem BSP não há markup. Se um
dia entrar, é uma coluna e uma parcela na fórmula.

## `precos/infra/custo_mensagem.py`

Irmão de `custo.py`, mesmo formato: um `LEFT JOIN LATERAL` que anexa a cada mensagem o preço
válido na data dela, e uma expressão de custo. Arquivo separado, e não uma função a mais em
`custo.py`, porque as duas fórmulas não compartilham uma linha — juntá-las só criaria um arquivo
onde é preciso ler metade para achar a outra.

```python
def preco_vigente_de_mensagem(categoria, pais, criado_em) -> PrecoMensagemVigente
```

`LIMIT 1` sobre `ORDER BY vigencia_inicio DESC` com `vigencia_inicio <= cast(criado_em, Date)`,
igual ao de modelo. `LEFT` pelo mesmo motivo: mensagem sem preço cadastrado **continua
aparecendo** no painel, com custo `null`.

A expressão de custo:

```python
case((~cobravel, literal(0, Numeric)), else_=lateral.c.por_mensagem)
```

Nesta ordem, e não com `coalesce`. As três saídas precisam ser distinguíveis:

| Situação | Custo |
|---|---|
| `cobravel = false` (serviço, janela aberta, entrada, free entry point) | `0` |
| `cobravel = true` e há preço vigente | `por_mensagem` |
| `cobravel = true` e **não** há preço para `(categoria, pais, data)` | `null` |

O terceiro caso é o que faz o painel gritar que falta cadastrar um país, em vez de somar zero e
mostrar um total confortável e errado.

## Domínio e repositório

`precos/domain/entities.py` ganha `NovoPrecoMensagem` e `PrecoMensagem`; validação: `por_mensagem >= 0`
e `categoria` dentro do enum. O enum `CategoriaMensagem` (`marketing`/`utility`/`authentication`)
nasce **aqui**, no `precos`, porque é aqui que ele restringe alguma coisa; o módulo `whatsapp`
tem o seu, que inclui `service` — as duas listas não são a mesma e não devem ser um import.

`precos/infra/repository.py` ganha `PrecoMensagemRepository` com `listar(categoria, pais)` e
`criar`. A duplicata é detectada pelo `UNIQUE`, não por um `SELECT` antes — entre a leitura e a
escrita cabe outro cadastro. Mensagem do `409`:
`Já existe preço de {categoria} em {pais} a partir de {vigencia_inicio}.`

## Rotas

Sob a `CHAVE_ADMIN` para escrever, chave de leitura ou sessão para ler — igual às de modelo.

```
GET  /v1/precos/mensagem?categoria=&pais=
POST /v1/precos/mensagem
```

```json
{
  "categoria": "utility",
  "pais": "BR",
  "vigencia_inicio": "2026-01-01",
  "moeda": "USD",
  "por_mensagem": "0.0080"
}
```

`GET`/`POST /v1/precos` continuam sendo os de modelo, sem alias e sem renomeação. A assimetria é
deliberada: são rotas de administração usadas por `curl`, o `backend/README.md` as documenta, e
mexer nelas seria churn sem consumidor.

## Documentos

- `docs/modelo-de-dados.md` — seção `preco_mensagem` e o cálculo de custo da mensagem, ao lado
  do de token, com a tabela de três saídas acima.
- `docs/api.md` — as duas rotas novas.
- `backend/README.md` — um `curl` de cadastro de preço de mensagem junto do de modelo.

## Critérios de pronto

- `uv run alembic upgrade head`, `alembic check` limpo, `downgrade -1` derruba só a tabela nova.
- `POST /v1/precos/mensagem` cria; repetir o mesmo `(categoria, pais, vigencia_inicio)` dá `409`.
- `POST` sem `CHAVE_ADMIN` dá `401`; `GET` com sessão do painel funciona.
- `categoria: "service"` no `POST` é recusada com `400` e uma mensagem que diz o porquê.
- `ruff check`, `mypy app` limpos.
