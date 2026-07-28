export function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("pt-BR").format(n);
}

export function formatCompact(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("pt-BR", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
}

export function formatCurrency(value: number | null | undefined, currency: string = "USD"): string {
  if (value === null || value === undefined) return "—";
  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

export function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "medium",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/** Só a hora. Na conversa a data já vem na régua do dia, então repeti-la em cada troca é ruído. */
export function formatTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", { timeStyle: "short" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/** O dia por extenso, para a régua que separa um dia do outro na conversa. */
export function formatDayLabel(iso: string): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
