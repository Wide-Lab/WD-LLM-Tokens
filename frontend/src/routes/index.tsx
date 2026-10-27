import { createFileRoute } from "@tanstack/react-router";
import { useIsFetching, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from "recharts";

import { AppWindow, ChartColumn, Layers, RefreshCw, Users, Wallet } from "lucide-react";

import { CabecalhoDaPagina } from "@/components/cabecalho-da-pagina";
import { Cartao } from "@/components/cartao";
import { GlobalFilters } from "@/components/global-filters";
import { PainelCard } from "@/components/painel-card";
import { ErrorBox } from "@/components/empty-states";
import { Button } from "@/components/ui/button";
import {
  ORIGENS,
  eixo,
  legendaComValores,
  pivotarPorGrupo,
  tooltipEstilo,
  totalDaLinha,
} from "@/lib/grafico";
import { apiGet } from "@/lib/api";
import { useFilters, filtersToParams } from "@/lib/filters";
import {
  formatCompact,
  formatCurrency,
  formatDateOnly,
  formatNumber,
  formatPeriodo,
  formatTime,
  toISODate,
} from "@/lib/format";
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

  // A mesma chave do total dos cartões: não abre request, só lê a hora em que ele chegou.
  const total = useConsolidado(base);
  const queryClient = useQueryClient();
  const atualizando = useIsFetching({ queryKey: ["consolidado"] }) > 0;

  return (
    <div className="flex flex-col gap-4">
      <CabecalhoDaPagina
        titulo="Visão geral"
        subtitulo={
          <>
            Quanto custou atender: LLM e WhatsApp somados no mesmo período
            {total.dataUpdatedAt > 0 && <> · dados de {dataEHora(total.dataUpdatedAt)}</>}
          </>
        }
        acoes={
          <Button
            variant="outline"
            disabled={atualizando}
            onClick={() => void queryClient.invalidateQueries({ queryKey: ["consolidado"] })}
          >
            <RefreshCw className={atualizando ? "animate-spin" : undefined} />
            Atualizar
          </Button>
        }
      />
      <GlobalFilters />
      <Cartoes baseParams={base} />
      <CustoTemporal baseParams={base} granularidade={filters.granularidade} />
      <div className="grid grid-cols-1 gap-3 min-[1180px]:grid-cols-2">
        <CustoPorAplicacao baseParams={base} />
        <TopAtores baseParams={base} />
      </div>
    </div>
  );
}

/** `dd/mm/aaaa HH:mm` de um instante, no fuso do navegador — quando o painel recebeu os dados. */
function dataEHora(ms: number): string {
  const d = new Date(ms);
  return `${formatDateOnly(toISODate(d))} ${formatTime(d.toISOString())}`;
}

/* ------------------------------------------------------------------ cartões */

/**
 * Total, as duas parcelas e os lançamentos.
 *
 * Duas chamadas e não uma: o total sai do balde sem `grupo` e as parcelas do `grupo=origem`.
 * Somar as duas parcelas aqui daria o mesmo número quase sempre — e o "quase" é o problema:
 * `custo: null` ("não sei quanto custou") viraria zero na conta do browser, e o total passaria a
 * afirmar o que ninguém apurou. Quem soma é o banco.
 *
 * O dinheiro vai com duas casas (`R$ 1.284,60`): o tile é lido de longe, e as quatro casas
 * continuam no tooltip dos gráficos.
 */
function Cartoes({ baseParams }: { baseParams: Params }) {
  const total = useConsolidado(baseParams);
  const origens = useConsolidado({ ...baseParams, grupo: "origem" });

  const geral = total.data?.[0];
  const moeda = geral?.moeda ?? "USD";
  const erro = total.error ?? origens.error;
  const carregando = total.isLoading || origens.isLoading;

  if (erro)
    return (
      <ErrorBox
        error={erro}
        onRetry={() => {
          void total.refetch();
          void origens.refetch();
        }}
      />
    );

  const daOrigem = (chave: string) => origens.data?.find((b) => b.grupo === chave);

  return (
    <div className="grid grid-cols-2 gap-3 min-[1100px]:grid-cols-4">
      <Cartao
        rotulo="Custo total"
        icone={Wallet}
        nota="LLM e WhatsApp somados"
        valor={formatCurrency(geral?.custo, moeda, { casas: 2 })}
        carregando={carregando}
      />
      {ORIGENS.map((o) => {
        const balde = daOrigem(o.chave);
        return (
          <Cartao
            key={o.chave}
            rotulo={`Custo ${o.nome}`}
            valor={formatCurrency(balde?.custo ?? null, balde?.moeda ?? moeda, { casas: 2 })}
            nota={balde ? `${formatNumber(balde.lancamentos)} lançamentos` : "nada no período"}
            cor={o.cor}
            carregando={carregando}
          />
        );
      })}
      <Cartao
        rotulo="Lançamentos"
        icone={Layers}
        valor={formatNumber(geral?.lancamentos ?? 0)}
        nota="fatos somados no período"
        carregando={carregando}
      />
    </div>
  );
}

/* ----------------------------------------------------------------- gráficos */

/**
 * A legenda das duas origens com o custo de cada uma no período.
 *
 * O número vem da mesma consulta `grupo=origem` dos cartões — mesma chave, então nenhuma request
 * nova — e não da soma das barras: pelo mesmo motivo de `Cartoes`, quem soma é o banco.
 * `sufixo` existe para o gráfico em que a soma das barras **não** é o total (os 10 maiores atores):
 * ali o valor precisa dizer que é do período inteiro, senão parece a soma do que está desenhado.
 */
function useLegendaDeOrigem(baseParams: Params, sufixo = "") {
  const q = useConsolidado({ ...baseParams, grupo: "origem" });
  const valores: Record<string, string> = {};
  if (q.data) {
    for (const o of ORIGENS) {
      const balde = q.data.find((b) => b.grupo === o.chave);
      valores[o.chave] =
        formatCurrency(balde?.custo ?? null, balde?.moeda ?? "USD", { casas: 2 }) + sufixo;
    }
  }
  return legendaComValores(valores);
}

/**
 * O tooltip do eixo de tempo: o balde com ano (só o mês dispensa o dia), uma linha por origem e o
 * total da pilha no rodapé. Conteúdo próprio porque o tooltip padrão do recharts não tem rodapé.
 */
function TooltipDoTempo({
  active,
  payload,
  label,
  granularidade,
  moeda,
}: TooltipProps<number, string> & { granularidade: string; moeda: string }) {
  if (!active || !payload?.length) return null;
  const linha = payload[0]?.payload as Record<string, string | number> | undefined;
  const rotulo =
    granularidade === "mes"
      ? formatPeriodo(String(label), granularidade)
      : formatDateOnly(String(label).slice(0, 10));

  return (
    <div style={{ ...tooltipEstilo.contentStyle, padding: "8px 10px" }}>
      <div style={tooltipEstilo.labelStyle}>{rotulo}</div>
      {payload.map((p) => (
        <div key={String(p.dataKey)} className="flex items-center gap-1.5 py-px">
          <span
            aria-hidden
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ background: p.color }}
          />
          <span className="text-muted-foreground">{p.name}</span>
          <span className="ml-auto pl-4 tabular-nums">
            {formatCurrency(Number(p.value), moeda)}
          </span>
        </div>
      ))}
      {linha && (
        <div className="border-line mt-1 flex items-center gap-1.5 border-t pt-1 font-medium">
          <span>Total</span>
          <span className="ml-auto pl-4 tabular-nums">
            {formatCurrency(totalDaLinha(linha, "periodo"), moeda)}
          </span>
        </div>
      )}
    </div>
  );
}

/** Corta o nome do ator com reticências para caber no eixo; o nome inteiro está no tooltip. */
function truncar(texto: string, max = 18): string {
  return texto.length > max ? `${texto.slice(0, max - 1)}…` : texto;
}

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
      radius={i === ORIGENS.length - 1 ? (vertical ? [0, 3, 3, 0] : [3, 3, 0, 0]) : undefined}
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
  const legenda = useLegendaDeOrigem(baseParams);

  return (
    <PainelCard
      title="Custo ao longo do tempo"
      hint={
        granularidade === "dia" ? "por dia" : granularidade === "semana" ? "por semana" : "por mês"
      }
      icon={ChartColumn}
      loading={q.isLoading}
      error={q.error}
      onRetry={() => void q.refetch()}
      empty={!q.isLoading && dados.length === 0}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dados} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="periodo"
            {...eixo}
            tickFormatter={(v) => formatPeriodo(v, granularidade)}
          />
          <YAxis {...eixo} tickFormatter={(v) => formatCompact(v)} width={52} />
          <Tooltip
            cursor={tooltipEstilo.cursor}
            content={<TooltipDoTempo granularidade={granularidade} moeda={moeda} />}
          />
          <Legend {...legenda} />
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
  const legenda = useLegendaDeOrigem(baseParams);

  return (
    <PainelCard
      title="Custo por aplicação"
      hint="por origem"
      icon={AppWindow}
      loading={q.isLoading}
      error={q.error}
      onRetry={() => void q.refetch()}
      empty={!q.isLoading && dados.length === 0}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dados} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="grupo" {...eixo} />
          <YAxis {...eixo} tickFormatter={(v) => formatCompact(v)} width={52} />
          <Tooltip {...tooltipEstilo} formatter={(v: number) => formatCurrency(v, moeda)} />
          <Legend {...legenda} />
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
  // Os 10 maiores não somam o total da origem: o rótulo diz que o valor é do período inteiro.
  const legenda = useLegendaDeOrigem(baseParams, " no período");

  return (
    <PainelCard
      title="Atores por custo"
      hint="10 maiores"
      icon={Users}
      loading={q.isLoading}
      error={q.error}
      onRetry={() => void q.refetch()}
      empty={!q.isLoading && dados.length === 0}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dados} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" horizontal={false} />
          <XAxis type="number" {...eixo} tickFormatter={(v) => formatCompact(v)} />
          <YAxis
            type="category"
            dataKey="grupo"
            {...eixo}
            width={128}
            tickFormatter={(v) => truncar(String(v))}
          />
          <Tooltip {...tooltipEstilo} formatter={(v: number) => formatCurrency(v, moeda)} />
          <Legend {...legenda} />
          {barrasDeOrigem({ vertical: true })}
        </BarChart>
      </ResponsiveContainer>
    </PainelCard>
  );
}
