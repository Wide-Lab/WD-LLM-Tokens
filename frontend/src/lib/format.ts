export function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("pt-BR").format(n);
}

export function formatCompact(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  // Abaixo de 1 a casa decimal única zera os ticks de um eixo de custo (todos viram `0`).
  if (n !== 0 && Math.abs(n) < 1) {
    return new Intl.NumberFormat("pt-BR", { maximumSignificantDigits: 2 }).format(n);
  }
  return new Intl.NumberFormat("pt-BR", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
}

/**
 * Um valor gasto. Por padrão vai até quatro casas — é o que tooltip e tabela precisam para um
 * custo de centavos não sumir. O tile de KPI passa `{ casas: 2 }`: ali o número é lido de longe,
 * no formato `R$ 1.284,60`, e a precisão fina continua a um passe de mouse no gráfico.
 */
export function formatCurrency(
  value: number | null | undefined,
  currency: string = "USD",
  { casas = 4 }: { casas?: number } = {},
): string {
  if (value === null || value === undefined) return "—";
  try {
    // Um gasto que existe e não chega a um centavo não pode sair `0,00`: o tile diria que nada foi
    // gasto. Nesse caso as casas crescem até mostrar dois dígitos significativos.
    const minimo = 10 ** -Math.max(2, casas) / 2;
    if (value !== 0 && Math.abs(value) < minimo) {
      return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency,
        maximumSignificantDigits: 2,
      }).format(value);
    }
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: Math.max(2, casas),
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

/**
 * Data e hora em `dd/mm/aaaa HH:mm`. Lista de log (eventos, mensagens) passa `{ segundos: true }`:
 * ali duas linhas do mesmo minuto precisam se distinguir pela hora.
 */
export function formatDateTime(
  iso: string,
  { segundos = false }: { segundos?: boolean } = {},
): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: segundos ? "medium" : "short",
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

/**
 * O rótulo de um balde de tempo dos gráficos: `dd/mm` por dia ou semana, `mm/aaaa` por mês.
 *
 * Lê só os dez primeiros caracteres e não passa por `new Date` — pelo mesmo motivo de
 * `formatDateOnly`: o balde chega como data, e a conversão de fuso o jogaria no dia anterior.
 */
export function formatPeriodo(periodo: string, granularidade?: string): string {
  const [ano, mes, dia] = String(periodo).slice(0, 10).split("-");
  if (!ano || !mes) return String(periodo);
  if (granularidade === "mes" || !dia) return `${mes}/${ano}`;
  return `${dia}/${mes}`;
}

/**
 * O mesmo balde de tempo com o ano, para o tooltip: no eixo `dd/mm` basta porque o ano está no
 * filtro, mas o tooltip é lido sozinho. Por mês continua `mm/aaaa` — o dia ali não existe.
 */
export function formatPeriodoCompleto(periodo: string, granularidade?: string): string {
  if (granularidade === "mes") return formatPeriodo(periodo, granularidade);
  return formatDateOnly(String(periodo).slice(0, 10));
}

/** `dd/mm/aaaa HH:mm` de um instante em ms, no fuso do navegador — quando o painel recebeu os dados. */
export function formatInstante(ms: number): string {
  const d = new Date(ms);
  return `${formatDateOnly(toISODate(d))} ${formatTime(d.toISOString())}`;
}
