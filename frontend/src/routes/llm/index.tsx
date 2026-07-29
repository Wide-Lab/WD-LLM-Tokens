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

import { FiltroModelo } from "@/components/filtro-modelo";
import { GlobalFilters } from "@/components/global-filters";
import { Medidor } from "@/components/medidor";
import { PainelCard } from "@/components/painel-card";
import { eixo, tooltipEstilo } from "@/lib/grafico";
import { apiGet } from "@/lib/api";
import { useFilters, filtersToParams } from "@/lib/filters";
import { formatCompact, formatCurrency, formatNumber } from "@/lib/format";
import type { MetricaBucket } from "@/lib/api-types";

export const Route = createFileRoute("/llm/")({
  head: () => ({
    meta: [
      { title: "LLM — Painel de custos" },
      {
        name: "description",
        content: "Resumo de requisições, tokens e custos de LLM por período.",
      },
      { property: "og:title", content: "LLM — Painel de custos" },
      {
        property: "og:description",
        content: "KPIs e gráficos de consumo de tokens e custo de modelos de linguagem.",
      },
    ],
  }),
  component: Overview,
});

/** A rampa violeta: todo gráfico de dinheiro sai daqui. */
const RAMPA_CUSTO = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function useMetricas(params: Record<string, string | undefined>) {
  return useQuery({
    queryKey: ["metricas-llm", params],
    queryFn: () => apiGet<MetricaBucket[]>("/v1/llm/metricas", params),
  });
}

function Overview() {
  const { filters } = useFilters();

  // `modelo` entra aqui e não em `filtersToParams`: é o filtro que só este painel tem.
  const base = { ...filtersToParams(filters), modelo: filters.modelo || undefined };

  return (
    <div className="flex flex-col gap-4">
      <GlobalFilters>
        <FiltroModelo />
      </GlobalFilters>
      <Leitura baseParams={base} />
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

function Leitura({ baseParams }: { baseParams: Record<string, string | undefined> }) {
  const q = useMetricas(baseParams);
  return <Medidor totais={q.data?.[0]} carregando={q.isLoading} erro={q.error} />;
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
    <PainelCard
      title="Custo ao longo do tempo"
      hint={
        granularidade === "dia" ? "por dia" : granularidade === "semana" ? "por semana" : "por mês"
      }
      loading={q.isLoading}
      error={q.error}
      empty={!q.isLoading && data.length === 0}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="periodo" {...eixo} />
          <YAxis {...eixo} tickFormatter={(v) => formatCompact(v)} width={52} />
          <Tooltip
            {...tooltipEstilo}
            formatter={(v: number) => [formatCurrency(v, moeda), "Custo"]}
          />
          <Line
            type="monotone"
            dataKey="custo"
            stroke="var(--custo)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </PainelCard>
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
    // Sem legenda própria: a fita do medidor, no topo da página, já ensina as quatro cores.
    <PainelCard
      title="Tokens ao longo do tempo"
      hint="entrada · saída · cache"
      loading={q.isLoading}
      error={q.error}
      empty={!q.isLoading && data.length === 0}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="periodo" {...eixo} />
          <YAxis {...eixo} tickFormatter={(v) => formatCompact(v)} width={52} />
          <Tooltip {...tooltipEstilo} formatter={(v: number) => formatNumber(v)} />
          <Bar dataKey="tokens_entrada" stackId="t" fill="var(--balde-entrada)" name="Entrada" />
          <Bar dataKey="tokens_saida" stackId="t" fill="var(--balde-saida)" name="Saída" />
          <Bar
            dataKey="tokens_cache_leitura"
            stackId="t"
            fill="var(--balde-cache-leitura)"
            name="Cache leitura"
          />
          <Bar
            dataKey="tokens_cache_escrita"
            stackId="t"
            fill="var(--balde-cache-escrita)"
            name="Cache escrita"
            radius={[2, 2, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </PainelCard>
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
    <PainelCard
      title="Custo por modelo"
      hint="fatia do gasto"
      loading={q.isLoading}
      error={q.error}
      empty={!q.isLoading && data.length === 0}
      emptyMessage="Nenhum modelo com custo apurado. Verifique se há preço vigente para o período."
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip {...tooltipEstilo} formatter={(v: number) => formatCurrency(v, moeda)} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Pie
            data={data}
            dataKey="custo"
            nameKey="grupo"
            cx="50%"
            cy="50%"
            innerRadius={58}
            outerRadius={92}
            paddingAngle={2}
            stroke="var(--card)"
            strokeWidth={2}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={RAMPA_CUSTO[i % RAMPA_CUSTO.length]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </PainelCard>
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
    <PainelCard
      title="Atores por custo"
      hint="10 maiores"
      loading={q.isLoading}
      error={q.error}
      empty={!q.isLoading && data.length === 0}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" horizontal={false} />
          <XAxis type="number" {...eixo} tickFormatter={(v) => formatCompact(v)} />
          <YAxis type="category" dataKey="grupo" {...eixo} width={140} />
          <Tooltip
            {...tooltipEstilo}
            cursor={{ fill: "var(--muted)" }}
            formatter={(v: number) => [formatCurrency(v, moeda), "Custo"]}
          />
          <Bar dataKey="custo" fill="var(--custo)" radius={[0, 2, 2, 0]} barSize={14} />
        </BarChart>
      </ResponsiveContainer>
    </PainelCard>
  );
}

function UsoPorAplicacao({ baseParams }: { baseParams: Record<string, string | undefined> }) {
  const q = useMetricas({ ...baseParams, grupo: "aplicacao" });
  const data = (q.data ?? []).slice().sort((a, b) => (b.custo ?? 0) - (a.custo ?? 0));
  const moeda = data[0]?.moeda ?? "USD";

  if (!q.isLoading && data.length <= 1) return null;

  return (
    <PainelCard
      title="Custo por aplicação"
      loading={q.isLoading}
      error={q.error}
      empty={!q.isLoading && data.length === 0}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="grupo" {...eixo} />
          <YAxis {...eixo} tickFormatter={(v) => formatCompact(v)} width={52} />
          <Tooltip
            {...tooltipEstilo}
            cursor={{ fill: "var(--muted)" }}
            formatter={(v: number) => [formatCurrency(v, moeda), "Custo"]}
          />
          <Bar dataKey="custo" fill="var(--custo)" radius={[2, 2, 0, 0]} maxBarSize={64} />
        </BarChart>
      </ResponsiveContainer>
    </PainelCard>
  );
}
