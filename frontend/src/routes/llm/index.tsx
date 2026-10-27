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
import {
  OUTROS,
  SERIES,
  eixo,
  formatFatia,
  legendaComValores,
  porcentagensQueFecham,
  rotuloDeValor,
  rotuloNoCentro,
  tooltipEstilo,
  truncarRotulo,
} from "@/lib/grafico";
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
 * A rosca do custo por modelo, com o custo do período no centro e, na legenda, o valor e a fatia
 * de cada um sobre esse total.
 *
 * As séries do wide-ui são cinco: com até cinco modelos, cada um ganha a sua. Com mais, a sexta
 * cor repetiria a primeira, então ficam os quatro maiores em c1..c4 e uma fatia "Outros" em
 * neutro, igual ao total do período (do banco, a consulta sem `grupo`) menos os quatro. É uma
 * diferença entre dois números do banco, não a soma das fatias no browser — e é ela que faz o
 * anel fechar o total escrito no centro.
 *
 * A fatia sai com uma casa decimal, e as porcentagens são distribuídas pelo maior resto para
 * somarem exatamente 100% do centro.
 */
function CustoPorModelo({ baseParams }: { baseParams: Params }) {
  const q = useMetricas({ ...baseParams, grupo: "modelo" });
  // A mesma chave do medidor: não abre request.
  const qTotais = useMetricas(baseParams);
  const totais = qTotais.data?.[0];
  const modelos = (q.data ?? [])
    .filter((d) => (d.custo ?? 0) > 0)
    .sort((a, b) => (b.custo ?? 0) - (a.custo ?? 0));
  const moeda = modelos[0]?.moeda ?? totais?.moeda ?? "USD";
  const totalDoPeriodo = totais?.custo ?? null;

  const recortado = modelos.length > SERIES.length;
  const fatias: Fatia[] = (recortado ? modelos.slice(0, SERIES.length - 1) : modelos).map(
    (d, i) => ({ nome: d.grupo ?? "", custo: d.custo ?? 0, cor: SERIES[i] }),
  );
  if (recortado && totalDoPeriodo !== null) {
    const outros = totalDoPeriodo - fatias.reduce((s, f) => s + f.custo, 0);
    // Abaixo disso é resto de ponto flutuante, não dinheiro: a fatia some.
    if (outros > 1e-6) fatias.push({ nome: OUTROS.nome, custo: outros, cor: OUTROS.cor });
  }

  const porcentagens = porcentagensQueFecham(
    fatias.map((f) => f.custo),
    totalDoPeriodo,
  );
  const valores: Record<string, string> = {};
  fatias.forEach((f, i) => {
    const p = porcentagens[i];
    valores[f.nome] = dinheiro(f.custo, moeda) + (p !== undefined ? ` · ${formatFatia(p)}` : "");
  });
  const legenda = legendaComValores(valores, { por: "nome" });

  // Recortado, a fatia "Outros" depende do total: sem ele o anel não fecha, então o quadro
  // espera (ou falha) junto com a consulta dos totais.
  const carregando = q.isLoading || (recortado && qTotais.isLoading);
  const erro = q.error ?? (recortado ? qTotais.error : null);

  return (
    <PainelCard
      title="Custo por modelo"
      icon={ChartPie}
      hint={recortado ? `${SERIES.length - 1} maiores + outros` : undefined}
      loading={carregando}
      error={erro}
      onRetry={() => {
        void q.refetch();
        if (qTotais.error) void qTotais.refetch();
      }}
      empty={!carregando && fatias.length === 0}
      emptyMessage="Nenhum modelo com custo apurado. Verifique se há preço vigente para o período."
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip {...tooltipEstilo} formatter={(v: number) => formatCurrency(v, moeda)} />
          <Legend {...legenda} />
          <Pie
            data={fatias}
            dataKey="custo"
            nameKey="nome"
            cx="50%"
            cy="50%"
            innerRadius="62%"
            outerRadius="88%"
            paddingAngle={2}
            stroke="var(--card)"
            strokeWidth={2}
          >
            {fatias.map((f) => (
              <Cell key={f.nome} fill={f.cor} />
            ))}
            {totalDoPeriodo !== null && (
              <Label position="center" content={rotuloNoCentro(dinheiro(totalDoPeriodo, moeda))} />
            )}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </PainelCard>
  );
}

type Fatia = { nome: string; custo: number; cor: string };

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

  if (!q.isLoading && !q.error && data.length <= 1) return null;

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
