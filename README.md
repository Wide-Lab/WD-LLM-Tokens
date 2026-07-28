# Controle de Tokens

Serviço genérico para administrar o uso de tokens de LLM: registra cada chamada
(tokens de entrada, saída e cache, modelo, quem consumiu, aplicação) e expõe
métricas agregadas para um painel.

Não é específico de nenhum produto — várias aplicações reportam para o mesmo
serviço, identificadas pelo campo `aplicacao`.

## Como funciona (visão de 30 segundos)

- **Escrita (ingestão):** cada aplicação de IA, depois de uma chamada ao LLM,
  dispara um `POST /v1/eventos` *fire-and-forget* com o que gastou. A tabela é
  append-only: nunca faz `UPDATE`, nunca apaga.
- **Leitura (painel):** as métricas saem de agregação em tempo de consulta
  (`GROUP BY`). Com o volume esperado (~50 req/dia) isso sobra — sem rollup,
  sem cache de agregação.
- **Custo:** o evento **não** manda custo. Existe uma tabela de preços central
  com vigência; o custo é calculado na leitura pelo preço válido na data da
  chamada.

## Decisões travadas

| Decisão | Escolha |
|---|---|
| Preço | Tabela central `preco_modelo` com vigência; custo calculado na leitura |
| Multi-aplicação | Sim, desde o início (campo `aplicacao`) |
| Ingestão | App de IA dispara `POST` por chamada, fire-and-forget |
| Idempotência | `unique (aplicacao, id_externo)` |
| Volume | ~50 req/dia → agregação em tempo de leitura basta |
| Auth (máquina) | `X-API-Key`: uma chave de escrita por app, uma de leitura, uma de admin |
| Auth (gente) | Login com e-mail e senha; cookie `HttpOnly` de sessão, nenhum segredo no browser |
| Moeda | USD única em todas as linhas de preço no v1; câmbio só na exibição |

## Monorepo

```
backend/    FastAPI + SQLAlchemy async + Alembic + Postgres, gerenciado com uv
frontend/   o painel (TanStack Start, gerado no Lovable)
nginx/      o proxy de borda: / vai pro painel, /api/ vai pra API
docs/       modelo de dados e contratos da API
```

O backend é organizado por módulo (`app/modules/<módulo>/{api,application,domain,infra}`) —
três módulos: `uso` (o que aconteceu), `precos` (quanto custa) e `acesso` (quem entra).
Detalhes em [`backend/README.md`](backend/README.md).

## Como rodar

```bash
cp .env.example .env      # ajuste as chaves e gere o SEGREDO_SESSAO
docker compose up -d --build
```

Sobe em `http://localhost:$PORT`: o painel na raiz, a API sob `/api` (a doc do FastAPI em
`/api/docs`). O prefixo `/api` chega inteiro no backend — o nginx repassa a URI como veio, e o
FastAPI monta as rotas em `/api/v1/...`. O painel não tem nada a configurar: ele chama `/api` na
própria origem.

### O primeiro login

Não existe tela de cadastro — o painel está exposto, e uma tela dessas aberta seria a porta que
o login veio fechar. O primeiro usuário nasce pela `CHAVE_ADMIN`:

```bash
curl -X POST localhost:$PORT/api/v1/usuarios \
  -H "X-API-Key: $CHAVE_ADMIN" -H 'Content-Type: application/json' \
  -d '{"email":"voce@empresa.com","nome":"Seu Nome","senha":"uma-senha-longa-de-verdade"}'
```

Daí em diante é e-mail e senha na tela de login. Para tirar alguém, `ativo = false` na tabela
`usuario` derruba a sessão no request seguinte.

Para mexer só no backend, ver [`backend/README.md`](backend/README.md).

## Documentos

- [`docs/modelo-de-dados.md`](docs/modelo-de-dados.md) — tabelas, contabilidade de tokens, cálculo de custo
- [`docs/api.md`](docs/api.md) — contratos dos endpoints, autenticação, CORS, erros
- [`backend/README.md`](backend/README.md) — estrutura, dev local, migrations
- [`PROMPT-LOVABLE.md`](PROMPT-LOVABLE.md) — prompt pronto para gerar o frontend no Lovable
