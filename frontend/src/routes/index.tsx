import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, Coins, ArrowDownToLine, ArrowUpFromLine, Database } from "lucide-react";

import { GlobalFilters } from "@/components/global-filters";
import { ErrorBox, EmptyBox } from "@/components/empty-states";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiGet } from "@/lib/api";
import { useFilters, filtersToParams } from "@/lib/filters";
import { formatCompact, formatCurrency, formatNumber } from "@/lib/format";
import type { MetricaBucket } from "@/lib/api-types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Visão geral — Painel LLM" },
      {
        name: "description",
        content: "Resumo de requisições, tokens e custos de LLM por período.",
      },
      { property: "og:title", content: "Visão geral — Painel LLM" },
      {
        property: "og:description",
        content: "KPIs e gráficos de consumo de tokens e custo de modelos de linguagem.",
      },
    ],
  }),
  component: Overview,
});

const TOKEN_COLORS = {
  entrada: "var(--chart-1)",
  saida: "var(--chart-2)",
  cache_leitura: "var(--chart-3)",
  cache_escrita: "var(--chart-4)",
};

const PIE_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function useMetricas(params: Record<string, string | undefined>) {
  return useQuery({
    queryKey: ["metricas", params],
    queryFn: () => apiGet<MetricaBucket[]>("/v1/metricas", params),
  });
}

function Overview() {
  const { filters } = useFilters();

  const base = filtersToParams(filters);

  return (
    <div className="flex flex-col gap-4">
      <GlobalFilters />
      <KpiCards baseParams={base} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <CustoTemporal baseParams={base} granularidade={filters.granularidade} />
        <TokensTemporal baseParams={base} granularidade={filters.granularidade} />
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <CustoPorModelo baseParams={base} />
        <TopAtores baseParams={base} />
      </div>
      <UsoPorAplicacao baseParams={base} />
    </div>
  );
}

function KpiCards({ baseParams }: { baseParams: Record<string, string | undefined> }) {
  const q = useMetricas(baseParams);
  const totals = q.data?.[0];
  const moeda = totals?.moeda ?? "USD";

  const cacheTotal =
    (totals?.tokens_cache_leitura ?? 0) + (totals?.tokens_cache_escrita ?? 0);

  const kpis = [
    {
      label: "Requisições",
      icon: Activity,
      value: totals ? formatNumber(totals.requisicoes) : "—",
    },
    {
      label: "Custo total",
      icon: Coins,
      value: totals ? formatCurrency(totals.custo, moeda) : "—",
    },
    {
      label: "Tokens de entrada",
      icon: ArrowDownToLine,
      value: totals ? formatNumber(totals.tokens_entrada) : "—",
    },
    {
      label: "Tokens de saída",
      icon: ArrowUpFromLine,
      value: totals ? formatNumber(totals.tokens_saida) : "—",
    },
    {
      label: "Tokens de cache",
      icon: Database,
      value: totals ? formatNumber(cacheTotal) : "—",
    },
  ];

  if (q.isError) return <ErrorBox error={q.error} />;

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      {kpis.map((k) => (
        <Card key={k.label} className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              {k.label}
            </CardTitle>
            <k.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {q.isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="truncate text-2xl font-bold tracking-tight">{k.value}</div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ChartCard({
  title,
  children,
  loading,
  error,
  empty,
}: {
  title: string;
  children: React.ReactNode;
  loading?: boolean;
  error?: unknown;
  empty?: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-[280px] w-full" />
        ) : error ? (
          <ErrorBox error={error} />
        ) : empty ? (
          <EmptyBox />
        ) : (
          <div className="h-[280px] w-full">{children}</div>
        )}
      </CardContent>
    </Card>
  );
}

function CustoTemporal({
  baseParams,
  granularidade,
}: {
  baseParams: Record<string, string | undefined>;
  granularidade: string;
}) {
  const q = useMetricas({ ...baseParams, intervalo: granularidade });
  const data = q.data ?? [];
  const moeda = data[0]?.moeda ?? "USD";
  return (
    <ChartCard
      title="Custo ao longo do tempo"
      loading={q.isLoading}
      error={q.error}
      empty={!q.isLoading && data.length === 0}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="periodo" stroke="var(--muted-foreground)" fontSize={12} />
          <YAxis
            stroke="var(--muted-foreground)"
            fontSize={12}
            tickFormatter={(v) => formatCompact(v)}
          />
          <Tooltip
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              color: "var(--popover-foreground)",
            }}
            formatter={(v: number) => [formatCurrency(v, moeda), "Custo"]}
          />
          <Line
            type="monotone"
            dataKey="custo"
            stroke="var(--chart-1)"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function TokensTemporal({
  baseParams,
  granularidade,
}: {
  baseParams: Record<string, string | undefined>;
  granularidade: string;
}) {
  const q = useMetricas({ ...baseParams, intervalo: granularidade });
  const data = q.data ?? [];
  return (
    <ChartCard
      title="Tokens ao longo do tempo"
      loading={q.isLoading}
      error={q.error}
      empty={!q.isLoading && data.length === 0}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="periodo" stroke="var(--muted-foreground)" fontSize={12} />
          <YAxis
            stroke="var(--muted-foreground)"
            fontSize={12}
            tickFormatter={(v) => formatCompact(v)}
          />
          <Tooltip
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              color: "var(--popover-foreground)",
            }}
            formatter={(v: number) => formatNumber(v)}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="tokens_entrada" stackId="t" fill={TOKEN_COLORS.entrada} name="Entrada" />
          <Bar dataKey="tokens_saida" stackId="t" fill={TOKEN_COLORS.saida} name="Saída" />
          <Bar
            dataKey="tokens_cache_leitura"
            stackId="t"
            fill={TOKEN_COLORS.cache_leitura}
            name="Cache leitura"
          />
          <Bar
            dataKey="tokens_cache_escrita"
            stackId="t"
            fill={TOKEN_COLORS.cache_escrita}
            name="Cache escrita"
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function CustoPorModelo({ baseParams }: { baseParams: Record<string, string | undefined> }) {
  const q = useMetricas({ ...baseParams, grupo: "modelo" });
  const data = (q.data ?? [])
    .filter((d) => (d.custo ?? 0) > 0)
    .sort((a, b) => (b.custo ?? 0) - (a.custo ?? 0))
    .slice(0, 8);
  const moeda = data[0]?.moeda ?? "USD";
  return (
    <ChartCard
      title="Custo por modelo"
      loading={q.isLoading}
      error={q.error}
      empty={!q.isLoading && data.length === 0}
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              color: "var(--popover-foreground)",
            }}
            formatter={(v: number) => formatCurrency(v, moeda)}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Pie
            data={data}
            dataKey="custo"
            nameKey="grupo"
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={95}
            paddingAngle={2}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function TopAtores({ baseParams }: { baseParams: Record<string, string | undefined> }) {
  const q = useMetricas({ ...baseParams, grupo: "ator" });
  const data = (q.data ?? [])
    .slice()
    .sort((a, b) => (b.custo ?? 0) - (a.custo ?? 0))
    .slice(0, 10);
  const moeda = data[0]?.moeda ?? "USD";
  return (
    <ChartCard
      title="Top atores por custo"
      loading={q.isLoading}
      error={q.error}
      empty={!q.isLoading && data.length === 0}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 8, right: 12, left: 12, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
          <XAxis
            type="number"
            stroke="var(--muted-foreground)"
            fontSize={12}
            tickFormatter={(v) => formatCompact(v)}
          />
          <YAxis
            type="category"
            dataKey="grupo"
            stroke="var(--muted-foreground)"
            fontSize={12}
            width={140}
          />
          <Tooltip
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              color: "var(--popover-foreground)",
            }}
            formatter={(v: number) => [formatCurrency(v, moeda), "Custo"]}
          />
          <Bar dataKey="custo" fill="var(--chart-2)" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function UsoPorAplicacao({ baseParams }: { baseParams: Record<string, string | undefined> }) {
  const q = useMetricas({ ...baseParams, grupo: "aplicacao" });
  const data = (q.data ?? []).slice().sort((a, b) => (b.custo ?? 0) - (a.custo ?? 0));
  const moeda = data[0]?.moeda ?? "USD";

  if (!q.isLoading && data.length <= 1) return null;

  return (
    <ChartCard
      title="Uso por aplicação"
      loading={q.isLoading}
      error={q.error}
      empty={!q.isLoading && data.length === 0}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="grupo" stroke="var(--muted-foreground)" fontSize={12} />
          <YAxis
            stroke="var(--muted-foreground)"
            fontSize={12}
            tickFormatter={(v) => formatCompact(v)}
          />
          <Tooltip
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              color: "var(--popover-foreground)",
            }}
            formatter={(v: number) => [formatCurrency(v, moeda), "Custo"]}
          />
          <Bar dataKey="custo" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
