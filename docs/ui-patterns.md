Status: target

# Padrões de UI

O design system é o **wide-ui**, e ele é a fonte da verdade: pacote em
`~/.claude/plugins/marketplaces/widelab/design-systems/wide-ui` (`README.md`, `foundations.md`,
`components.md`, `patterns.md`). Este documento não repete o wide-ui. Lista só o que o painel
acrescenta ou sobrescreve, e cada exceção diz por quê. O que não está aqui segue o pacote.

Os arquivos do pacote copiados para o projeto ficam em `frontend/src/styles/wide-ui/`
(`tokens.css`, `tailwind-v4.css` e `accent.ts`, cópia tipada do `accent.js`). Não se edita valor
neles: muda no pacote e copia de novo (o `accent.ts` se reescreve à mão a partir do `.js`). O que
é do projeto fica em `frontend/src/styles.css` e `frontend/src/lib/grafico.ts`.

## Tokens e a sobrescrita do `muted`

- As variáveis do shadcn (`--background`, `--primary`, `--border`...) apontam para os `--wu-*` em
  `styles.css`, uma vez só, sem bloco escuro: os `--wu-*` já trocam com o tema.
- **`muted` é fundo, não texto.** No wide-ui `text-muted` é texto secundário; no shadcn `muted` é
  fundo apagado. O shadcn vence, porque os componentes de `components/ui/` dependem desse sentido.
  Texto secundário é `text-muted-foreground`. O comentário de `styles/wide-ui/tailwind-v4.css` lista
  `text-muted` entre os utilitários, e o `components.md` chama de `muted` a cor de texto secundário
  ("13 `muted`"); aqui isso vira `text-muted-foreground`. O eslint barra `text-muted`
  (`no-restricted-syntax` em `frontend/eslint.config.js`).
- `--muted` = `--wu-sel`, que tem alfa, então não aceita `/opacidade` (`bg-muted/50` some). Fundo
  apagado de linha é `bg-raised`; separador é `bg-border`.
- `--accent` = `--wu-sel`, e não `--wu-hover`: o shadcn usa `bg-accent` no item com foco de teclado
  dos menus, e em `hover` ele some (1.08:1).
- `--destructive-foreground` = `--wu-surface`: no escuro o `danger` é um vermelho claro e pede
  texto escuro.
- Raio: `rounded-md/lg/xl` viram 8px (`--wu-radius`) e `rounded-sm` 6px, porque o shadcn usa os
  três tamanhos para as mesmas peças.
- Foco: contorno de 2px no accent em todo controle, fora de `@layer` (vence o
  `focus-visible:outline-none` de vários componentes do shadcn).
- A única cópia de valor fora do `tokens.css` é `lib/error-page.ts`, a página de falha do servidor:
  é HTML cru, sem o CSS do app, então repete à mão os valores claro e escuro e o `#E30D4D`. Mudou
  token ou marca, mude lá também.

## Tema e accent

- Tema por `data-theme` (lido pelos tokens do wide-ui) **e** classe `dark` (lida pela variante
  `dark:` do shadcn). `SCRIPT_DO_TEMA` (`lib/theme.tsx`) grava os dois inline no `<head>`, antes da
  primeira pintura. Sem escolha salva, o painel segue o sistema.
- Accent = magenta do logo, `COR_DA_MARCA` = `#E30D4D` (`lib/marca.ts`). No SSR sai no `style` do
  `<html>` por `variaveisDaMarca`; no cliente, `applyAccent` no boot (`routes/__root.tsx`).

## Cor de dado e semântica

Toda cor de dado tem papel fixo. Os valores estão em `styles.css` (sempre um `--wu-*` ou mistura
de `fg` com `surface`, nenhuma cor nova); os papéis estão em `lib/grafico.ts`, menos os baldes
(`BALDES`, em `components/medidor.tsx`, porque medidor e conversa desenham a mesma fita).
Componente nenhum escolhe cor de dado por conta própria.

| Papel | Token | Valor | Onde |
| --- | --- | --- | --- |
| LLM | `--origem-llm` | `--wu-c1` | `ORIGENS` |
| WhatsApp | `--origem-whatsapp` | `--wu-c2` | `ORIGENS` |
| Marketing | `--categoria-marketing` | `--wu-c1` | `CATEGORIAS` |
| Utility | `--categoria-utility` | `--wu-c3` | `CATEGORIAS` |
| Authentication | `--categoria-authentication` | `--wu-c4` | `CATEGORIAS` |
| Service | `--categoria-service` | `--wu-c5` | `CATEGORIAS` |
| Sem categoria (recebidas) | `--categoria-nenhuma` | `fg` 45% (claro) / 62% (escuro) | `SERIES_DE_CATEGORIA` |
| Fatia "Outros" | `--serie-outros` | = `--categoria-nenhuma` | `OUTROS` |
| Baldes de token | `--balde-entrada`, `-saida`, `-cache-leitura`, `-cache-escrita` | `fg` 100/68/54/43% | `BALDES` (`components/medidor.tsx`) |
| Recebida / enviada | `--balde-entrada` / `--balde-saida` | | `DIRECOES` |
| Fatias sem papel (rosca por modelo) | `--wu-c1`..`--wu-c5` em ordem | | `SERIES` |

- **LLM = c1, WhatsApp = c2 no painel inteiro**, inclusive nos gráficos de custo dentro de cada
  origem. É o que deixa ler um quadro sem voltar à legenda de outro.
- **Categorias pulam c2**, que é do WhatsApp. Marketing repetir a cor do LLM é aceito: categoria só
  aparece dentro do painel WhatsApp, onde o LLM não está.
- **`service` = c5**, a série mais apagada (cinza-azulada): é a única que a Meta não cobra.
- **Sem categoria é neutro, não série**: mensagem recebida não tem categoria nem custo. É o único
  token com bloco escuro próprio (`:root[data-theme="dark"]`), porque a 45% no escuro ficaria a
  3.52:1, colado em c5 (3.76:1). Contraste contra `surface`: 3.30:1 claro, 5.86:1 escuro.
- **Baldes de token em rampa neutra**, de `fg` (entrada) ao cinza (cache escrita), por
  `color-mix(in oklab, ...)` com `surface`. Os quatro somam o todo e nunca se sobrepõem; token não
  pode pegar a cor de uma origem. Caches são os mais apagados porque são a faixa com desconto.
  `oklab` (não `oklch`) para não interpolar matiz. Contraste contra `surface`, claro / escuro:
  17.72 / 15.30, 7.04 / 6.94, 4.40 / 4.64, 3.11 / 3.31.
- **Direções reusam entrada/saída**: o que o cliente falou é o que vira token de entrada do outro
  lado. Mesma pergunta ("quem falou"), mesma cor, nas duas origens.
- **Custo é `fg`.** Valor de KPI é sempre `fg`, ou `danger` no tile de `problema`; o ponto colorido
  antes do rótulo do `Cartao` (`cor`) é a legenda da série, não pinta o número. Só leva ponto o
  número que é uma série com cor nos gráficos da tela (as origens no consolidado).
- Categoria na tabela vai só em texto, sem ponto: a cor dela é de gráfico.

## Tipografia e formatos

- Mono (`font-mono`) só para ID técnico literal (o `wamid` na mensagem aberta) e para o conteúdo
  literal de CSV (textarea e exemplo da importação). Nome de modelo e de país não é mono.
- Dinheiro (`formatCurrency`, `lib/format.ts`): até **4 casas** por padrão (tooltip, tabela), para
  um custo de centavos não sumir. KPI, medidor e legenda passam `{ casas: 2 }`.
- **Exceção: valor unitário** fica com até 4 casas: o KPI "Tarifa média" (`/whatsapp`) e o custo
  por requisição do medidor. São centavos de dólar, e com 2 casas `US$ 0,0068` e `US$ 0,0250`
  viram `US$ 0,01` e `US$ 0,03`.
- Tarifa cadastrada (`formatTarifa`): até 6 casas. Ali o número é o dado.
- Data e hora (`formatDateTime`): `dd/mm/aaaa, HH:mm`. **Exceção: listas de log** (eventos do LLM,
  mensagens do WhatsApp) passam `{ segundos: true }`, porque linhas do mesmo minuto precisam se
  distinguir.
- Porcentagem da rosca com 1 casa (`formatFatia`), contra o `72%` do wide-ui: modelos baratos
  virariam "0%". `porcentagensQueFecham` distribui as casas pelo maior resto para fechar 100%.

## KPI e medidor

- `Cartao` (`components/cartao.tsx`): o valor segue a largura do **próprio tile** (`@container`),
  não a da tela: 18px abaixo de 9.5rem, 22px até 12rem, 28px acima. Exceção ao "28, 22 abaixo de
  700px": com 2 tiles a 390px e 4 logo acima de 1100px (sidebar de 252px) sobram ~140–160px, e
  `US$ 1.284,60` truncaria.
- KPIs em 2 colunas até 1100px, inclusive no celular; o esqueleto da raiz (`routes/__root.tsx`)
  também, para a página não mudar de forma quando os dados chegam.
- Rótulo de KPI cabe no tile a 390 e a 1280 (o `Cartao` trunca): "Tarifa média", não "Custo por
  mensagem cobrável".
- `children` do `Cartao` recebe o que a nota não diz sozinha (a fita de "Cobráveis": `fg` sobre
  trilho `sel`), com esqueleto próprio.
- `Medidor` (`components/medidor.tsx`) substitui a fileira de KPIs em `/llm` e
  `/llm/eventos/$ator`: os quatro baldes somam o total, então a leitura é uma fita, não quatro
  tiles soltos. O valor segue o KPI do wide-ui pela largura da tela (22 abaixo de 700px, 28
  acima), e não pelo tile: a coluna do custo é larga o bastante. A fita cresce uma vez na montagem
  (`.fita-segmento`), a única animação de conteúdo, desligada em `prefers-reduced-motion`.

## Gráficos

Base em `lib/grafico.ts`: `eixo`, `tooltipEstilo`, `legendaEstilo`, `TooltipDoTempo`
(`components/tooltip-do-tempo.tsx`, pilha no tempo com data com ano e total; recebe `formatar`).

- **Legenda com valor** (`legendaComValores`): o valor vem do banco (consulta `grupo=origem`),
  nunca da soma das barras. Em gráfico recortado (10 maiores atores) leva o sufixo "no período".
- **Série única** (atores por custo, custo por aplicação, custo por país): sem legenda; o rótulo
  na ponta da barra (`LabelList` com `rotuloDeValor`, `fg` 12px, 2 casas) é a legenda com valor.
- **Rosca recortada** (custo por modelo): até 5 modelos, um por série. Acima disso, os 4 maiores em
  c1..c4 e "Outros" (`OUTROS`, neutro) = total do período (do banco, consulta sem `grupo`) − soma
  dos 4; se der ≤ 0 a fatia some. O hint diz "4 maiores + outros". Total no centro com
  `rotuloNoCentro`. Legenda **por nome** (`legendaComValores(valores, { por: "nome" })`), porque
  todas as fatias têm o mesmo `dataKey`; cada item mostra `valor · fatia%`.
- **Barra horizontal por ator**: `YAxis` categórico com `interval={0}` (senão o recharts pula
  metade dos rótulos) e `truncarRotulo(v, 15)` para caber a 390px.
- Dentro de cada origem, os gráficos de custo usam a cor dela (`--origem-*`), e não as barras
  neutras com o período atual em `progress` do `components.md`: a cor da origem é o que liga o
  quadro ao consolidado.

## Tabelas e linha clicável

- Abaixo de 700px o cartão inteiro abre, como a linha.
- **Linha clicável** (`/llm/eventos`, `/llm/eventos/$ator`, `/whatsapp/mensagens`, `/precos`):
  ignora o clique se há texto selecionado (`haTextoSelecionado`, `lib/utils.ts`). A linha que
  navega imita o link: Ctrl, ⌘ ou botão do meio abrem em nova aba. O link ou botão da primeira
  célula continua sendo o caminho do teclado (`aria-expanded` quando expande).
- No cartão que abre, clique dentro do conteúdo aberto não fecha o cartão.
- Data não trunca. Se a meta line trunca, a data vai numa linha própria (o "novo preço em
  dd/mm/aaaa" de `/precos`).
- Coluna do botão de abrir conteúdo (`BotaoDeConteudo`) tem cabeçalho `sr-only` "Conteúdo".
- Conteúdo aberto (`Conteudo`, `Conversa`): borda esquerda de 3px na cor de quem falou (balde ou
  direção). Não há filete colorido na linha fechada: a direção já tem o ponto na célula.
- Largura: `max-w` em rem no `<td>` vale, mas é teto fixo, que não cede quando a soma das colunas
  passa da largura (o Conteúdo de mensagens com `max-w-[22rem]` empurrava Data para fora a 1280).
  Serve para coluna de tamanho conhecido (Ator em mensagens, `max-w-[13rem]`, com o `truncate` no
  `div` de dentro). Coluna que deve absorver o resto: `w-full max-w-0 truncate` (Conteúdo em
  mensagens). Teto e piso juntos vão no `div` interno (`max-w-[11rem] min-w-[8rem]` no item de
  preço). Conferir a 1280 que a tabela cabe sem rolagem lateral.
- Paginação: `Paginacao` (`components/paginacao.tsx`).

## Estados

- `PainelCard` tem carregando (esqueleto com a forma), vazio (`VazioNoCartao`, uma linha) e erro
  ("Não foi possível carregar este quadro." + "Tentar de novo" com `onRetry`).
- Estados de página: `ErrorBox` e `EmptyBox` (`components/empty-states.tsx`).
- Quadro que só aparece com mais de um item (custo por país, custo por aplicação) aparece também
  quando a consulta falha, para o erro não sumir junto.
- Lista de log não tem "Atualizar" no cabeçalho nem o "dados de HH:mm" do painel.

## Pílulas de status

`StatusPill` (`components/status-pill.tsx`) recebe o tom (`TomDeStatus`): os seis do wide-ui mais
`danger`. Quem usa passa o tom, nunca uma cor. Não se inventa status: só os abaixo.

| Tela | Estado | Tom |
| --- | --- | --- |
| `/whatsapp/mensagens` | Cobrável | `progress` |
| | Grátis | `neutral` (discreto: a maioria é grátis) |
| | Sem preço (cobrável, `custo: null`) | `pending`, `title` com o preço que falta, repetido na linha aberta |
| `/precos` | Vigente | `done` |
| | Agendado | `progress` |
| | Sem preço vigente (só há preço futuro) | `pending` |
| `/whatsapp/templates` | Aprovado | `done` |
| | Em análise (a Meta ainda não respondeu) | `pending` |
| | Rascunho (o texto ainda é nosso) | `neutral` |
| | Rejeitado | `danger` |
| | Sem preço (cobráveis, `custo: null`) | `pending`, como em `/whatsapp/mensagens` |
| Importação, prévia | Pronta | `neutral` |
| | Com erro | `danger` |
| Importação, resultado | Gravada | `done` |
| | Falhou | `danger` (com o motivo do servidor) |
| | Ignorada | `neutral` |

- `title` não existe no toque nem no teclado: a frase do "Sem preço" também vai na linha aberta.
- Vigência anterior não tem pílula. Vigente + Agendado ficam **empilhadas** na tabela; lado a lado
  forçavam rolagem lateral a 1280.
- `archived` fica fora da importação: é esverdeado e lia como sucesso ao lado de "Gravada".
- Não há status de entrega de mensagem: a API não traz.
- "Modelos sem preço" (modelo em eventos sem tarifa nenhuma) não é pílula: é alerta inline
  `danger-bg` no topo da aba Modelos, condição que bloqueia.

## Formulário e diálogos

- Diálogos de `/precos` (`dialogo-preco.tsx`, `importar-precos.tsx`) são controlados, sem
  `DialogTrigger`. A página guarda `document.activeElement` ao abrir, e `devolverFocoA`
  (`lib/utils.ts`), no `onCloseAutoFocus`, devolve o foco a quem abriu. Se ele saiu da página, fica
  o padrão do Radix.
- `<form noValidate>`: as regras continuam as do navegador (`required`, `min=0`, `step`), mas a
  recusa vira texto em `danger` 12.5 embaixo do campo (`aria-describedby`, `aria-invalid`) e o foco
  vai para o primeiro inválido.
- **409** (vigência repetida) marca o campo de data com o conserto e leva o foco a ele, além do
  alerta do rodapé.
- `mensagemDoErro` (`lib/precos.ts`) traduz o erro do backend: data ISO vira `dd/mm/aaaa`, o 409
  ganha o conserto, rede/401/403/5xx/"Payload inválido." viram frases próprias. Vale para o
  diálogo e para cada linha da importação.
- Sem "(opcional)": a falta do asterisco já diz. Placeholder de número é `0.00`, com ponto, como o
  `type=number` aceita.
- Vocabulário por aba: Modelos fala "preço", Mensagens fala "tarifa" (Novo preço / Nova tarifa,
  Salvar preço / Salvar tarifa). Pílulas de status são iguais nas duas.
- Ação de linha "Novo preço"/"Nova tarifa": ícone `ghost` com `aria-label` e `title`, como no
  wide-ui, mais sempre visível em `@media (hover: none)`. No cartão, botão contornado com rótulo.

## Importação de CSV

`DialogoImportarPrecos` (`components/importar-precos.tsx`), leitor em `lib/csv.ts`. Não há `POST`
em lote: manda uma linha por vez e **pode gravar metade**. Isso aparece em três lugares:

1. nota antes de enviar;
2. progresso "Gravando N de M", numa região `role="status"` que existe desde a prévia;
3. título do resultado (`tituloDoResultado`, "Importação parcial: 5 de 8 linhas gravadas"), que
   recebe o foco; o toast repete a frase. O denominador é o de linhas do arquivo, contando as
   ignoradas.

- Prévia em tabela (cartões abaixo de 700px), na ordem do arquivo: Linha, Preço (tarifas na meta
  line), Desde, Situação. `<table>` direto, sem o wrapper de `ui/table`, com altura máxima e
  cabeçalho fixo dentro do quadro.
- CSV só com cabeçalho mostra "Nenhuma linha abaixo do cabeçalho…", não um "Importar" desabilitado
  mudo.
- Resultado parcial ganha nota `danger-bg`: reimportar só as linhas que falharam ou foram
  ignoradas.

## Shell

- `Moldura` (`components/app-sidebar.tsx`); destinos, trilha e busca saem de `lib/navegacao.ts`
  (`GRUPOS`, `trilhaDaRota`).
- O subtítulo da barra é "LLM e WhatsApp". O "Painel de cobranças / Disparos" foi removido de
  propósito: é marca da NSC.
- **Trilha abaixo de 640px**: só o último passo, prefixado pelo grupo em `subtle` ("LLM · Painel").
  O grupo que é a própria página sai sem link.
- 404 dentro da moldura usa `TRILHA_NAO_ENCONTRADA` ("Página não encontrada"), decidido pelo
  roteador, não pelo prefixo da URL.
- Estados de página do roteador em `components/pagina-de-estado.tsx` (`ErroNaRota` e
  `PaginaNaoEncontrada`, ligados em `router.tsx` como `defaultErrorComponent` e
  `defaultNotFoundComponent`): embutidos na moldura (`py-16`, sem fundo próprio). Só a falha da
  raiz (`ErroNaRaiz`) ocupa a tela.
- `CabecalhoDaPagina`: título quebra em qualquer ponto (`overflow-wrap: anywhere`), porque às vezes
  é um id sem espaço (o ator em `/llm/eventos/$ator`) e empurraria a página a 390px.
- `/precos`: "Importar CSV" (contornado) e o primário, ambos agindo na aba aberta. A contagem da
  aba só aparece depois que a lista chega.

## Componentes compartilhados

| Componente | Arquivo | Papel |
| --- | --- | --- |
| `Cartao` | `components/cartao.tsx` | KPI tile |
| `PainelCard` | `components/painel-card.tsx` | Cartão com título, hint e os três estados |
| `CabecalhoDaPagina` | `components/cabecalho-da-pagina.tsx` | Page header |
| `StatusPill` | `components/status-pill.tsx` | Pílula de status |
| `ErrorBox`, `EmptyBox`, `VazioNoCartao` | `components/empty-states.tsx` | Estados de página e de cartão |
| `ErroNaRota`, `ErroNaRaiz`, `PaginaNaoEncontrada` | `components/pagina-de-estado.tsx` | Estados do roteador |
| `Medidor`, `BALDES` | `components/medidor.tsx` | Fita dos baldes de token |
| `Conversa` | `components/conversa.tsx` | Trocas de um ator, com a fita por troca |
| `Conteudo` | `components/conteudo.tsx` | Texto cru na linha aberta |
| `BotaoDeConteudo` | `components/botao-de-conteudo.tsx` | Abrir/fechar conteúdo da linha |
| `Paginacao` | `components/paginacao.tsx` | Rodapé de lista paginada |
| `TooltipDoTempo` | `components/tooltip-do-tempo.tsx` | Tooltip de pilha no tempo |
| `TabelaDePrecos` | `components/faixa-preco.tsx` | Lista de preços com histórico |
| `GlobalFilters`, `Campo` | `components/global-filters.tsx` | Toolbar de filtros |

Utilitários: `lib/grafico.ts` (cores, eixo, tooltip, legenda, `rotuloDeValor`, `rotuloNoCentro`,
`porcentagensQueFecham`, `formatFatia`, `truncarRotulo`), `lib/format.ts` (formatos),
`lib/utils.ts` (`haTextoSelecionado`, `devolverFocoA`).

## Pontos abertos

- **Service × Sem categoria** (para o usuário decidir): `--categoria-service` (c5) e
  `--categoria-nenhuma` ficam a 1.44:1 (claro) e 1.55:1 (escuro) entre si; na pilha de "Mensagens
  ao longo do tempo" os dois segmentos de cima mal se separam. Cada um passa 3:1 contra a surface e
  legenda e tooltip nomeiam, então não bloqueia. Saídas: clarear "Sem categoria" (fg 30–35% no
  claro, mantendo ≥ 3:1) ou aceitar e registrar aqui.
- **Data impossível no CSV** (achado, fora do escopo visual): `paraDataISO` (`lib/csv.ts`) só
  confere o formato, e `2026-13-40` passa na prévia como "Pronta". A recusa vem do servidor, linha
  a linha.

## Levar ao pacote wide-ui

Problemas herdados do wide-ui, a corrigir no pacote e não aqui:

- `--wu-line-strong` como borda de input fica a 1.48:1 (claro) e 1.58:1 (escuro) contra a
  surface, abaixo de 3:1.
- `--wu-c4` (`#CA8A04`) fica a 2.94:1 no branco. No escuro c1 3.46, c3 3.32, c5 3.76, todos
  acima de 3.
- `--wu-brand-ink-light` é calculado contra `--wu-surface`. Com `#E30D4D` ele é o próprio accent e
  cai a 4.43:1 sobre `--wu-bg`: link direto no fundo da página, fora de cartão, fica abaixo de 4.5.
- O comentário de `tailwind-v4.css` lista `text-muted` como utilitário de texto, e o
  `components.md` usa `muted` como cor de texto. Em projeto com shadcn, `muted` é fundo. Vale uma
  nota no adaptador.
