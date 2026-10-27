import { Inbox, TriangleAlert, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Os estados de página do wide-ui (`patterns.md`, "States"): tile de 48px com o ícone, título
 * 16/600, uma linha de porquê e a ação que resolve. Vazio usa o tile `sel`; erro, o `danger-bg`.
 *
 * Dentro de um cartão o vazio é outra coisa — uma linha centralizada, sem tile —, e esse é o
 * `VazioNoCartao`, mais abaixo.
 */
function EstadoDePagina({
  icone: Icone,
  tom,
  titulo,
  descricao,
  children,
  className,
}: {
  icone: LucideIcon;
  tom: "vazio" | "erro";
  titulo: string;
  descricao: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tom === "erro" ? "alert" : undefined}
      className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)}
    >
      <div
        className={cn(
          "grid h-12 w-12 place-items-center rounded-[var(--wu-radius)]",
          tom === "erro" ? "bg-danger-bg text-danger" : "bg-sel text-muted-foreground",
        )}
      >
        <Icone className="h-6 w-6" />
      </div>
      <h3 className="text-foreground mt-4 text-base font-semibold">{titulo}</h3>
      <p className="text-muted-foreground mt-1 max-w-sm text-[13px]">{descricao}</p>
      {children && <div className="mt-5 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  );
}

/**
 * Falha de carga. Nunca mostra a mensagem crua: ela vai para o console, e a tela diz o que
 * aconteceu em palavras e o que fazer. Com `onRetry`, oferece "Tentar de novo".
 */
export function ErrorBox({
  error,
  onRetry,
  titulo = "Não foi possível carregar os dados",
  className,
}: {
  error: unknown;
  onRetry?: () => void;
  titulo?: string;
  className?: string;
}) {
  if (error) console.error(error);
  return (
    <EstadoDePagina
      icone={TriangleAlert}
      tom="erro"
      titulo={titulo}
      descricao="O serviço de métricas não respondeu. Tente de novo; se continuar falhando, ele pode estar fora do ar."
      className={className}
    >
      {onRetry && (
        <Button variant="outline" onClick={onRetry}>
          Tentar de novo
        </Button>
      )}
    </EstadoDePagina>
  );
}

/** Vazio de página: o porquê em uma linha e, quando houver, a ação que resolve. */
export function EmptyBox({
  titulo = "Nada para mostrar",
  message = "Nenhum evento neste período. Amplie as datas ou limpe os filtros.",
  icone = Inbox,
  children,
  className,
}: {
  titulo?: string;
  message?: string;
  icone?: LucideIcon;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <EstadoDePagina
      icone={icone}
      tom="vazio"
      titulo={titulo}
      descricao={message}
      className={className}
    >
      {children}
    </EstadoDePagina>
  );
}

/** Vazio dentro de um cartão: uma linha centralizada em `subtle`, sem tile. */
export function VazioNoCartao({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "text-subtle flex items-center justify-center px-6 py-12 text-center text-[13px]",
        className,
      )}
    >
      <p className="max-w-sm">{children}</p>
    </div>
  );
}
