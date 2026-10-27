import { createElement } from "react";

/**
 * Ajustes compartilhados do recharts.
 *
 * Ficam fora do `PainelCard` porque um arquivo que exporta componente e constante junto
 * quebra o fast refresh do Vite.
 */

/** Eixos sem linha e sem tick, em `subtle` 12px: a grade horizontal já dá a referência de leitura. */
export const eixo = {
  stroke: "var(--wu-subtle)",
  fontSize: 12,
  tickLine: false,
  axisLine: false,
  tickMargin: 8,
} as const;

/** Tooltip como superfície do wide-ui: `surface`, borda `line`, raio 8 e a única sombra permitida. */
export const tooltipEstilo = {
  contentStyle: {
    background: "var(--wu-surface)",
    border: "1px solid var(--wu-line)",
    borderRadius: 8,
    color: "var(--wu-fg)",
    fontSize: 12.5,
    boxShadow: "var(--wu-shadow)",
  },
  labelStyle: { color: "var(--wu-muted)", fontSize: 12, marginBottom: 2 },
  itemStyle: { color: "var(--wu-fg)" },
  cursor: { fill: "var(--wu-hover)", stroke: "var(--wu-line)" },
} as const;

/**
 * Legenda dos gráficos: o ponto na cor da série e o rótulo em `muted` 12px. O recharts pinta o
 * texto com a cor da série por padrão; o `formatter` devolve o texto à cor de texto, porque a
 * cor já está no ponto.
 */
export const legendaEstilo = {
  wrapperStyle: { fontSize: 12, paddingTop: 4 },
  iconSize: 8,
  iconType: "circle",
  formatter: (valor: string) =>
    createElement("span", { style: { color: "var(--wu-muted)" } }, valor),
} as const;

/**
 * As séries categóricas do wide-ui, na ordem do pacote. Para gráfico cujas fatias não têm papel
 * fixo (um modelo, um ator): a cor só separa as fatias, e quem diz qual é qual é a legenda.
 */
export const SERIES = [
  "var(--wu-c1)",
  "var(--wu-c2)",
  "var(--wu-c3)",
  "var(--wu-c4)",
  "var(--wu-c5)",
] as const;

/**
 * As duas origens, na ordem e nas cores que valem na tela inteira.
 *
 * Sai daqui e não de cada gráfico porque a regra é essa: LLM e WhatsApp têm de ter **sempre** a
 * mesma cor nos três quadros do consolidado. É o que permite ler o terceiro gráfico sem voltar na
 * legenda do primeiro — e o que se perde na primeira vez que alguém escolher a cor no lugar do uso.
 *
 * O papel é fixo no painel todo: LLM é a primeira série do wide-ui, WhatsApp a segunda
 * (`--origem-*`, em `styles.css`). Os gráficos de custo dentro de cada origem usam a cor dela.
 */
export const ORIGENS = [
  { chave: "llm", nome: "LLM", cor: "var(--origem-llm)" },
  { chave: "whatsapp", nome: "WhatsApp", cor: "var(--origem-whatsapp)" },
] as const;

/**
 * As quatro categorias de mensagem, cada uma com uma série fixa (`--categoria-*`, em `styles.css`).
 *
 * `service` fica com a série mais apagada (a cinza-azulada) de propósito: é a única das quatro que
 * a Meta não cobra, e a cor precisa dizer isso antes da legenda. As outras três não têm hierarquia
 * embutida — nenhuma é "mais cara" por natureza, o preço é por país. A segunda série fica de fora
 * porque é a do WhatsApp; marketing repetir a primeira (a do LLM) é aceito, porque categoria só
 * aparece dentro do painel WhatsApp, onde a cor do LLM não está.
 */
export const CATEGORIAS = [
  { chave: "marketing", nome: "Marketing", cor: "var(--categoria-marketing)" },
  { chave: "utility", nome: "Utility", cor: "var(--categoria-utility)" },
  { chave: "authentication", nome: "Authentication", cor: "var(--categoria-authentication)" },
  { chave: "service", nome: "Service", cor: "var(--categoria-service)" },
] as const;

/** O rótulo que o backend dá ao balde de `grupo=categoria` sem categoria — as recebidas. */
export const SEM_CATEGORIA = "sem categoria";

/**
 * As séries do empilhado de mensagens: as quatro categorias mais o balde das recebidas.
 *
 * As recebidas saem num cinza neutro (`--categoria-nenhuma`), e não numa série, porque mensagem
 * recebida não é categoria nenhuma e não custa: o cinza aqui é a afirmação, não a falta de
 * escolha. Ele ainda passa de 3:1 contra o cartão e não se confunde com o cinza-azulado de
 * `service`.
 */
export const SERIES_DE_CATEGORIA = [
  ...CATEGORIAS,
  { chave: SEM_CATEGORIA, nome: "Sem categoria", cor: "var(--categoria-nenhuma)" },
] as const;

/**
 * As duas direções, nas cores dos baldes de token do LLM — ver `conversa.tsx`. Os baldes são uma
 * rampa neutra (de `fg` para o cinza, em `styles.css`), e não uma série, para que nem token nem
 * direção peguem a cor de uma origem.
 */
export const DIRECOES = [
  // O que o cliente falou é o que vira token de entrada do outro lado; o que o número respondeu,
  // token de saída. Reusar as duas cores mantém "quem falou" com o mesmo significado nas duas
  // origens, que é o que deixa a lista de mensagens ser lida como conversa.
  { chave: "recebida", nome: "Recebida", cor: "var(--balde-entrada)" },
  { chave: "enviada", nome: "Enviada", cor: "var(--balde-saida)" },
] as const;

type Visual = { chave: string; nome: string; cor: string };

export function visualDaCategoria(chave: string | null | undefined): Visual | undefined {
  return SERIES_DE_CATEGORIA.find((c) => c.chave === chave);
}

export function visualDaDirecao(chave: string): Visual | undefined {
  return DIRECOES.find((d) => d.chave === chave);
}

type Eixos = {
  grupo?: string;
  periodo?: string;
  origem?: string;
};

/**
 * Achata `[{grupo, periodo, custo}]` em uma linha por valor de `eixo`, com uma coluna por série.
 *
 * O recharts empilha colunas de um mesmo objeto, não linhas de uma mesma chave — então o balde por
 * balde que a API devolve precisa virar `{ periodo, llm, whatsapp }` antes de virar barra. É o
 * único remendo de forma que o painel faz sobre a resposta; a soma, essa continua no banco.
 *
 * `medida` diz **qual número** empilhar, e é explícita em vez de fixa no custo porque o painel de
 * WhatsApp empilha contagem de mensagem no mesmo formato — no gráfico de mensagens por categoria a
 * unidade é mensagem, não dinheiro, e quem lê a chamada precisa ver isso sem abrir a função.
 *
 * `null` ("não sei quanto custou") sai como chave **ausente**, e não como zero: o recharts não
 * desenha segmento para chave que não existe, que é exatamente o que se quer dizer. Zero seria a
 * outra afirmação — "não custou nada" —, e as duas não podem virar o mesmo pixel.
 */
export function pivotarPorGrupo<T extends Eixos>(
  baldes: T[],
  eixo: "periodo" | "grupo",
  serie: "grupo" | "origem",
  medida: (balde: T) => number | null,
): Array<Record<string, string | number>> {
  const linhas = new Map<string, Record<string, string | number>>();

  for (const balde of baldes) {
    const chaveEixo = balde[eixo];
    const chaveSerie = balde[serie];
    if (chaveEixo === undefined || chaveSerie === undefined) continue;

    let linha = linhas.get(chaveEixo);
    if (!linha) {
      linha = { [eixo]: chaveEixo };
      linhas.set(chaveEixo, linha);
    }

    const valor = medida(balde);
    if (valor !== null) linha[chaveSerie] = (Number(linha[chaveSerie]) || 0) + valor;
  }

  const pivotadas = [...linhas.values()];

  // A API ordena por série e **depois** por período, então a ordem de chegada é a de `llm`
  // inteiro seguido de `whatsapp` inteiro: um dia que só uma origem teve entraria na cronologia
  // pelo fim. Em eixo de tempo isso é erro visível, e a data ISO ordena como texto.
  // No eixo de categoria não há ordem natural — quem chama ordena por gasto.
  if (eixo === "periodo") {
    pivotadas.sort((a, b) => String(a.periodo).localeCompare(String(b.periodo)));
  }

  return pivotadas;
}

/** O total de uma linha pivotada, para ordenar por gasto e para o rodapé do tooltip. */
export function totalDaLinha(linha: Record<string, string | number>, eixo: string): number {
  return Object.entries(linha).reduce(
    (soma, [chave, valor]) => (chave === eixo ? soma : soma + Number(valor)),
    0,
  );
}
