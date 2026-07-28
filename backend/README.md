# Backend — Controle de Tokens

FastAPI + SQLAlchemy async + Alembic + Postgres, gerenciado com `uv`. Contratos em
[`../docs/api.md`](../docs/api.md) e [`../docs/modelo-de-dados.md`](../docs/modelo-de-dados.md).

## Estrutura

```
app/
  api/        router raiz (/v1) e as dependencies de autenticação
  core/       config, exceções, logging
  db/         Base declarativa, engine e sessão
  modules/
    uso/      registro_uso: ingestão, listagem e métricas
    precos/   preco_modelo: preço com vigência e a expressão de custo
    acesso/   usuario: login, sessão e cadastro
```

Cada módulo é `api / application / domain / infra`: a rota traduz HTTP, o serviço orquestra, o
domínio guarda as regras e o `infra` fala com o banco.

Import de módulo a módulo, só dois:

- `uso/infra/repository.py` → `precos/infra/custo.py` — a fórmula do custo vive num lugar só, e
  é usada tanto na listagem quanto na agregação.
- `api/dependencies.py` → `acesso/{infra,application,domain}` — autenticação é transversal e já
  morava ali. Depende do `acesso` por dentro (sessão, serviço, entidade) e nunca pela `api`
  dele, que é justamente quem importa `api/dependencies.py` de volta.

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

## Preços

Sem linha em `preco_modelo`, o painel mostra tokens e `custo: null`. Para cadastrar:

```bash
curl -X POST localhost:8000/api/v1/precos \
  -H "X-API-Key: $CHAVE_ADMIN" -H 'Content-Type: application/json' \
  -d '{"modelo":"gpt-5.6-terra","provedor":"openai","vigencia_inicio":"2026-01-01",
       "entrada_por_milhao":"1.25","saida_por_milhao":"10.00","cache_leitura_por_milhao":"0.125"}'
```

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
