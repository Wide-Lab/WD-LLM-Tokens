# Backend — Controle de Tokens

FastAPI + SQLAlchemy async + Alembic + Postgres, gerenciado com `uv`. Contratos em
[`../.claude/docs/api.md`](../.claude/docs/api.md) e [`../.claude/docs/modelo-de-dados.md`](../.claude/docs/modelo-de-dados.md).

## Estrutura

```
app/
  api/        router raiz (/v1) e as dependencies de autenticação
  core/       config, exceções, logging, período
  db/         Base declarativa, engine, sessão e a UnitOfWork (a transação do request)
  modules/
    llm/          registro_llm: ingestão, listagem e métricas de chamada ao LLM
    whatsapp/     registro_mensagem: ingestão, listagem e métricas de mensagem
    precos/       preco_modelo e preco_mensagem: preço com vigência e as expressões de custo
    consolidado/  modelo de leitura: soma o custo das duas origens (nenhuma tabela é dele)
    acesso/       usuario e chave_api: login, sessão, cadastro e emissão de chave
```

Cada módulo é `api / application / domain / infra`: a rota traduz HTTP, o serviço orquestra, o
domínio guarda as regras e o `infra` fala com o banco.

Import de módulo a módulo, só quatro, todos na mesma direção:

- `llm/infra/{repository,projecao}.py` → `precos/infra/custo.py` — a fórmula do custo vive num
  lugar só, e é usada na listagem, na agregação e na projeção.
- `whatsapp/infra/{repository,projecao}.py` → `precos/infra/custo_mensagem.py` — o mesmo motivo, a
  outra fórmula. Dinheiro mora no `precos`, e não dentro de cada módulo de fato.
- `consolidado/infra/repository.py` → `llm/infra/projecao.py`, `whatsapp/infra/projecao.py` — uma
  função por origem, e é toda a superfície que a soma enxerga. (Ele também pega a `MOEDA_PADRAO`
  no `precos`: é a mesma constante que as duas origens já usam, e é justamente isso que torna as
  duas somas somáveis.)
- `api/dependencies.py` → `acesso/{infra,application,domain}` — autenticação é transversal e já
  morava ali. Depende do `acesso` por dentro (sessão, serviço, entidade) e nunca pela `api`
  dele, que é justamente quem importa `api/dependencies.py` de volta.

**Ninguém importa o `consolidado`.** Ele é folha do grafo, e é isso que impede a soma de virar
dependência de quem produz os números — dá para deletá-lo sem mexer em nada. Uma terceira origem
(transcrição, TTS) é um `projecao.py` a mais, e não uma reescrita do painel.

`core/` não conta como import de módulo a módulo: é a casa do transversal, e é onde mora o que os
módulos precisam acertar **igual**.

- `core/periodo.py` — o `Intervalo` (`dia`/`semana`/`mes`) e a janela de datas: `ate` é o dia
  inteiro, e duas cópias dessa regra divergiriam no dia em que alguém mexesse numa. O sintoma
  seria um total que não bate por um dia, que é o tipo de erro que ninguém vê.
- `core/lancamento.py` — o vocabulário do lançamento: as colunas fixas que as duas projeções
  devolvem e o `FiltroComum` (`de`, `ate`, `aplicacao`, `ator`) que vai igual para as duas.

O `Filtro` de cada módulo continua no módulo: o do LLM tem `modelo`, o do WhatsApp tem `categoria`,
`pais` e `direcao` — e nenhum dos dois atravessa para o consolidado, porque um filtro que só existe
de um lado, aplicado à soma dos dois, produz um total que parece completo e não é.

## Transações

Uma transação por request, na `UnitOfWork` de `db/uow.py`. A rota recebe `UowDep`, monta o serviço
com ela, e **ninguém chama `commit`**: sai limpo, o `__aexit__` grava; sobe exceção, ele desfaz.
Antes eram oito `session.commit()` espalhados pelos serviços, e cada operação nova tinha que
lembrar de repetir.

Os repositórios continuam recebendo `AsyncSession` (`Repo(uow.session)`) — quem fala com o banco
não precisa saber quando a transação fecha.

A UoW **não guarda repositório**. A versão de manual expõe `uow.usuarios`, `uow.precos`, e isso
faria de `db/uow.py` o lugar que importa todos os módulos de uma vez, justo aqui onde os imports
que cruzam módulo são contados a dedo.

Uma exceção, em `ChaveApiService.autenticar`: o carimbo de `ultimo_uso_em` abre a própria
`UnitOfWork()`. Ele é fato sobre a chave, não sobre a operação que ela autorizou — na transação do
request, um `GET` que terminasse em `404` levaria o carimbo junto no rollback.

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

## Consolidado

O custo das duas origens somado, no banco:

```bash
curl -H "X-API-Key: $CHAVE_LEITURA" \
  'localhost:8000/api/v1/consolidado/metricas?grupo=origem&intervalo=dia&de=2026-07-01&ate=2026-07-28'
```

`grupo` é `origem`, `aplicacao` ou `ator` — só as três dimensões que existem dos dois lados. A
resposta tem `lancamentos`, `custo` e `moeda`, e mais nada: token não soma com mensagem, então
volume fica em cada painel de origem.

`GET /v1/aplicacoes` sai daqui também, unindo as duas tabelas: uma aplicação que só reportou
WhatsApp precisa aparecer no dropdown do painel. `GET /v1/llm/aplicacoes` deixou de existir.

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
