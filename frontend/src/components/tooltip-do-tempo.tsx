import type { TooltipProps } from "recharts";

import { tooltipEstilo, totalDaLinha } from "@/lib/grafico";
import { formatPeriodoCompleto } from "@/lib/format";

/**
 * O tooltip de uma pilha no eixo de tempo: o balde com ano (só o mês dispensa o dia), uma linha
 * por série e o total da pilha no rodapé. Conteúdo próprio porque o tooltip padrão do recharts não
 * tem rodapé.
 *
 * `formatar` diz a unidade — dinheiro no consolidado, contagem de mensagem no WhatsApp —, e é o
 * mesmo formato nas linhas e no total, porque os dois somam a mesma coisa.
 */
export function TooltipDoTempo({
  active,
  payload,
  label,
  granularidade,
  formatar,
}: TooltipProps<number, string> & {
  granularidade: string;
  formatar: (valor: number) => string;
}) {
  if (!active || !payload?.length) return null;
  const linha = payload[0]?.payload as Record<string, string | number> | undefined;
  const rotulo = formatPeriodoCompleto(String(label), granularidade);

  return (
    <div style={{ ...tooltipEstilo.contentStyle, padding: "8px 10px" }}>
      <div style={tooltipEstilo.labelStyle}>{rotulo}</div>
      {payload.map((p) => (
        <div key={String(p.dataKey)} className="flex items-center gap-1.5 py-px">
          <span
            aria-hidden
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ background: p.color }}
          />
          <span className="text-muted-foreground">{p.name}</span>
          <span className="ml-auto pl-4 tabular-nums">{formatar(Number(p.value))}</span>
        </div>
      ))}
      {linha && (
        <div className="border-line mt-1 flex items-center gap-1.5 border-t pt-1 font-medium">
          <span>Total</span>
          <span className="ml-auto pl-4 tabular-nums">
            {formatar(totalDaLinha(linha, "periodo"))}
          </span>
        </div>
      )}
    </div>
  );
}
