import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * O tile de KPI do wide-ui: ícone e rótulo (13 `muted`), o valor (28/600, 22 abaixo de 700px),
 * a unidade ao lado (14/500 `subtle`) e uma linha de contexto (12px). `problema` pinta rótulo e
 * valor em `danger` — é o tile que sinaliza que algo precisa de atenção.
 *
 * É o irmão de `PainelCard` para número solto — lá a leitura é um gráfico, aqui é uma quantia —, e
 * ter os dois num arquivo só quebraria o fast refresh do Vite.
 */
export function Cartao({
  rotulo,
  valor,
  unidade,
  nota,
  icone: Icone,
  cor,
  problema,
  carregando,
  children,
}: {
  rotulo: string;
  valor: string;
  unidade?: string;
  nota?: ReactNode;
  icone?: LucideIcon;
  /**
   * Quando o número é de uma série que tem cor fixa nos gráficos da tela (uma origem), o ponto
   * antes do rótulo é a legenda dela. Não pinta o valor: valor é sempre `fg`.
   */
  cor?: string;
  problema?: boolean;
  carregando?: boolean;
  /** Espaço para o que a nota não diz sozinha: uma fita de proporção, uma fração desenhada. */
  children?: ReactNode;
}) {
  return (
    <section className="border-line bg-card shadow-card flex min-w-0 flex-col gap-1 rounded-[var(--wu-radius)] border p-4">
      <div
        className={cn(
          "flex min-w-0 items-center gap-1.5 text-[13px]",
          problema ? "text-danger" : "text-muted-foreground",
        )}
      >
        {Icone && <Icone className={cn("h-4 w-4 shrink-0", !problema && "text-subtle")} />}
        {cor && (
          <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: cor }} />
        )}
        <span className="truncate">{rotulo}</span>
      </div>
      {carregando ? (
        <Skeleton className="mt-1 h-7 w-32" />
      ) : (
        <div className="flex min-w-0 items-baseline gap-1">
          <span
            className={cn(
              "truncate text-[22px] leading-tight font-semibold tracking-[-0.02em] min-[700px]:text-[28px]",
              problema ? "text-danger" : "text-foreground",
            )}
            title={valor}
          >
            {valor}
          </span>
          {unidade && <span className="text-subtle shrink-0 text-sm font-medium">{unidade}</span>}
        </div>
      )}
      {/* O esqueleto segura o lugar do que vem em `children` (hoje, a fita de 3px dos cobráveis),
        senão o tile cresce uma linha quando os dados chegam. */}
      {children && (carregando ? <Skeleton className="h-[3px] w-full rounded-full" /> : children)}
      {nota && !carregando && <div className="text-muted-foreground text-xs">{nota}</div>}
      {nota && carregando && <Skeleton className="h-3.5 w-24" />}
    </section>
  );
}
