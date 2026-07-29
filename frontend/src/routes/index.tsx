import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Cartao } from "@/components/cartao";
import { GlobalFilters } from "@/components/global-filters";
import { PainelCard } from "@/components/painel-card";
import { ErrorBox } from "@/components/empty-states";
import { ORIGENS, eixo, pivotarPorGrupo, tooltipEstilo, totalDaLinha } from "@/lib/grafico";
import { apiGet } from "@/lib/api";
import { useFilters, filtersToParams } from "@/lib/filters";
import { formatCompact, formatCurrency, formatNumber } from "@/lib/format";
import type { ConsolidadoBucket } from "@/lib/api-types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Visão geral — Painel de custos" },
      {
        name: "description",
        content: "Custo somado de LLM e WhatsApp por período, aplicação e ator.",
      },
      { property: "og:title", content: "Visão geral — Painel de custos" },
      {
        property: "og:description",
        content: "Quanto custou atender: o gasto das duas origens somado no mesmo painel.",
      },
    ],
  }),
  component: Consolidado,
});

type Params = Record<string, string | undefined>;

function useConsolidado(params: Params) {
  return useQuery({
    queryKey: ["consolidado", params],
    queryFn: () => apiGet<ConsolidadoBucket[]>("/v1/consolidado/metricas", params),
  });
}

/**
 * A visão geral — a soma das duas origens, e **só dinheiro**.
 *
 * Nada de medidor de baldes e nada de contagem de mensagem: token não soma com mensagem, e um
 * painel que mostra um número sem significado ensina o leitor a desconfiar dos outros. Volume
 * mora no painel de cada origem; aqui ficam custo, tempo e quem.
 *
 * As duas origens têm a mesma cor nos três gráficos (`ORIGENS`, em `lib/grafico.ts`) — é o que
 * permite ler o último sem voltar à legenda do primeiro.
 */
function Consolidado() {
  const { filters } = useFilters();
  const base = filtersToParams(filters);

  return (
    <div className="flex flex-col gap-4">
      <GlobalFilters />
      <Cartoes baseParams={base} />
      <CustoTemporal baseParams={base} granularidade={filters.granularidade} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <CustoPorAplicacao baseParams={base} />
        <TopAtores baseParams={base} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ cartões */

/**
 * Total, as duas parcelas e os lançamentos.
 *
 * Duas chamadas e não uma: o total sai do balde sem `grupo` e as parcelas do `grupo=origem`.
 * Somar as duas parcelas aqui daria o mesmo número quase sempre — e o "quase" é o problema:
 * `custo: null` ("não sei quanto custou") viraria zero na conta do browser, e o total passaria a
 * afirmar o que ninguém apurou. Quem soma é o banco.
 */
function Cartoes({ baseParams }: { baseParams: Params }) {
  const total = useConsolidado(baseParams);
  const origens = useConsolidado({ ...baseParams, grupo: "origem" });

  const geral = total.data?.[0];
  const moeda = geral?.moeda ?? "USD";
  const erro = total.error ?? origens.error;
  const carregando = total.isLoading || origens.isLoading;

  if (erro) return <ErrorBox error={erro} />;

  const daOrigem = (chave: string) => origens.data?.find((b) => b.grupo === chave);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Cartao
        rotulo="Custo total"
        valor={formatCurrency(geral?.custo, moeda)}
        cor="var(--custo)"
        destaque
        carregando={carregando}
      />
      {ORIGENS.map((o) => {
        const balde = daOrigem(o.chave);
        return (
          <Cartao
            key={o.chave}
            rotulo={`Custo ${o.nome}`}
            valor={formatCurrency(balde?.custo ?? null, balde?.moeda ?? moeda)}
            nota={balde ? `${formatNumber(balde.lancamentos)} lançamentos` : "nada no período"}
            cor={o.cor}
            carregando={carregando}
          />
        );
      })}
      <Cartao
        rotulo="Lançamentos"
        valor={formatNumber(geral?.lancamentos ?? 0)}
        nota="fatos somados no período"
        carregando={carregando}
      />
    </div>
  );
}

/* ----------------------------------------------------------------- gráficos */

/**
 * As duas séries empilhadas, na ordem e nas cores de `ORIGENS`.
 *
 * Função e não componente, chamada como `{barrasDeOrigem()}`: o recharts lê os próprios filhos
 * para descobrir o que desenhar, e um componente meu no meio da árvore seria um elemento que ele
 * não reconhece — o gráfico sairia vazio.
 */
function barrasDeOrigem({ vertical }: { vertical?: boolean } = {}) {
  return ORIGENS.map((o, i) => (
    <Bar
      key={o.chave}
      dataKey={o.chave}
      stackId="origem"
      fill={o.cor}
      name={o.nome}
      // Só o segmento de cima leva canto arredondado, ou a pilha ganha um sulco no meio.
      radius={i === ORIGENS.length - 1 ? (vertical ? [0, 2, 2, 0] : [2, 2, 0, 0]) : undefined}
      {...(vertical ? { barSize: 14 } : { maxBarSize: 64 })}
    />
  ));
}

function CustoTemporal({
  baseParams,
  granularidade,
}: {
  baseParams: Params;
  granularidade: string;
}) {
  const q = useConsolidado({ ...baseParams, grupo: "origem", intervalo: granularidade });
  const dados = pivotarPorGrupo(q.data ?? [], "periodo", "grupo", (b) => b.custo);
  const moeda = q.data?.[0]?.moeda ?? "USD";

  return (
    <PainelCard
      title="Custo ao longo do tempo"
      hint={
        granularidade === "dia" ? "por dia" : granularidade === "semana" ? "por semana" : "por mês"
      }
      loading={q.isLoading}
      error={q.error}
      empty={!q.isLoading && dados.length === 0}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dados} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="periodo" {...eixo} />
          <YAxis {...eixo} tickFormatter={(v) => formatCompact(v)} width={52} />
          <Tooltip
            {...tooltipEstilo}
            cursor={{ fill: "var(--muted)" }}
            formatter={(v: number) => formatCurrency(v, moeda)}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {barrasDeOrigem()}
        </BarChart>
      </ResponsiveContainer>
    </PainelCard>
  );
}

function CustoPorAplicacao({ baseParams }: { baseParams: Params }) {
  const q = useConsolidado({ ...baseParams, grupo: "aplicacao", por_origem: "true" });
  const dados = pivotarPorGrupo(q.data ?? [], "grupo", "origem", (b) => b.custo).sort(
    (a, b) => totalDaLinha(b, "grupo") - totalDaLinha(a, "grupo"),
  );
  const moeda = q.data?.[0]?.moeda ?? "USD";

  return (
    <PainelCard
      title="Custo por aplicação"
      hint="por origem"
      loading={q.isLoading}
      error={q.error}
      empty={!q.isLoading && dados.length === 0}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dados} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="grupo" {...eixo} />
          <YAxis {...eixo} tickFormatter={(v) => formatCompact(v)} width={52} />
          <Tooltip
            {...tooltipEstilo}
            cursor={{ fill: "var(--muted)" }}
            formatter={(v: number) => formatCurrency(v, moeda)}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {barrasDeOrigem()}
        </BarChart>
      </ResponsiveContainer>
    </PainelCard>
  );
}

function TopAtores({ baseParams }: { baseParams: Params }) {
  const q = useConsolidado({ ...baseParams, grupo: "ator", por_origem: "true" });
  const dados = pivotarPorGrupo(q.data ?? [], "grupo", "origem", (b) => b.custo)
    .sort((a, b) => totalDaLinha(b, "grupo") - totalDaLinha(a, "grupo"))
    .slice(0, 10);
  const moeda = q.data?.[0]?.moeda ?? "USD";

  return (
    <PainelCard
      title="Atores por custo"
      hint="10 maiores"
      loading={q.isLoading}
      error={q.error}
      empty={!q.isLoading && dados.length === 0}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dados} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" horizontal={false} />
          <XAxis type="number" {...eixo} tickFormatter={(v) => formatCompact(v)} />
          <YAxis type="category" dataKey="grupo" {...eixo} width={140} />
          <Tooltip
            {...tooltipEstilo}
            cursor={{ fill: "var(--muted)" }}
            formatter={(v: number) => formatCurrency(v, moeda)}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {barrasDeOrigem({ vertical: true })}
        </BarChart>
      </ResponsiveContainer>
    </PainelCard>
  );
}
