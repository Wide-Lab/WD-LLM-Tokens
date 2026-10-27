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
import {
  ChartColumn,
  ChartLine,
  ChartPie,
  Globe,
  MessagesSquare,
  Receipt,
  RefreshCw,
  Tag,
  Users,
  Wallet,
} from "lucide-react";

import { CabecalhoDaPagina } from "@/components/cabecalho-da-pagina";
import { Cartao } from "@/components/cartao";
import { ErrorBox } from "@/components/empty-states";
import { FiltrosWhatsapp } from "@/components/filtros-whatsapp";
import { GlobalFilters } from "@/components/global-filters";
import { PainelCard } from "@/components/painel-card";
import { TooltipDoTempo } from "@/components/tooltip-do-tempo";
import { Button } from "@/components/ui/button";
import {
  SERIES_DE_CATEGORIA,
  eixo,
  formatFatia,
  legendaComValores,
  pivotarPorGrupo,
  porcentagensQueFecham,
  rotuloDeValor,
  rotuloNoCentro,
  tooltipEstilo,
  truncarRotulo,
  visualDaCategoria,
} from "@/lib/grafico";
import { apiGet } from "@/lib/api";
import { useFilters, whatsappToParams } from "@/lib/filters";
import {
  formatCompact,
  formatCurrency,
  formatInstante,
  formatNumber,
  formatPeriodo,
  formatPeriodoCompleto,
} from "@/lib/format";
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
 * Os totais do período, sem `grupo` nem `intervalo` — a mesma chave dos cartões, então ler daqui
 * para a legenda de um gráfico não abre request nova. É de onde sai todo valor de legenda: o
 * número vem do banco, nunca da soma das barras no browser.
 */
function useTotais(baseParams: Params) {
  return useMetricas(baseParams).data?.[0];
}

/** Dinheiro de KPI, legenda e rótulo de barra: duas casas. Tooltip e tabela ficam com quatro. */
function dinheiro(valor: number | null | undefined, moeda: string) {
  return formatCurrency(valor ?? null, moeda, { casas: 2 });
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

  // A mesma chave dos cartões: não abre request, só lê a hora em que os totais chegaram.
  const total = useMetricas(base);
  const queryClient = useQueryClient();
  const atualizando = useIsFetching({ queryKey: ["metricas-whatsapp"] }) > 0;

  return (
    <div className="flex flex-col gap-4">
      <CabecalhoDaPagina
        titulo="Painel de WhatsApp"
        subtitulo={
          <>
            Mensagens que a Meta cobrou e quanto custaram, por categoria, ator e país
            {total.dataUpdatedAt > 0 && <> · dados de {formatInstante(total.dataUpdatedAt)}</>}
          </>
        }
        acoes={
          <Button
            variant="outline"
            disabled={atualizando}
            onClick={() => void queryClient.invalidateQueries({ queryKey: ["metricas-whatsapp"] })}
          >
            <RefreshCw className={atualizando ? "animate-spin" : undefined} />
            Atualizar
          </Button>
        }
      />
      <GlobalFilters recortesDaSecao={["categoria", "direcao"]}>
        <FiltrosWhatsapp />
      </GlobalFilters>
      <Cartoes baseParams={base} />
      <div className="grid grid-cols-1 gap-3 min-[1180px]:grid-cols-2">
        <CustoTemporal baseParams={base} granularidade={filters.granularidade} />
        <MensagensTemporal baseParams={base} granularidade={filters.granularidade} />
      </div>
      <div className="grid grid-cols-1 gap-3 min-[1180px]:grid-cols-2">
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

  if (q.error) return <ErrorBox error={q.error} onRetry={() => void q.refetch()} />;

  const fracao = mensagens > 0 ? cobraveis / mensagens : 0;

  // A divisão que não pode virar `NaN` nem `Infinity`: sem mensagem cobrável não existe custo por
  // mensagem cobrável, e `—` é a única resposta honesta. `custo: null` cai no mesmo `—` pelo outro
  // motivo — "não sei quanto custou" —, e é o `formatCurrency` que já trata isso.
  const unitario = custo !== null && cobraveis > 0 ? custo / cobraveis : null;

  return (
    <div className="grid grid-cols-2 gap-3 min-[1100px]:grid-cols-4">
      <Cartao
        rotulo="Mensagens"
        icone={MessagesSquare}
        valor={formatNumber(mensagens)}
        nota="no período, nas duas direções"
        carregando={q.isLoading}
      />
      <Cartao
        rotulo="Cobráveis"
        icone={Receipt}
        valor={formatNumber(cobraveis)}
        nota={
          mensagens > 0
            ? `de ${formatNumber(mensagens)} · ${(fracao * 100).toFixed(0)}%`
            : "nada no período"
        }
        carregando={q.isLoading}
      >
        <Fita fracao={fracao} />
      </Cartao>
      <Cartao
        rotulo="Custo"
        icone={Wallet}
        valor={dinheiro(custo, moeda)}
        nota="das mensagens cobráveis"
        carregando={q.isLoading}
      />
      <Cartao
        rotulo="Custo por mensagem cobrável"
        icone={Tag}
        // Quatro casas, e não as duas dos outros tiles: a tarifa da Meta fica em centavos de dólar,
        // e com duas casas `US$ 0,0068` e `US$ 0,0250` virariam `US$ 0,01` e `US$ 0,03`.
        valor={formatCurrency(unitario, moeda)}
        nota={cobraveis > 0 ? "tarifa média do período" : "sem mensagem cobrável"}
        carregando={q.isLoading}
      />
    </div>
  );
}

/** A fração desenhada, na mesma gramática do medidor: o trecho pago sobre o trilho `sel`. */
function Fita({ fracao }: { fracao: number }) {
  return (
    <div className="bg-sel mt-1 h-[3px] w-full overflow-hidden rounded-full" aria-hidden>
      <div className="bg-foreground h-full" style={{ width: `${fracao * 100}%` }} />
    </div>
  );
}

/* ----------------------------------------------------------------- gráficos */

function dicaDaGranularidade(g: string): string {
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
  const totais = useTotais(baseParams);
  const moeda = dados[0]?.moeda ?? totais?.moeda ?? "USD";
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
      empty={!q.isLoading && dados.length === 0}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={dados} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
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
            stroke="var(--origem-whatsapp)"
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
 *
 * O valor de cada categoria na legenda vem da consulta `grupo=categoria` sem intervalo — a mesma
 * chave da rosca de custo, então não abre request nova.
 */
function MensagensTemporal({
  baseParams,
  granularidade,
}: {
  baseParams: Params;
  granularidade: string;
}) {
  const q = useMetricas({ ...baseParams, grupo: "categoria", intervalo: granularidade });
  const porCategoria = useMetricas({ ...baseParams, grupo: "categoria" }).data;
  const dados = pivotarPorGrupo(q.data ?? [], "periodo", "grupo", (b) => b.mensagens);
  const series = SERIES_DE_CATEGORIA.filter((s) => dados.some((l) => l[s.chave] !== undefined));

  const legenda = legendaComValores(
    Object.fromEntries(
      series.map((s) => {
        const balde = porCategoria?.find((b) => b.grupo === s.chave);
        return [s.chave, balde ? formatNumber(balde.mensagens) : undefined];
      }),
    ),
  );

  return (
    <PainelCard
      title="Mensagens ao longo do tempo"
      icon={ChartColumn}
      hint={dicaDaGranularidade(granularidade)}
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
            content={<TooltipDoTempo granularidade={granularidade} formatar={formatNumber} />}
          />
          <Legend {...legenda} />
          {series.map((s, i) => (
            <Bar
              key={s.chave}
              dataKey={s.chave}
              stackId="categoria"
              fill={s.cor}
              name={s.nome}
              // Só o segmento de cima leva canto arredondado, ou a pilha ganha um sulco no meio.
              radius={i === series.length - 1 ? [3, 3, 0, 0] : undefined}
              maxBarSize={64}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </PainelCard>
  );
}

/**
 * A rosca do custo por categoria, com o custo do período no centro e, na legenda, o valor e a
 * fatia de cada uma sobre esse total — o mesmo desenho do "Custo por modelo" do LLM. Com no máximo
 * quatro categorias pagas, nunca há fatia "Outros".
 */
function CustoPorCategoria({ baseParams }: { baseParams: Params }) {
  const q = useMetricas({ ...baseParams, grupo: "categoria" });
  const totais = useTotais(baseParams);

  // As que somam zero saem: `service` e o balde das recebidas não custam nada, e uma fatia de
  // ângulo zero na rosca vira só uma entrada de legenda prometendo gasto que não existe.
  const baldes = (q.data ?? [])
    .filter((b) => (b.custo ?? 0) > 0)
    .sort((a, b) => (b.custo ?? 0) - (a.custo ?? 0));
  const moeda = baldes[0]?.moeda ?? totais?.moeda ?? "USD";
  const totalDoPeriodo = totais?.custo ?? null;

  const fatias = baldes.map((b) => {
    const visual = visualDaCategoria(b.grupo);
    return {
      nome: visual?.nome ?? b.grupo ?? "",
      custo: b.custo ?? 0,
      cor: visual?.cor ?? "var(--categoria-nenhuma)",
    };
  });

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

  return (
    <PainelCard
      title="Custo por categoria"
      icon={ChartPie}
      hint="fatia do gasto"
      loading={q.isLoading}
      error={q.error}
      onRetry={() => void q.refetch()}
      empty={!q.isLoading && fatias.length === 0}
      emptyMessage="Nenhuma categoria com custo apurado. Verifique se há preço vigente para o país e o período."
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
      icon={Users}
      hint="10 maiores"
      loading={q.isLoading}
      error={q.error}
      onRetry={() => void q.refetch()}
      empty={!q.isLoading && dados.length === 0}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dados} layout="vertical" margin={{ top: 4, right: 80, left: 4, bottom: 0 }}>
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
          <Bar dataKey="custo" fill="var(--origem-whatsapp)" radius={[0, 3, 3, 0]} barSize={14}>
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

/**
 * Só aparece com mais de um país no período, como o "Custo por aplicação" do LLM.
 *
 * Com um país só o gráfico é uma barra do tamanho do total, que o card de custo já disse — e a
 * tarifa do WhatsApp muda por país, então o quadro só ensina alguma coisa quando há o que comparar.
 * Com erro ele aparece, para o erro não sumir junto com o quadro.
 */
function CustoPorPais({ baseParams }: { baseParams: Params }) {
  const q = useMetricas({ ...baseParams, grupo: "pais" });
  const dados = (q.data ?? []).slice().sort((a, b) => (b.custo ?? 0) - (a.custo ?? 0));
  const moeda = dados[0]?.moeda ?? "USD";

  if (!q.isLoading && !q.error && dados.length <= 1) return null;

  return (
    <PainelCard
      title="Custo por país"
      icon={Globe}
      hint="a tarifa muda por destino"
      loading={q.isLoading}
      error={q.error}
      onRetry={() => void q.refetch()}
      empty={!q.isLoading && dados.length === 0}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dados} margin={{ top: 24, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="grupo" {...eixo} tickFormatter={(v) => truncarRotulo(String(v))} />
          <YAxis {...eixo} tickFormatter={(v) => formatCompact(v)} width={52} />
          <Tooltip
            {...tooltipEstilo}
            formatter={(v: number) => [formatCurrency(v, moeda), "Custo"]}
          />
          <Bar dataKey="custo" fill="var(--origem-whatsapp)" radius={[3, 3, 0, 0]} maxBarSize={64}>
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
