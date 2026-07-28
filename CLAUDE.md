# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Regras do repositório

- **Commit a cada etapa implementada.** Terminou uma etapa, faz o commit — não acumule várias etapas num commit só.
- **Sem coautoria na mensagem do commit.** Nada de `Co-Authored-By` ou linha de sessão; só a mensagem.
- Código, comentários, nomes e docs em **português** — é a convenção do projeto inteiro.

Não há suíte de testes automatizados no projeto.

## Arquitetura

Serviço genérico de contabilidade de tokens de LLM. Várias aplicações reportam para cá, identificadas pelo campo `aplicacao`.

- **Ingestão append-only:** `POST /api/v1/llm/eventos` (uma linha por chamada ao LLM) e `POST /api/v1/whatsapp/mensagens` (uma linha por mensagem), fire-and-forget. Nunca `UPDATE`, nunca delete. Idempotência por `unique (aplicacao, id_externo)` — no WhatsApp o `id_externo` é o `wamid`. Os caminhos de LLM sem o prefixo `/llm` continuam valendo como legado.
- **Custo não vem no evento.** `preco_modelo` e `preco_mensagem` guardam preço com vigência e o custo é calculado **na leitura**, pelo preço válido na data. As fórmulas vivem só em `precos/infra/custo.py` e `precos/infra/custo_mensagem.py`. No WhatsApp, quem decide se a mensagem é cobrável é a Meta (`pricing.billable`): a gente copia, não recalcula.
- **Métricas por `GROUP BY` em tempo de consulta** — volume baixo, sem rollup nem cache.

Backend em `backend/app/modules/<módulo>/{api,application,domain,infra}`: `llm` e `whatsapp` (o que aconteceu), `precos` (quanto custa), `acesso` (quem entra). A rota traduz HTTP, o serviço orquestra, o domínio tem as regras, o `infra` fala com o banco. Só três imports cruzam módulos, todos documentados em `backend/README.md` — mantenha assim. O que os dois módulos de fato compartilham de vocabulário de período (`Intervalo`, janela de datas) mora em `app/core/periodo.py`; `core` não conta como import cruzado. Módulo novo = uma linha em `app/api/routes.py`.

O prefixo `/api` faz parte das rotas **no FastAPI** (`create_app` monta em `/api/v1`), não é reescrita do nginx. Vale igual no dev local.

Autenticação em duas vias: `X-API-Key` para máquina (uma chave de escrita por app — recusa evento de `aplicacao` que não seja a dona da chave —, uma de leitura, uma de admin) e cookie `HttpOnly` de sessão para gente. **Nenhum segredo no browser**: o painel não usa API key, chama `/api` na própria origem e o cookie viaja sozinho (`frontend/src/lib/api.ts`). Não existe tela de cadastro — usuário, preço e chave nascem por `CHAVE_ADMIN`.

As chaves de escrita e leitura são emitidas em `POST /v1/chaves` e ficam em `chave_api` (só o SHA-256; o segredo aparece uma vez na resposta). As de variável de ambiente continuam valendo em paralelo — ambiente primeiro, banco depois. A `CHAVE_ADMIN` não migrou: é a que emite e revoga as outras.

Frontend: TanStack Start + React 19 + Tailwind 4 + shadcn/ui. Rotas em `src/routes/`, `src/components/ui/` é shadcn (não edite à mão sem motivo). O `vite.config.ts` lista os plugins na mão (tailwind, tsconfig-paths, tanstackStart, nitro no build, react) — o nitro só entra no `build` e sai com preset `node-server`, que é o que o container roda.

## Documentos

- `.claude/docs/modelo-de-dados.md` — tabelas, os quatro baldes de token (não se sobrepõem), cálculo de custo
- `.claude/docs/api.md` — contratos, autenticação, erros
- `backend/README.md` — estrutura, dev local, migrations
