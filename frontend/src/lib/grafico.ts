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

type Balde = {
  grupo?: string;
  periodo?: string;
  origem?: string;
  custo: number | null;
};

/**
 * Achata `[{grupo, periodo, custo}]` em uma linha por valor de `eixo`, com uma coluna por série.
 *
 * O recharts empilha colunas de um mesmo objeto, não linhas de uma mesma chave — então o balde por
 * balde que a API devolve precisa virar `{ periodo, llm, whatsapp }` antes de virar barra. É o
 * único remendo de forma que o painel faz sobre a resposta; a soma, essa continua no banco.
 *
 * `custo: null` ("não sei quanto custou") sai como chave **ausente**, e não como zero: o recharts
 * não desenha segmento para chave que não existe, que é exatamente o que se quer dizer. Zero seria
 * a outra afirmação — "não custou nada" —, e as duas não podem virar o mesmo pixel.
 */
export function pivotarPorGrupo(
  baldes: Balde[],
  eixo: "periodo" | "grupo",
  serie: "grupo" | "origem" = "grupo",
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
    if (balde.custo !== null) linha[chaveSerie] = (Number(linha[chaveSerie]) || 0) + balde.custo;
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
