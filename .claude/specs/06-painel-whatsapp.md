# Etapa 6 — o painel de WhatsApp

## Objetivo

As duas telas da segunda origem: `/whatsapp` (métricas) e `/whatsapp/mensagens` (lista crua).
Estruturalmente é o painel de LLM com outro vocabulário — reaproveitar `PainelCard`,
`GlobalFilters`, `EmptyState` e `conversa.tsx`, e **não** clonar arquivo.

## `/whatsapp`

Consome `GET /v1/whatsapp/metricas`, com `<GlobalFilters>` mais os controles próprios em
`children`: **Categoria** (select de quatro valores fixos, sem ida ao banco) e **Direção**.

### Cards

| Card | Origem |
|---|---|
| Mensagens | `mensagens` do balde total |
| Cobráveis | `cobraveis`, com a fração em cima (`84 de 120 · 70%`) |
| Custo | `custo` + `moeda` |
| Custo por mensagem cobrável | `custo / cobraveis`, ou `—` quando `cobraveis = 0` |

A fração de cobráveis é o número mais informativo da tela: é quanto do atendimento cai fora da
janela gratuita, e é o que se mexe para gastar menos. Merece o segundo lugar, não um rodapé.

Divisão por zero: `cobraveis = 0` mostra `—`, nunca `0` — o mesmo raciocínio de `custo: null`
contra `custo: 0`.

### Gráficos

- **Custo ao longo do tempo** — linha, `intervalo=<granularidade>`, na cor de custo do painel.
- **Mensagens ao longo do tempo** — barras empilhadas por categoria
  (`grupo=categoria&intervalo=…`), usando `pivotarPorGrupo` da etapa 5.
- **Custo por categoria** — rosca, `grupo=categoria`, filtrando os que somam zero.
- **Atores por custo** — barras horizontais, 10 maiores, `grupo=ator`.
- **Custo por país** — só renderiza se houver mais de um país no período, do jeito que
  `UsoPorAplicacao` já faz com aplicação hoje. Com um país só, o gráfico é uma barra que não
  ensina nada.

Cores das categorias: quatro tons fixos, `service` sempre no tom mais apagado da rampa — é a
categoria que não custa, e a cor deve dizer isso antes da legenda.

## `/whatsapp/mensagens`

`GET /v1/whatsapp/mensagens`, paginada, nos moldes de `/llm/eventos`.

Colunas: data/hora, ator, direção, categoria, país, cobrável, custo, e o começo de `conteudo`.
Linha clicável abre o conteúdo inteiro.

- Mensagem **recebida** e mensagem **enviada** precisam ser distinguíveis de relance — é uma
  conversa, e `direcao` é a única coisa que diz quem falou. Reaproveitar o tratamento de
  `conversa.tsx`, que já resolve isso para o par mensagem/resposta do LLM.
- `cobravel = false` merece marcação discreta ("grátis"), não um `0,00` competindo visualmente
  com os valores reais.
- `custo: null` (cobrável sem preço cadastrado) aparece como `—` com `title` explicando que falta
  preço para aquele país e categoria. É o caminho pelo qual alguém descobre que precisa cadastrar
  um preço, então precisa ser legível, não silencioso.
- `conteudo: null` é "não veio no evento", como no LLM.

## Tipos

`src/lib/api-types.ts`:

```ts
export interface MensagemBucket {
  grupo?: string; periodo?: string;
  mensagens: number; cobraveis: number;
  custo: number | null; moeda: string;
}

export interface MensagemItem {
  id: string; criado_em: string;
  aplicacao: string; ator: string;
  direcao: "enviada" | "recebida";
  categoria: "marketing" | "utility" | "authentication" | "service" | null;
  pais: string; cobravel: boolean;
  custo: number | null; moeda: string;
  id_externo: string | null; conteudo: string | null;
  metadados: Record<string, unknown>;
}

export interface MensagensResponse { total: number; limite: number; offset: number; itens: MensagemItem[]; }
```

## Critérios de pronto

- Os quatro cards batem com o balde sem `grupo` da API; a fração de cobráveis confere na mão.
- `cobraveis = 0` mostra `—` no custo por mensagem, não `NaN` nem `Infinity`.
- Filtrar por categoria e direção recorta todos os gráficos da tela, não só um.
- Um período sem mensagem nenhuma mostra `EmptyState` em vez de eixos vazios.
- Mensagem cobrável sem preço cadastrado aparece com `—` e a explicação no `title`.
- A soma do custo de `/whatsapp` no período bate com a fatia `whatsapp` de `/` no mesmo período.
- `bun run build` e `bun run lint` limpos.
