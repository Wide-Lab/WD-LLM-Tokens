# Backend — Controle de Tokens

FastAPI + SQLAlchemy async + Alembic + Postgres, gerenciado com `uv`. Contratos em
[`../.claude/docs/api.md`](../.claude/docs/api.md) e [`../.claude/docs/modelo-de-dados.md`](../.claude/docs/modelo-de-dados.md).

## Estrutura

```
app/
  api/        router raiz (/v1) e as dependencies de autenticação
  core/       config, exceções, logging, período
  db/         Base declarativa, engine e sessão
  modules/
    llm/        registro_llm: ingestão, listagem e métricas de chamada ao LLM
    whatsapp/   registro_mensagem: ingestão, listagem e métricas de mensagem
    precos/     preco_modelo e preco_mensagem: preço com vigência e as expressões de custo
    acesso/     usuario e chave_api: login, sessão, cadastro e emissão de chave
```

Cada módulo é `api / application / domain / infra`: a rota traduz HTTP, o serviço orquestra, o
domínio guarda as regras e o `infra` fala com o banco.

Import de módulo a módulo, só três:

- `llm/infra/repository.py` → `precos/infra/custo.py` — a fórmula do custo vive num lugar só, e
  é usada tanto na listagem quanto na agregação.
- `whatsapp/infra/repository.py` → `precos/infra/custo_mensagem.py` — o mesmo motivo, a outra
  fórmula. Dinheiro mora no `precos`, e não dentro de cada módulo de fato.
- `api/dependencies.py` → `acesso/{infra,application,domain}` — autenticação é transversal e já
  morava ali. Depende do `acesso` por dentro (sessão, serviço, entidade) e nunca pela `api`
  dele, que é justamente quem importa `api/dependencies.py` de volta.

`core/periodo.py` não conta como import de módulo a módulo: `core` é a casa do transversal, e é
onde moram o `Intervalo` (`dia`/`semana`/`mes`) e a janela de datas que os dois módulos de fato
precisam acertar **igual** — `ate` é o dia inteiro, e duas cópias dessa regra divergiriam no dia
em que alguém mexesse numa. O `Filtro` de cada módulo continua no módulo: o do LLM tem `modelo`, o
do WhatsApp tem `categoria`, `pais` e `direcao`.

## Dev local

```bash
docker compose up -d db            # sobe o Postgres (na raiz do repo)
cp .env.example .env               # ajuste DATABASE_URL para localhost
uv sync                            # instala dependências
uv run alembic upgrade head        # aplica migrations
uv run uvicorn app.main:app --reload   # sobe em :8000  (GET /health, docs em /api/docs)
```

O prefixo `/api` faz parte das rotas **aqui**, não do nginx: o `create_app` monta o router em
`/api/v1`, e o nginx repassa a URI como veio. Vale igual no dev local — as rotas são
`localhost:8000/api/v1/...`. No `vite dev`, o proxy do `vite.config.ts` manda `/api` para cá,
que é o que mantém painel e API na mesma origem (e o cookie de sessão funcionando).

## Usuários

Cadastro só pela `CHAVE_ADMIN` — o painel não tem tela de criar conta:

```bash
curl -X POST localhost:8000/api/v1/usuarios \
  -H "X-API-Key: $CHAVE_ADMIN" -H 'Content-Type: application/json' \
  -d '{"email":"voce@empresa.com","nome":"Seu Nome","senha":"uma-senha-longa-de-verdade"}'
```

O login precisa de `SEGREDO_SESSAO` no `.env`, senão responde `503`:

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

## Chaves de API

Escrita e leitura nascem pela `CHAVE_ADMIN`. **A resposta é a única vez que o segredo aparece** —
o banco guarda só o hash:

```bash
curl -X POST localhost:8000/api/v1/chaves \
  -H "X-API-Key: $CHAVE_ADMIN" -H 'Content-Type: application/json' \
  -d '{"nome":"famossul produção","escopo":"escrita","aplicacao":"famossul"}'

curl -X POST localhost:8000/api/v1/chaves \
  -H "X-API-Key: $CHAVE_ADMIN" -H 'Content-Type: application/json' \
  -d '{"nome":"relatório mensal","escopo":"leitura"}'
```

`GET /api/v1/chaves` lista (sem segredo, ativas primeiro) e `DELETE /api/v1/chaves/{id}` revoga na
hora. As chaves de `CHAVES_ESCRITA`/`CHAVE_LEITURA` no `.env` continuam valendo em paralelo — dá
para emitir as novas, apontar cada app e só então esvaziar as variáveis.

## Preços

Sem linha em `preco_modelo`, o painel mostra tokens e `custo: null`. Para cadastrar:

```bash
curl -X POST localhost:8000/api/v1/precos \
  -H "X-API-Key: $CHAVE_ADMIN" -H 'Content-Type: application/json' \
  -d '{"modelo":"gpt-5.6-terra","provedor":"openai","vigencia_inicio":"2026-01-01",
       "entrada_por_milhao":"1.25","saida_por_milhao":"10.00","cache_leitura_por_milhao":"0.125"}'
```

A tarifa da mensagem de WhatsApp mora na mesma casa, em `preco_mensagem`, e casa por
`(categoria, país do destinatário)` — uma linha por país que você atende:

```bash
curl -X POST localhost:8000/api/v1/precos/mensagem \
  -H "X-API-Key: $CHAVE_ADMIN" -H 'Content-Type: application/json' \
  -d '{"categoria":"utility","pais":"BR","vigencia_inicio":"2026-01-01","por_mensagem":"0.0080"}'
```

`categoria` é `marketing`, `utility` ou `authentication` — `service` é recusada com `400`, porque
mensagem de serviço não é cobrada e isso entra como `cobravel = false` no evento. Cobrável sem
preço cadastrado sai com custo `null`, não zero: é assim que o painel avisa que falta um país.

## Mensagens de WhatsApp

Quem reporta manda uma linha por mensagem, com a **mesma** chave de escrita da aplicação — a
chave é a identidade de quem reporta, não do tipo de fato:

```bash
curl -X POST localhost:8000/api/v1/whatsapp/mensagens \
  -H "X-API-Key: $CHAVE_ESCRITA" -H 'Content-Type: application/json' \
  -d '{"aplicacao":"famossul","ator":"5547999999999","direcao":"enviada","categoria":"utility",
       "pais":"BR","cobravel":true,"id_externo":"wamid.HBgNNTU0Nzk...",
       "conteudo":"Seu pedido #4312 saiu para entrega.",
       "metadados":{"pricing":{"billable":true,"category":"utility"}}}'
```

`categoria` e `cobravel` são cópias do objeto `pricing` do webhook de status da Meta — não são
regra nossa e não são recalculadas aqui (ver `docs/api.md`). O `id_externo` é o `wamid`: reenviar
o mesmo devolve `duplicado: true`, que é o que deixa repassar `sent`, `delivered` e `read` sem
contar a mensagem três vezes.

Leitura em `GET /v1/whatsapp/metricas`, `GET /v1/whatsapp/mensagens` e `GET /v1/whatsapp/paises`,
com a chave de leitura ou a sessão do painel.

## Migrations

```bash
uv run alembic revision --autogenerate -m "descrição"
uv run alembic upgrade head
uv run alembic check                 # acusa divergência entre models e migrations
```

## Qualidade

```bash
uv run ruff format .
uv run ruff check .
uv run mypy app
```
