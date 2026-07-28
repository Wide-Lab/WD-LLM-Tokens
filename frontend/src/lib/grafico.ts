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
