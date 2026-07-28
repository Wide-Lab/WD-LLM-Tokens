# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Regras do repositório

- **Commit a cada etapa implementada.** Terminou uma etapa, faz o commit — não acumule várias etapas num commit só.
- **Sem coautoria na mensagem do commit.** Nada de `Co-Authored-By` ou linha de sessão; só a mensagem.
- Não reescreva histórico já publicado (force push, rebase/amend/squash de commits pushados): o repo é sincronizado com o Lovable e isso quebra o histórico lá.
- Código, comentários, nomes e docs em **português** — é a convenção do projeto inteiro.

Não há suíte de testes automatizados no projeto.

## Arquitetura

Serviço genérico de contabilidade de tokens de LLM. Várias aplicações reportam para cá, identificadas pelo campo `aplicacao`.

- **Ingestão append-only:** `POST /api/v1/eventos` fire-and-forget, uma linha por chamada ao LLM. Nunca `UPDATE`, nunca delete. Idempotência por `unique (aplicacao, id_externo)`.
- **Custo não vem no evento.** A tabela `preco_modelo` guarda preço com vigência e o custo é calculado **na leitura**, pelo preço válido na data da chamada. A fórmula vive só em `precos/infra/custo.py`.
- **Métricas por `GROUP BY` em tempo de consulta** — volume baixo, sem rollup nem cache.

Backend em `backend/app/modules/<módulo>/{api,application,domain,infra}`: `uso` (o que aconteceu), `precos` (quanto custa), `acesso` (quem entra). A rota traduz HTTP, o serviço orquestra, o domínio tem as regras, o `infra` fala com o banco. Só dois imports cruzam módulos, ambos documentados em `backend/README.md` — mantenha assim. Módulo novo = uma linha em `app/api/routes.py`.

O prefixo `/api` faz parte das rotas **no FastAPI** (`create_app` monta em `/api/v1`), não é reescrita do nginx. Vale igual no dev local.

Autenticação em duas vias: `X-API-Key` para máquina (uma chave de escrita por app — recusa evento de `aplicacao` que não seja a dona da chave —, uma de leitura, uma de admin) e cookie `HttpOnly` de sessão para gente. **Nenhum segredo no browser**: o painel não usa API key, chama `/api` na própria origem e o cookie viaja sozinho (`frontend/src/lib/api.ts`). Não existe tela de cadastro — usuário e preço nascem por `CHAVE_ADMIN`.

Frontend: TanStack Start + React 19 + Tailwind 4 + shadcn/ui, gerado no Lovable. Rotas em `src/routes/`, `src/components/ui/` é shadcn (não edite à mão sem motivo). `vite.config.ts` usa `@lovable.dev/vite-tanstack-config`, que já inclui os plugins — adicionar plugin manualmente duplica e quebra o app.

## Documentos

- `docs/modelo-de-dados.md` — tabelas, os quatro baldes de token (não se sobrepõem), cálculo de custo
- `docs/api.md` — contratos, autenticação, erros
- `backend/README.md` — estrutura, dev local, migrations
