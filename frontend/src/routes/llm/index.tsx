import { createFileRoute } from "@tanstack/react-router";
import { useIsFetching, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Label,
  LabelList,
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

import { AppWindow, ChartColumn, ChartLine, ChartPie, RefreshCw, Users } from "lucide-react";

import { CabecalhoDaPagina } from "@/components/cabecalho-da-pagina";
import { FiltroModelo } from "@/components/filtro-modelo";
import { GlobalFilters } from "@/components/global-filters";
import { BALDES, Medidor } from "@/components/medidor";
import { PainelCard } from "@/components/painel-card";
import { Button } from "@/components/ui/button";
import { SERIES, eixo, legendaComValores, tooltipEstilo, truncarRotulo } from "@/lib/grafico";
import { apiGet } from "@/lib/api";
import { useFilters, filtersToParams } from "@/lib/filters";
import {
  formatCompact,
  formatCurrency,
  formatInstante,
  formatNumber,
  formatPeriodo,
  formatPeriodoCompleto,
} from "@/lib/format";
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

type Params = Record<string, string | undefined>;

function useMetricas(params: Params) {
  return useQuery({
    queryKey: ["metricas-llm", params],
    queryFn: () => apiGet<MetricaBucket[]>("/v1/llm/metricas", params),
  });
}

/**
 * Os totais do período, sem `grupo` nem `intervalo` — a mesma chave do medidor, então ler daqui
 * para a legenda de um gráfico não abre request nova. É de onde sai todo valor de legenda: o
 * número vem do banco, nunca da soma das barras no browser.
 */
function useTotais(baseParams: Params) {
  return useMetricas(baseParams).data?.[0];
}

/** Dinheiro de legenda e de rótulo de barra: duas casas, como no tile. */
function dinheiro(valor: number | null | undefined, moeda: string) {
  return formatCurrency(valor ?? null, moeda, { casas: 2 });
}

function Overview() {
  const { filters } = useFilters();

  // `modelo` entra aqui e não em `filtersToParams`: é o filtro que só este painel tem.
  const base = { ...filtersToParams(filters), modelo: filters.modelo || undefined };

  // A mesma chave do medidor: não abre request, só lê a hora em que os totais chegaram.
  const total = useMetricas(base);
  const queryClient = useQueryClient();
  const atualizando = useIsFetching({ queryKey: ["metricas-llm"] }) > 0;

  return (
    <div className="flex flex-col gap-4">
      <CabecalhoDaPagina
        titulo="Painel de LLM"
        subtitulo={
          <>
            Tokens consumidos e quanto custaram, por modelo, ator e aplicação
            {total.dataUpdatedAt > 0 && <> · dados de {formatInstante(total.dataUpdatedAt)}</>}
          </>
        }
        acoes={
          <Button
            variant="outline"
            disabled={atualizando}
            onClick={() => void queryClient.invalidateQueries({ queryKey: ["metricas-llm"] })}
          >
            <RefreshCw className={atualizando ? "animate-spin" : undefined} />
            Atualizar
          </Button>
        }
      />
      <GlobalFilters recortesDaSecao={["modelo"]}>
        <FiltroModelo />
      </GlobalFilters>
      <Leitura baseParams={base} />
      <div className="grid grid-cols-1 gap-3 min-[1180px]:grid-cols-2">
        <CustoTemporal baseParams={base} granularidade={filters.granularidade} />
        <TokensTemporal baseParams={base} granularidade={filters.granularidade} />
      </div>
      <div className="grid grid-cols-1 gap-3 min-[1180px]:grid-cols-2">
        <CustoPorModelo baseParams={base} />
        <TopAtores baseParams={base} />
      </div>
      <UsoPorAplicacao baseParams={base} />
    </div>
  );
}

function Leitura({ baseParams }: { baseParams: Params }) {
  const q = useMetricas(baseParams);
  return (
    <Medidor
      totais={q.data?.[0]}
      carregando={q.isLoading}
      erro={q.error}
      onRetry={() => void q.refetch()}
    />
  );
}

function dicaDaGranularidade(granularidade: string) {
  return granularidade === "dia"
    ? "por dia"
    : granularidade === "semana"
      ? "por semana"
      : "por mês";
}

function CustoTemporal({
  baseParams,
  granularidade,
}: {
  baseParams: Params;
  granularidade: string;
}) {
  const q = useMetricas({ ...baseParams, intervalo: granularidade });
  const data = q.data ?? [];
  const totais = useTotais(baseParams);
  const moeda = data[0]?.moeda ?? totais?.moeda ?? "USD";
  const legenda = legendaComValores({
    custo: totais ? dinheiro(totais.custo, totais.moeda ?? moeda) : undefined,
  });

  return (
    <PainelCard
      title="Custo ao longo do tempo"
      icon={ChartLine}
      hint={dicaDaGranularidade(granularidade)}
      loading={q.isLoading}
      error={q.error}
      onRetry={() => void q.refetch()}
      empty={!q.isLoading && data.length === 0}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="periodo"
            {...eixo}
            tickFormatter={(v) => formatPeriodo(v, granularidade)}
          />
          <YAxis {...eixo} tickFormatter={(v) => formatCompact(v)} width={52} />
          <Tooltip
            {...tooltipEstilo}
            labelFormatter={(v) => formatPeriodoCompleto(String(v), granularidade)}
            formatter={(v: number) => [formatCurrency(v, moeda), "Custo"]}
          />
          <Legend {...legenda} />
          <Line
            type="monotone"
            dataKey="custo"
            name="Custo"
            stroke="var(--origem-llm)"
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
  baseParams: Params;
  granularidade: string;
}) {
  const q = useMetricas({ ...baseParams, intervalo: granularidade });
  const data = q.data ?? [];
  const totais = useTotais(baseParams);

  // A legenda repete o total de cada balde no período, como a fita do medidor: o tooltip não
  // existe no toque, e sem número a legenda só ensinaria a cor. Ordem e cores saem de `BALDES`,
  // para o gráfico e a fita nunca divergirem.
  const legenda = legendaComValores(
    Object.fromEntries(
      BALDES.map((b) => [b.chave, totais ? formatNumber(totais[b.chave]) : undefined]),
    ),
  );

  return (
    <PainelCard
      title="Tokens ao longo do tempo"
      icon={ChartColumn}
      hint={dicaDaGranularidade(granularidade)}
      loading={q.isLoading}
      error={q.error}
      onRetry={() => void q.refetch()}
      empty={!q.isLoading && data.length === 0}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="periodo"
            {...eixo}
            tickFormatter={(v) => formatPeriodo(v, granularidade)}
          />
          <YAxis {...eixo} tickFormatter={(v) => formatCompact(v)} width={60} />
          <Tooltip
            {...tooltipEstilo}
            labelFormatter={(v) => formatPeriodoCompleto(String(v), granularidade)}
            formatter={(v: number) => formatNumber(v)}
          />
          <Legend {...legenda} />
          {BALDES.map((b, i) => (
            <Bar
              key={b.chave}
              dataKey={b.chave}
              stackId="t"
              fill={b.cor}
              name={b.nome}
              // Só o segmento de cima leva canto arredondado, ou a pilha ganha um sulco no meio.
              radius={i === BALDES.length - 1 ? [3, 3, 0, 0] : undefined}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </PainelCard>
  );
}

/**
 * A rosca dos modelos mais caros, com o custo do período no centro e, na legenda, o valor e a
 * fatia de cada um sobre esse total.
 *
 * São cinco, e não mais, porque as séries do wide-ui são cinco: a sexta fatia repetiria a cor da
 * primeira, e a legenda deixaria de dizer qual é qual. O total e as porcentagens vêm do banco (a
 * consulta sem `grupo`), não da soma das fatias — com mais de cinco modelos as fatias não somam o
 * período, e o centro diria um total que não existe.
 */
function CustoPorModelo({ baseParams }: { baseParams: Params }) {
  const q = useMetricas({ ...baseParams, grupo: "modelo" });
  const data = (q.data ?? [])
    .filter((d) => (d.custo ?? 0) > 0)
    .sort((a, b) => (b.custo ?? 0) - (a.custo ?? 0))
    .slice(0, SERIES.length);
  const totais = useTotais(baseParams);
  const moeda = data[0]?.moeda ?? totais?.moeda ?? "USD";
  const totalDoPeriodo = totais?.custo ?? null;

  const valores: Record<string, string> = {};
  for (const d of data) {
    const fatia =
      totalDoPeriodo && totalDoPeriodo > 0
        ? ` · ${(((d.custo ?? 0) / totalDoPeriodo) * 100).toFixed(1).replace(".", ",")}%`
        : "";
    valores[d.grupo ?? ""] = dinheiro(d.custo, d.moeda ?? moeda) + fatia;
  }
  const legenda = legendaComValores(valores, { por: "nome" });

  return (
    <PainelCard
      title="Custo por modelo"
      icon={ChartPie}
      hint={`${SERIES.length} maiores`}
      loading={q.isLoading}
      error={q.error}
      onRetry={() => void q.refetch()}
      empty={!q.isLoading && data.length === 0}
      emptyMessage="Nenhum modelo com custo apurado. Verifique se há preço vigente para o período."
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip {...tooltipEstilo} formatter={(v: number) => formatCurrency(v, moeda)} />
          <Legend {...legenda} />
          <Pie
            data={data}
            dataKey="custo"
            nameKey="grupo"
            cx="50%"
            cy="50%"
            innerRadius="62%"
            outerRadius="88%"
            paddingAngle={2}
            stroke="var(--card)"
            strokeWidth={2}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={SERIES[i]} />
            ))}
            {totalDoPeriodo !== null && (
              <Label
                position="center"
                content={({ viewBox }) => {
                  const { cx, cy } = (viewBox ?? {}) as { cx?: number; cy?: number };
                  if (cx === undefined || cy === undefined) return null;
                  return (
                    <text x={cx} y={cy} textAnchor="middle">
                      <tspan x={cx} dy="-0.2em" fill="var(--wu-fg)" fontSize={15} fontWeight={600}>
                        {dinheiro(totalDoPeriodo, moeda)}
                      </tspan>
                      <tspan x={cx} dy="1.5em" fill="var(--wu-muted)" fontSize={12}>
                        no período
                      </tspan>
                    </text>
                  );
                }}
              />
            )}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </PainelCard>
  );
}

/** O rótulo de valor na ponta de cada barra: é a legenda com valor de um gráfico de uma série só. */
const rotuloDeValor = { fill: "var(--wu-fg)", fontSize: 12 } as const;

function TopAtores({ baseParams }: { baseParams: Params }) {
  const q = useMetricas({ ...baseParams, grupo: "ator" });
  const data = (q.data ?? [])
    .slice()
    .sort((a, b) => (b.custo ?? 0) - (a.custo ?? 0))
    .slice(0, 10);
  const moeda = data[0]?.moeda ?? "USD";
  return (
    <PainelCard
      title="Atores por custo"
      icon={Users}
      hint="10 maiores"
      loading={q.isLoading}
      error={q.error}
      onRetry={() => void q.refetch()}
      empty={!q.isLoading && data.length === 0}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 80, left: 4, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" horizontal={false} />
          <XAxis type="number" {...eixo} tickFormatter={(v) => formatCompact(v)} />
          <YAxis
            type="category"
            dataKey="grupo"
            {...eixo}
            width={120}
            tickFormatter={(v) => truncarRotulo(String(v), 15)}
          />
          <Tooltip
            {...tooltipEstilo}
            formatter={(v: number) => [formatCurrency(v, moeda), "Custo"]}
          />
          <Bar dataKey="custo" fill="var(--origem-llm)" radius={[0, 3, 3, 0]} barSize={14}>
            <LabelList
              dataKey="custo"
              position="right"
              {...rotuloDeValor}
              formatter={(v: number) => dinheiro(v, moeda)}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </PainelCard>
  );
}

function UsoPorAplicacao({ baseParams }: { baseParams: Params }) {
  const q = useMetricas({ ...baseParams, grupo: "aplicacao" });
  const data = (q.data ?? []).slice().sort((a, b) => (b.custo ?? 0) - (a.custo ?? 0));
  const moeda = data[0]?.moeda ?? "USD";

  if (!q.isLoading && data.length <= 1) return null;

  return (
    <PainelCard
      title="Custo por aplicação"
      icon={AppWindow}
      loading={q.isLoading}
      error={q.error}
      onRetry={() => void q.refetch()}
      empty={!q.isLoading && data.length === 0}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 24, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="grupo" {...eixo} tickFormatter={(v) => truncarRotulo(String(v))} />
          <YAxis {...eixo} tickFormatter={(v) => formatCompact(v)} width={52} />
          <Tooltip
            {...tooltipEstilo}
            formatter={(v: number) => [formatCurrency(v, moeda), "Custo"]}
          />
          <Bar dataKey="custo" fill="var(--origem-llm)" radius={[3, 3, 0, 0]} maxBarSize={64}>
            <LabelList
              dataKey="custo"
              position="top"
              {...rotuloDeValor}
              formatter={(v: number) => dinheiro(v, moeda)}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </PainelCard>
  );
}
