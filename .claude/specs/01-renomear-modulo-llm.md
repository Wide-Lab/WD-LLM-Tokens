# Etapa 1 — `uso` vira `llm`

## Objetivo

O módulo `uso` já *é* o módulo do LLM — "uso" só parecia genérico enquanto era o único. Com um
segundo tipo de fato chegando, o nome passa a mentir: `whatsapp` também é uso. Esta etapa é
renomeação e roteamento, **sem mudança de comportamento**.

Fazer isso agora, e não depois, é o barato: a tabela tem pouco dado e um consumidor conhecido.

## Backend

### Módulo

`backend/app/modules/uso/` → `backend/app/modules/llm/`, com os quatro subpacotes intactos.

| Antes | Depois |
|---|---|
| `UsoService` | `LlmService` |
| `RegistroUsoRepository` | `RegistroLlmRepository` |
| `entities.RegistroUso` | `entities.RegistroLlm` |
| `models.RegistroUso` | `models.RegistroLlm` |
| `models.RegistroUso as RegistroUsoRow` | `models.RegistroLlm as RegistroLlmRow` |
| `__tablename__ = "registro_uso"` | `__tablename__ = "registro_llm"` |
| `APIRouter(tags=["uso"])` | `APIRouter(tags=["llm"])` |

`NovoRegistro`, `Filtro`, `Grupo`, `Intervalo`, `Balde`, `Ingestao` e `Pagina` ficam com o nome
que têm — são genéricos de propósito e o módulo já os qualifica.

Nomes de índice no `__table_args__` acompanham: `uq_registro_llm_aplicacao_id_externo`,
`ix_registro_llm_aplicacao_criado`, `ix_registro_llm_aplicacao_ator_criado`,
`ix_registro_llm_aplicacao_modelo_criado`.

### Migration `0005_renomear_registro_llm`

Renomear a tabela **e os índices**. O Postgres mantém os índices funcionando depois de um
`RENAME TABLE`, então isso não é cosmético por acaso: sem renomear, `alembic check` acusa
divergência entre os models e o banco para sempre.

```python
def upgrade() -> None:
    op.rename_table("registro_uso", "registro_llm")
    for antigo, novo in _INDICES:
        op.execute(f'ALTER INDEX "{antigo}" RENAME TO "{novo}"')
    op.execute('ALTER TABLE "registro_llm" RENAME CONSTRAINT "registro_uso_pkey" TO "registro_llm_pkey"')
```

Os quatro índices são os criados em `0001`. O `downgrade` desfaz na ordem inversa. A PK herda o
nome automático `registro_uso_pkey` da `0001` (que não o declarou); renomeá-la é higiene, não
requisito — nada no código a referencia por nome.

O `ON CONFLICT` do repositório infere o índice pelas colunas e pelo predicado, não pelo nome:
continua funcionando sem tocar em nada.

### Rotas

`app/api/routes.py` monta o router do LLM **duas vezes**:

```python
api.include_router(llm_router, prefix="/llm")
api.include_router(llm_router, include_in_schema=False)  # legado, ver abaixo
```

| Canônico | Legado (mantido) |
|---|---|
| `POST /v1/llm/eventos` | `POST /v1/eventos` |
| `GET /v1/llm/eventos` | `GET /v1/eventos` |
| `GET /v1/llm/metricas` | `GET /v1/metricas` |
| `GET /v1/llm/aplicacoes` | `GET /v1/aplicacoes` |
| `GET /v1/llm/modelos` | `GET /v1/modelos` |

O legado existe porque há aplicação em produção reportando para `POST /v1/eventos` e um painel
chamando `GET /v1/metricas`. Virar a chave dos dois no mesmo dia é risco sem contrapartida:
custa uma linha manter os dois caminhos vivos.

`include_in_schema=False` no legado deixa o `/api/docs` com uma rota de cada — a lista dobrada
seria o tipo de ruído que faz ninguém mais ler a doc.

> **Nota para a etapa 4:** `GET /v1/aplicacoes` vai **sair** do router de LLM e nascer no
> consolidado, unindo as duas origens. Este alias é temporário por duas etapas.

## Documentos

- `docs/modelo-de-dados.md` — `registro_uso` → `registro_llm` no título da seção, nas
  restrições e no cálculo de custo.
- `docs/api.md` — as rotas canônicas passam a ser `/v1/llm/*`, com uma linha dizendo que os
  caminhos sem prefixo continuam valendo e por quê.
- `backend/README.md` — a estrutura (`uso/` → `llm/`) e o import cruzado.
- `CLAUDE.md` — a frase que lista os módulos (`uso` (o que aconteceu), ...).

## Fora de escopo

O frontend **não muda nesta etapa**. Ele continua chamando `/v1/metricas` e `/v1/eventos`, que
seguem funcionando pelo alias; a virada acontece na etapa 5, junto com a reorganização das rotas
do painel. É isso que deixa esta etapa ser revertida com um `git revert` limpo se algo
surpreender.

## Critérios de pronto

- `uv run alembic upgrade head` e depois `uv run alembic check` sem divergência.
- `uv run alembic downgrade -1` volta para `registro_uso` com os índices de nome antigo, e
  `upgrade head` de novo funciona.
- `uv run ruff check .` e `uv run mypy app` limpos. Nenhuma ocorrência de `registro_uso` ou
  `modules.uso` no `backend/app`.
- O painel, sem nenhuma alteração, continua carregando os KPIs e os gráficos.
- `POST /v1/eventos` e `POST /v1/llm/eventos` gravam na mesma tabela, e o segundo `POST` do
  mesmo `id_externo` devolve `duplicado: true` pelos dois caminhos.
- `/api/docs` lista `/v1/llm/*` e não lista os caminhos legados.
