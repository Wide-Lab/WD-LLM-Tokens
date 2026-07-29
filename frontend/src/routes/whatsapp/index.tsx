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

import { Cartao } from "@/components/cartao";
import { ErrorBox } from "@/components/empty-states";
import { FiltrosWhatsapp } from "@/components/filtros-whatsapp";
import { GlobalFilters } from "@/components/global-filters";
import { PainelCard } from "@/components/painel-card";
import {
  SERIES_DE_CATEGORIA,
  eixo,
  pivotarPorGrupo,
  tooltipEstilo,
  visualDaCategoria,
} from "@/lib/grafico";
import { apiGet } from "@/lib/api";
import { useFilters, whatsappToParams } from "@/lib/filters";
import { formatCompact, formatCurrency, formatNumber } from "@/lib/format";
import type { MensagemBucket } from "@/lib/api-types";

export const Route = createFileRoute("/whatsapp/")({
  head: () => ({
    meta: [
      { title: "WhatsApp — Painel de custos" },
      {
        name: "description",
        content: "Mensagens cobráveis e custo da WhatsApp Business Platform por período.",
      },
      { property: "og:title", content: "WhatsApp — Painel de custos" },
      {
        property: "og:description",
        content: "Quanto do atendimento saiu da janela gratuita, e quanto isso custou.",
      },
    ],
  }),
  component: PainelWhatsapp,
});

type Params = Record<string, string | undefined>;

function useMetricas(params: Params) {
  return useQuery({
    queryKey: ["metricas-whatsapp", params],
    queryFn: () => apiGet<MensagemBucket[]>("/v1/whatsapp/metricas", params),
  });
}

/**
 * O painel da segunda origem: estruturalmente o de LLM, com outro vocabulário.
 *
 * O que muda não é o desenho, é a unidade. Lá a pergunta de volume é "quantos tokens"; aqui é
 * "quantas mensagens, e quantas delas a Meta cobrou" — e é essa segunda metade que manda no gasto,
 * porque a tarifa é por mensagem cobrável e o resto da conversa é grátis.
 */
function PainelWhatsapp() {
  const { filters } = useFilters();

  // `categoria` e `direcao` entram aqui e não em `filtersToParams`: são os filtros que só esta
  // seção tem, do mesmo jeito que o `modelo` é só do LLM.
  const base = whatsappToParams(filters);

  return (
    <div className="flex flex-col gap-4">
      <GlobalFilters>
        <FiltrosWhatsapp />
      </GlobalFilters>
      <Cartoes baseParams={base} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <CustoTemporal baseParams={base} granularidade={filters.granularidade} />
        <MensagensTemporal baseParams={base} granularidade={filters.granularidade} />
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <CustoPorCategoria baseParams={base} />
        <TopAtores baseParams={base} />
      </div>
      <CustoPorPais baseParams={base} />
    </div>
  );
}

/* ------------------------------------------------------------------ cartões */

/**
 * Mensagens, cobráveis, custo e o custo unitário — nesta ordem.
 *
 * A fração de cobráveis vem em segundo porque é o número que se **mexe**: quanto do atendimento
 * caiu fora da janela gratuita é o que dá para reduzir mudando como se responde, enquanto a tarifa
 * é da Meta e o volume é da demanda. Por isso ela ganha a fita de proporção, e não um rodapé.
 */
function Cartoes({ baseParams }: { baseParams: Params }) {
  const q = useMetricas(baseParams);

  // Sem `grupo` e sem `intervalo` a agregação devolve sempre uma linha, mesmo vazia — os zeros
  // são resposta, não ausência de resposta.
  const total = q.data?.[0];
  const moeda = total?.moeda ?? "USD";
  const mensagens = total?.mensagens ?? 0;
  const cobraveis = total?.cobraveis ?? 0;
  const custo = total?.custo ?? null;

  if (q.error) return <ErrorBox error={q.error} />;

  const fracao = mensagens > 0 ? cobraveis / mensagens : 0;

  // A divisão que não pode virar `NaN` nem `Infinity`: sem mensagem cobrável não existe custo por
  // mensagem cobrável, e `—` é a única resposta honesta. `custo: null` cai no mesmo `—` pelo outro
  // motivo — "não sei quanto custou" —, e é o `formatCurrency` que já trata isso.
  const unitario = custo !== null && cobraveis > 0 ? custo / cobraveis : null;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Cartao
        rotulo="Mensagens"
        valor={formatNumber(mensagens)}
        nota="no período, nas duas direções"
        carregando={q.isLoading}
      />
      <Cartao
        rotulo="Cobráveis"
        valor={formatNumber(cobraveis)}
        nota={
          mensagens > 0
            ? `de ${formatNumber(mensagens)} · ${(fracao * 100).toFixed(0)}%`
            : "nada no período"
        }
        cor="var(--custo)"
        carregando={q.isLoading}
      >
        <Fita fracao={fracao} />
      </Cartao>
      <Cartao
        rotulo="Custo"
        valor={formatCurrency(custo, moeda)}
        destaque
        carregando={q.isLoading}
      />
      <Cartao
        rotulo="Custo por mensagem cobrável"
        valor={formatCurrency(unitario, moeda)}
        nota={cobraveis > 0 ? "tarifa média do período" : "sem mensagem cobrável"}
        carregando={q.isLoading}
      />
    </div>
  );
}

/** A fração desenhada, na mesma gramática do medidor: o trecho pago sobre o total. */
function Fita({ fracao }: { fracao: number }) {
  return (
    <div className="bg-muted h-[3px] w-full overflow-hidden rounded-full" aria-hidden>
      <div className="bg-custo h-full" style={{ width: `${fracao * 100}%` }} />
    </div>
  );
}

/* ----------------------------------------------------------------- gráficos */

function rotuloDaGranularidade(g: string): string {
  return g === "dia" ? "por dia" : g === "semana" ? "por semana" : "por mês";
}

function CustoTemporal({
  baseParams,
  granularidade,
}: {
  baseParams: Params;
  granularidade: string;
}) {
  const q = useMetricas({ ...baseParams, intervalo: granularidade });
  const dados = q.data ?? [];
  const moeda = dados[0]?.moeda ?? "USD";

  return (
    <PainelCard
      title="Custo ao longo do tempo"
      hint={rotuloDaGranularidade(granularidade)}
      loading={q.isLoading}
      error={q.error}
      empty={!q.isLoading && dados.length === 0}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={dados} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
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

/**
 * O volume empilhado por categoria — o par do "Tokens ao longo do tempo" do LLM.
 *
 * Só as séries que existem no período viram barra: renderizar as cinco sempre encheria a legenda de
 * categorias que não aconteceram, e uma legenda que lista o que não está no gráfico ensina a não
 * ler a legenda.
 */
function MensagensTemporal({
  baseParams,
  granularidade,
}: {
  baseParams: Params;
  granularidade: string;
}) {
  const q = useMetricas({ ...baseParams, grupo: "categoria", intervalo: granularidade });
  const dados = pivotarPorGrupo(q.data ?? [], "periodo", "grupo", (b) => b.mensagens);
  const series = SERIES_DE_CATEGORIA.filter((s) => dados.some((l) => l[s.chave] !== undefined));

  return (
    <PainelCard
      title="Mensagens ao longo do tempo"
      hint={rotuloDaGranularidade(granularidade)}
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
            formatter={(v: number) => formatNumber(v)}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {series.map((s, i) => (
            <Bar
              key={s.chave}
              dataKey={s.chave}
              stackId="categoria"
              fill={s.cor}
              name={s.nome}
              radius={i === series.length - 1 ? [2, 2, 0, 0] : undefined}
              maxBarSize={64}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </PainelCard>
  );
}

function CustoPorCategoria({ baseParams }: { baseParams: Params }) {
  const q = useMetricas({ ...baseParams, grupo: "categoria" });

  // As que somam zero saem: `service` e o balde das recebidas não custam nada, e uma fatia de
  // ângulo zero na rosca vira só uma entrada de legenda prometendo gasto que não existe.
  const dados = (q.data ?? [])
    .filter((b) => (b.custo ?? 0) > 0)
    .sort((a, b) => (b.custo ?? 0) - (a.custo ?? 0));
  const moeda = dados[0]?.moeda ?? "USD";

  return (
    <PainelCard
      title="Custo por categoria"
      hint="fatia do gasto"
      loading={q.isLoading}
      error={q.error}
      empty={!q.isLoading && dados.length === 0}
      emptyMessage="Nenhuma categoria com custo apurado. Verifique se há preço vigente para o país e o período."
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip {...tooltipEstilo} formatter={(v: number) => formatCurrency(v, moeda)} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Pie
            data={dados}
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
            {dados.map((b) => (
              <Cell
                key={b.grupo}
                fill={visualDaCategoria(b.grupo)?.cor ?? "var(--muted-foreground)"}
              />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </PainelCard>
  );
}

function TopAtores({ baseParams }: { baseParams: Params }) {
  const q = useMetricas({ ...baseParams, grupo: "ator" });
  const dados = (q.data ?? [])
    .slice()
    .sort((a, b) => (b.custo ?? 0) - (a.custo ?? 0))
    .slice(0, 10);
  const moeda = dados[0]?.moeda ?? "USD";

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
            formatter={(v: number) => [formatCurrency(v, moeda), "Custo"]}
          />
          <Bar dataKey="custo" fill="var(--custo)" radius={[0, 2, 2, 0]} barSize={14} />
        </BarChart>
      </ResponsiveContainer>
    </PainelCard>
  );
}

/**
 * Só aparece com mais de um país no período, como o "Custo por aplicação" do LLM.
 *
 * Com um país só o gráfico é uma barra do tamanho do total, que o card de custo já disse — e a
 * tarifa do WhatsApp muda por país, então o quadro só ensina alguma coisa quando há o que comparar.
 */
function CustoPorPais({ baseParams }: { baseParams: Params }) {
  const q = useMetricas({ ...baseParams, grupo: "pais" });
  const dados = (q.data ?? []).slice().sort((a, b) => (b.custo ?? 0) - (a.custo ?? 0));
  const moeda = dados[0]?.moeda ?? "USD";

  if (!q.isLoading && dados.length <= 1) return null;

  return (
    <PainelCard
      title="Custo por país"
      hint="a tarifa muda por destino"
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
            formatter={(v: number) => [formatCurrency(v, moeda), "Custo"]}
          />
          <Bar dataKey="custo" fill="var(--custo)" radius={[2, 2, 0, 0]} maxBarSize={64} />
        </BarChart>
      </ResponsiveContainer>
    </PainelCard>
  );
}
