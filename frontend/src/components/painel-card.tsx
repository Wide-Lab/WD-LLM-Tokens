import type { LucideIcon } from "lucide-react";
import { useEffect, type ReactNode } from "react";

import { VazioNoCartao } from "@/components/empty-states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * O cartão do wide-ui: cabeçalho de 14x16 com borda embaixo (ícone outline de 18px em `subtle`,
 * título 14/600, dica à direita em 12.5 `subtle`), corpo de 16px, e os três estados de carga no
 * mesmo lugar — carregando (esqueleto com a forma), vazio (uma linha centralizada) e erro (sem
 * mensagem crua, com "Tentar de novo" quando há como).
 *
 * `hint` diz o recorte da leitura — "por dia", "10 maiores" — que antes só dava para descobrir
 * olhando o eixo.
 */
export function PainelCard({
  title,
  icon: Icone,
  hint,
  action,
  children,
  loading,
  error,
  onRetry,
  empty,
  emptyMessage,
  bleed,
  className,
}: {
  title: string;
  icon?: LucideIcon;
  hint?: string;
  /** Controle que troca o que a leitura mostra — fica no cabeçalho, junto do título. */
  action?: ReactNode;
  children: ReactNode;
  loading?: boolean;
  error?: unknown;
  /** Normalmente o `refetch` da query: com ele o erro oferece "Tentar de novo". */
  onRetry?: () => void;
  empty?: boolean;
  emptyMessage?: string;
  /** Conteúdo encosta nas bordas (tabelas), em vez de respirar num padding. */
  bleed?: boolean;
  className?: string;
}) {
  // No efeito, e não no render, para não logar o mesmo erro a cada re-render.
  useEffect(() => {
    if (error) console.error(error);
  }, [error]);

  return (
    <section
      className={cn(
        "border-line bg-card shadow-card flex min-w-0 flex-col rounded-[var(--wu-radius)] border",
        className,
      )}
    >
      <header className="border-line flex min-h-[49px] flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b px-4 py-2.5">
        <h2 className="text-foreground flex min-w-0 items-center gap-2 text-sm font-semibold">
          {Icone && <Icone className="text-subtle h-[18px] w-[18px] shrink-0" />}
          <span className="truncate">{title}</span>
        </h2>
        {(hint || action) && (
          <div className="flex items-center gap-3">
            {hint && <span className="text-subtle shrink-0 text-[12.5px]">{hint}</span>}
            {action}
          </div>
        )}
      </header>
      {loading ? (
        bleed ? (
          <div className="divide-line divide-y" aria-busy="true">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="flex h-12 items-center gap-4 px-4">
                <Skeleton className="h-3.5 w-1/3" />
                <Skeleton className="ml-auto h-3.5 w-16" />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex h-[280px] items-end gap-2 p-4" aria-busy="true">
            {[45, 70, 55, 85, 60, 75, 40, 65].map((h, i) => (
              <Skeleton key={i} className="flex-1" style={{ height: `${h}%` }} />
            ))}
          </div>
        )
      ) : error ? (
        <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
          <p className="text-muted-foreground text-[13px]">
            Não foi possível carregar este quadro.
          </p>
          {onRetry && (
            <Button variant="outline" onClick={onRetry}>
              Tentar de novo
            </Button>
          )}
        </div>
      ) : empty ? (
        <VazioNoCartao>
          {emptyMessage ?? "Nenhum dado neste período. Amplie as datas ou limpe os filtros."}
        </VazioNoCartao>
      ) : bleed ? (
        children
      ) : (
        <div className="h-[280px] w-full p-4">{children}</div>
      )}
    </section>
  );
}
