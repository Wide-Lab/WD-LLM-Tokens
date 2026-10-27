import { cn } from "@/lib/utils";

/**
 * Os seis tons de status do wide-ui, mais `danger` para o que é problema.
 *
 * O tom é do wide-ui; o mapeamento de cada estado do domínio para um tom é do projeto e fica
 * escrito em `docs/ui-patterns.md`. Quem usa passa o tom, nunca uma cor.
 */
export type TomDeStatus =
  "neutral" | "pending" | "progress" | "done" | "archived" | "void" | "danger";

const CORES: Record<TomDeStatus, { cor: string; fundo: string }> = {
  neutral: { cor: "var(--wu-t-neutral)", fundo: "var(--wu-t-neutral-bg)" },
  pending: { cor: "var(--wu-t-pending)", fundo: "var(--wu-t-pending-bg)" },
  progress: { cor: "var(--wu-t-progress)", fundo: "var(--wu-t-progress-bg)" },
  done: { cor: "var(--wu-t-done)", fundo: "var(--wu-t-done-bg)" },
  archived: { cor: "var(--wu-t-archived)", fundo: "var(--wu-t-archived-bg)" },
  void: { cor: "var(--wu-t-void)", fundo: "var(--wu-t-void-bg)" },
  danger: { cor: "var(--wu-danger)", fundo: "var(--wu-danger-bg)" },
};

/**
 * A pílula de status do wide-ui: 22px, toda arredondada, 12/500, um ponto de 6px na cor do texto
 * antes do rótulo. O tom `void` ainda risca o texto. O significado está no texto — a cor só
 * reforça.
 */
export function StatusPill({
  tom,
  children,
  className,
  title,
}: {
  tom: TomDeStatus;
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  const { cor, fundo } = CORES[tom];
  return (
    <span
      title={title}
      className={cn(
        "inline-flex h-[22px] shrink-0 items-center gap-1.5 rounded-full px-2 text-xs font-medium whitespace-nowrap",
        tom === "void" && "line-through",
        className,
      )}
      style={{ color: cor, background: fundo }}
    >
      <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
      {children}
    </span>
  );
}
