import type { ReactNode } from "react";

import { ErrorBox, EmptyBox } from "@/components/empty-states";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * O quadro padrão do painel: título como etiqueta de instrumento (mono, caixa alta), uma
 * régua separando cabeçalho de leitura, e os três estados de carga no mesmo lugar.
 *
 * `hint` diz o recorte da leitura — "por dia", "10 maiores" — que antes só dava para
 * descobrir olhando o eixo.
 */
export function PainelCard({
  title,
  hint,
  action,
  children,
  loading,
  error,
  empty,
  emptyMessage,
  bleed,
  className,
}: {
  title: string;
  hint?: string;
  /** Controle que troca o que a leitura mostra — fica no cabeçalho, junto do título. */
  action?: ReactNode;
  children: ReactNode;
  loading?: boolean;
  error?: unknown;
  empty?: boolean;
  emptyMessage?: string;
  /** Conteúdo encosta nas bordas (tabelas), em vez de respirar num padding. */
  bleed?: boolean;
  className?: string;
}) {
  return (
    <section className={cn("bg-card flex flex-col rounded-xl border shadow-sm", className)}>
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b px-5 py-3">
        <h2 className="etiqueta">{title}</h2>
        <div className="flex items-center gap-3">
          {hint && (
            <span className="text-muted-foreground shrink-0 font-mono text-[0.6875rem]">
              {hint}
            </span>
          )}
          {action}
        </div>
      </header>
      {loading ? (
        <div className="p-4">
          <Skeleton className="h-[280px] w-full" />
        </div>
      ) : error ? (
        <div className="p-4">
          <ErrorBox error={error} />
        </div>
      ) : empty ? (
        <div className="p-4">
          <EmptyBox message={emptyMessage} />
        </div>
      ) : bleed ? (
        children
      ) : (
        <div className="h-[280px] w-full p-4 font-mono">{children}</div>
      )}
    </section>
  );
}
