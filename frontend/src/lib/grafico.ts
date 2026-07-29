/**
 * Ajustes compartilhados do recharts.
 *
 * Ficam fora do `PainelCard` porque um arquivo que exporta componente e constante junto
 * quebra o fast refresh do Vite.
 */

/** Eixos sem linha e sem tick: a grade horizontal já dá a referência de leitura. */
export const eixo = {
  stroke: "var(--muted-foreground)",
  fontSize: 11,
  tickLine: false,
  axisLine: false,
  tickMargin: 8,
} as const;

export const tooltipEstilo = {
  contentStyle: {
    background: "var(--popover)",
    border: "1px solid var(--border)",
    borderRadius: 4,
    color: "var(--popover-foreground)",
    fontSize: 12,
    boxShadow: "0 4px 16px oklch(0 0 0 / 12%)",
  },
  labelStyle: { color: "var(--muted-foreground)", fontSize: 11 },
  cursor: { stroke: "var(--border)" },
} as const;

/**
 * As duas origens, na ordem e nas cores que valem na tela inteira.
 *
 * Sai daqui e não de cada gráfico porque a regra é essa: LLM e WhatsApp têm de ter **sempre** a
 * mesma cor nos três quadros do consolidado. É o que permite ler o terceiro gráfico sem voltar na
 * legenda do primeiro — e o que se perde na primeira vez que alguém escolher a cor no lugar do uso.
 *
 * As duas são violeta porque as duas são dinheiro (`styles.css`): LLM fica com o tom de custo já
 * usado no resto do painel, WhatsApp com outro degrau da mesma rampa.
 */
export const ORIGENS = [
  { chave: "llm", nome: "LLM", cor: "var(--custo)" },
  { chave: "whatsapp", nome: "WhatsApp", cor: "var(--chart-4)" },
] as const;

/**
 * As quatro categorias de mensagem, na rampa do dinheiro.
 *
 * `service` fica com o tom mais apagado da rampa de propósito: é a única das quatro que a Meta não
 * cobra, e a cor precisa dizer isso antes da legenda. As outras três seguem a ordem da rampa sem
 * hierarquia embutida — nenhuma é "mais cara" por natureza, o preço é por país.
 */
export const CATEGORIAS = [
  { chave: "marketing", nome: "Marketing", cor: "var(--chart-1)" },
  { chave: "utility", nome: "Utility", cor: "var(--chart-2)" },
  { chave: "authentication", nome: "Authentication", cor: "var(--chart-3)" },
  { chave: "service", nome: "Service", cor: "var(--chart-5)" },
] as const;

/** O rótulo que o backend dá ao balde de `grupo=categoria` sem categoria — as recebidas. */
export const SEM_CATEGORIA = "sem categoria";

/**
 * As séries do empilhado de mensagens: as quatro categorias mais o balde das recebidas.
 *
 * As recebidas saem em cinza e não num degrau do violeta porque violeta é dinheiro em todo o
 * painel, e mensagem recebida não custa. Cinza aqui é a afirmação, não a falta de escolha.
 */
export const SERIES_DE_CATEGORIA = [
  ...CATEGORIAS,
  { chave: SEM_CATEGORIA, nome: "Sem categoria", cor: "var(--muted-foreground)" },
] as const;

/** As duas direções, nas cores dos baldes de token do LLM — ver `conversa.tsx`. */
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
