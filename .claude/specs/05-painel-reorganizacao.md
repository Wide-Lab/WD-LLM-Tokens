# Etapa 5 — o painel ganha três seções

## Objetivo

Abrir espaço no frontend para a segunda origem: `/` passa a ser o consolidado, o painel de hoje
desce inteiro para `/llm`, e o menu deixa de dizer que este é um painel de LLM. **Nenhum gráfico
novo de WhatsApp aqui** — isso é a etapa 6. Esta é a mudança estrutural, e vale a pena que ela
caiba num commit que se lê de uma vez.

## Rotas

TanStack Start usa roteamento por arquivo (`src/routes/README.md`). Mover, não recriar:

| Antes | Depois | `createFileRoute` |
|---|---|---|
| `routes/index.tsx` | `routes/llm/index.tsx` | `"/llm/"` |
| `routes/eventos/index.tsx` | `routes/llm/eventos/index.tsx` | `"/llm/eventos/"` |
| `routes/eventos/$ator.tsx` | `routes/llm/eventos/$ator.tsx` | `"/llm/eventos/$ator"` |
| — | `routes/index.tsx` (novo) | `"/"` |

`routeTree.gen.ts` é gerado — não editar à mão. Os `<Link to=...>` internos da lista de eventos
para o detalhe do ator precisam acompanhar o prefixo.

## Cliente da API

`src/lib/api.ts` não muda (base relativa, cookie de mesma origem). Mudam as chamadas:

| Antes | Depois |
|---|---|
| `/v1/metricas` | `/v1/llm/metricas` |
| `/v1/eventos` | `/v1/llm/eventos` |
| `/v1/modelos` | `/v1/llm/modelos` |
| `/v1/aplicacoes` | `/v1/aplicacoes` (inalterado — mudou de dono no backend, não de caminho) |

É aqui que o alias legado da etapa 1 para de servir ao painel. Ele continua vivo para os apps
que reportam por `POST /v1/eventos` — e é por isso que não sai agora.

## Filtros

`src/lib/filters.tsx`: `modelo` **sai** do filtro global. Ele não existe no consolidado nem no
WhatsApp, e mandar `modelo=` para um endpoint que o ignora é um controle que parece filtrar e não
filtra.

```ts
filtersToParams(f) → { de, ate, aplicacao, ator }   // o que as três telas têm em comum
```

`modelo` continua no estado do contexto (é conveniente que sobreviva à navegação), mas quem o
manda para a API é só o painel de LLM: `{ ...base, modelo: filters.modelo || undefined }`.

`<GlobalFilters>` passa a aceitar `children`, renderizados no fim do grupo à direita — é onde
cada painel pendura o controle que é só dele. O de `Modelo` migra para dentro do `/llm`.

## Barra lateral

`app-sidebar.tsx`, três grupos no lugar da lista única:

| Grupo | Itens |
|---|---|
| — | Visão geral (`/`) |
| LLM | Painel (`/llm`), Eventos (`/llm/eventos`) |
| WhatsApp | Painel (`/whatsapp`), Mensagens (`/whatsapp/mensagens`) |

Os dois itens de WhatsApp entram já apontando para as rotas da etapa 6 — que ainda não existem.
Ou a etapa 6 vem no mesmo dia, ou entram nesta etapa como stubs com um `EmptyState`. Preferir o
stub a um link quebrado.

`isActive` hoje é `currentPath === item.url`, o que não marca o pai quando se está no filho. Com
rotas aninhadas isso passa a incomodar: usar `startsWith`, com o cuidado de `/` casar só exato.

Identidade: "Painel LLM" / "Tokens e custo" no cabeçalho da sidebar vira algo que cubra os dois —
**"Painel de custos" / "LLM e WhatsApp"**. O mesmo vale para os `head.meta` das rotas movidas e
para o `title` em `__root.tsx` (conferir).

## A tela `/` (consolidado)

Consome `GET /v1/consolidado/metricas`. Só dinheiro — a regra da etapa 4 vale igual na tela.

- **Cards de KPI:** custo total, custo LLM, custo WhatsApp, lançamentos. Sem medidor de baldes: o
  `Medidor` mostra os quatro baldes de token e é do painel de LLM.
- **Custo ao longo do tempo**, barras empilhadas por origem (`grupo=origem&intervalo=<granularidade>`).
- **Custo por aplicação**, barras empilhadas por origem (`grupo=aplicacao`).
- **Atores por custo**, 10 maiores, barras horizontais empilhadas por origem (`grupo=ator`).

Os três gráficos precisam pivotar `[{grupo, periodo, custo}]` em linhas com uma coluna por
origem. Isso não existe hoje (o painel atual nunca desenhou mais de uma série), então entra em
`src/lib/grafico.ts`:

```ts
pivotarPorGrupo(baldes, eixo: "periodo" | "grupo") → Array<Record<string, number | string>>
```

Cores: LLM na cor de custo já usada (`var(--custo)`); WhatsApp numa segunda cor fixa da rampa. As
duas origens têm de ter **sempre** a mesma cor em toda a tela — é o que permite ler os três
gráficos sem consultar a legenda de cada um.

Estado vazio: com uma origem só reportando, os empilhados viram barra única e está certo. O
`EmptyState` só aparece quando não há nada no período.

## Fora de escopo

`src/lib/api-types.ts` ganha `ConsolidadoBucket`. Os tipos de WhatsApp entram na etapa 6.

## Critérios de pronto

- `bun run build` passa; `routeTree.gen.ts` regenerado e commitado se o repo o versiona.
- `/llm` mostra exatamente o que `/` mostrava antes, com os mesmos números.
- `/llm/eventos` lista e `/llm/eventos/<ator>` abre o detalhe, com os links internos certos.
- Trocar de painel preserva período, aplicação e ator; o controle de modelo só aparece em `/llm`.
- Nenhuma chamada a `/v1/metricas` ou `/v1/eventos` sai do browser (conferir no DevTools).
- Item da sidebar fica marcado quando se está numa rota filha.
- Nenhum "Painel LLM" sobrou na interface nem no `<title>`.
