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

/**
 * Uma tarifa cadastrada — o preço em si, não um total gasto.
 *
 * Vai a seis casas, e `formatCurrency` para em quatro, porque as duas respondem perguntas
 * diferentes: um total em quatro casas já é precisão de sobra, mas uma tarifa de cache lido
 * arredondada some justamente no dígito que a distingue de zero. Aqui o número é o dado, e cortá-lo
 * seria mostrar um preço que ninguém cadastrou.
 */
export function formatTarifa(valor: number, moeda: string = "USD"): string {
  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: moeda,
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    }).format(valor);
  } catch {
    return `${valor} ${moeda}`;
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

/**
 * Uma data ISO **sem hora** (`2026-01-01`), do jeito que se lê em pt-BR.
 *
 * Não passa por `new Date(iso)` de propósito: a string sem hora é lida como meia-noite **UTC**, e
 * em qualquer fuso a oeste de Greenwich isso volta um dia. Uma vigência que começa no dia 1º
 * apareceria como o dia 31 do mês anterior — justo o campo em que um dia de diferença muda o
 * custo de um evento.
 */
export function formatDateOnly(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : iso;
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
