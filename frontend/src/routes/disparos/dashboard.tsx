import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { CabecalhoDaPagina } from "@/components/cabecalho-da-pagina";
import { Cartao } from "@/components/cartao";
import { ErrorBox } from "@/components/empty-states";
import { Campo } from "@/components/global-filters";
import { PainelCard } from "@/components/painel-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  enviadasNoPeriodo,
  limitar,
  porDia,
  resumir,
  seriesDeEtapa,
  volumePorEtapa,
  type LinhaDoDia,
  type Periodo,
  type SerieDeEtapa,
} from "@/lib/dashboard-disparos";
import { somarDias } from "@/lib/calendario";
import { eixo, rampaNeutra, tooltipEstilo } from "@/lib/grafico";
import { formatDateOnly, formatNumber } from "@/lib/format";
import { listarMensagens, PERIODO_DO_LOG } from "@/lib/mensagens-disparo-mock";
import { listarReguas } from "@/lib/reguas-mock";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/disparos/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard de disparos — Painel de custos" },
      {
        name: "description",
        content: "Quanto a régua já mandou no período: mensagens, clientes, títulos e etapas.",
      },
      { property: "og:title", content: "Dashboard de disparos — Painel de custos" },
      {
        property: "og:description",
        content: "O volume que os dois cadastros de Disparos produziram, por dia e por etapa.",
      },
    ],
  }),
  component: Dashboard,
});

// As mesmas chaves da aba de mensagens: as duas telas leem o mesmo log e o mesmo cadastro, e uma
// chave própria só faria o mock ser gerado duas vezes para dar a mesma resposta.
const CHAVE = ["mensagens-disparos"];
const CHAVE_REGUAS = ["reguas-disparos"];

/**
 * O dashboard de Disparos — a única leitura agregada da seção.
 *
 * Ele é o "Simular 30 dias" do protótipo virado para trás. Lá o gráfico contava o que a régua
 * **produziria** a partir de hoje, e servia para decidir se dava para mexer numa etapa; aqui conta o
 * que ela **já mandou**, e serve para saber o que a decisão de ontem custou em volume. É a mesma
 * leitura, com a mesma quebra por etapa — o que muda é o tempo verbal, e com ele some o teto
 * diário: teto é limite de capacidade sobre o futuro, e sobre o passado ele não corta nada, porque
 * o que estourou já foi adiado pelo motor e está no log como `adiada`.
 *
 * O par com a aba de mensagens é de propósito, e a divisão é por pergunta: aqui é **quanto**, lá é
 * **quais**. Por isso o dashboard conta só o que saiu e não repete a conta das supressões — o
 * motivo de uma mensagem não ter saído é linha de log, não fatia de gráfico.
 *
 * O filtro de data é o único controle da tela, e é o que separa esta aba das outras três de
 * Disparos: régua, carteira e catálogo são cadastro, e recortar cadastro por data não responde
 * nada; volume é leitura de período, e sem o recorte não há como comparar duas semanas. Não é o
 * `<GlobalFilters>` porque aplicação, ator e granularidade não existem aqui — um controle que
 * parece filtrar e não filtra é pior do que controle nenhum. Ele só empresta o `Campo` e o desenho
 * da barra de filtros.
 */
function Dashboard() {
  const [pedido, setPedido] = useState<Periodo>(PERIODO_DO_LOG);

  const q = useQuery({ queryKey: CHAVE, queryFn: listarMensagens });
  const qReguas = useQuery({ queryKey: CHAVE_REGUAS, queryFn: listarReguas });

  // O que a tela sabe honrar: o mock tem janela fixa, e período fora dela desenharia barras zeradas
  // dizendo, pela forma, que a régua não mandou nada.
  const periodo = useMemo(() => limitar(pedido, PERIODO_DO_LOG), [pedido]);

  const mensagens = useMemo(() => q.data ?? [], [q.data]);
  const reguas = useMemo(() => qReguas.data ?? [], [qReguas.data]);

  const enviadas = useMemo(() => enviadasNoPeriodo(mensagens, periodo), [mensagens, periodo]);
  const resumo = useMemo(() => resumir(enviadas), [enviadas]);
  const series = useMemo(() => seriesDeEtapa(enviadas, reguas), [enviadas, reguas]);
  const dados = useMemo(() => porDia(enviadas, reguas, periodo), [enviadas, reguas, periodo]);
  const volume = useMemo(() => volumePorEtapa(enviadas, reguas), [enviadas, reguas]);

  const carregando = q.isLoading || qReguas.isLoading;
  const erro = q.error ?? qReguas.error;

  const dias = dados.length;
  const maiorVolume = Math.max(...volume.map((v) => v.total), 1);

  return (
    <div className="flex flex-col gap-4">
      <CabecalhoDaPagina
        titulo="Dashboard"
        subtitulo="Quanto a régua já mandou no período, por dia e por etapa"
      />

      <FiltroDePeriodo periodo={periodo} onChange={setPedido} />

      {erro ? (
        <ErrorBox
          error={erro}
          onRetry={() => {
            void q.refetch();
            void qReguas.refetch();
          }}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 min-[560px]:grid-cols-3">
            <Cartao
              rotulo="Mensagens enviadas"
              valor={formatNumber(resumo.mensagens)}
              nota={
                dias > 0 ? `em ${formatNumber(dias)} ${dias === 1 ? "dia" : "dias"}` : undefined
              }
              carregando={carregando}
            />
            <Cartao
              rotulo="Clientes"
              valor={formatNumber(resumo.clientes)}
              carregando={carregando}
            />
            <Cartao rotulo="Títulos" valor={formatNumber(resumo.titulos)} carregando={carregando} />
          </div>

          <PainelCard
            title="Mensagens enviadas por dia"
            hint="por etapa"
            action={<Legenda series={series} />}
            loading={carregando}
            empty={!carregando && resumo.mensagens === 0}
            emptyMessage="Nenhuma mensagem saiu neste período. Sem envio não há volume para quebrar por etapa."
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dados} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="rotulo" {...eixo} />
                <YAxis {...eixo} allowDecimals={false} width={44} />
                <Tooltip cursor={tooltipEstilo.cursor} content={<Dica series={series} />} />
                {series.map((s, i) => (
                  <Bar
                    key={s.id}
                    dataKey={s.id}
                    stackId="etapa"
                    fill={rampaNeutra(i, series.length)}
                    // Só o segmento de cima leva canto arredondado, ou a pilha ganha um sulco no meio.
                    radius={i === series.length - 1 ? [3, 3, 0, 0] : undefined}
                    maxBarSize={64}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </PainelCard>

          <PainelCard
            title="Volume por etapa"
            hint={`${formatDateOnly(periodo.de)} — ${formatDateOnly(periodo.ate)}`}
            loading={carregando}
            empty={!carregando && volume.length === 0}
            emptyMessage="Nenhuma etapa disparou no período."
            bleed
          >
            <ul className="flex flex-col gap-3 p-4">
              {volume.map(({ etapa, total }, i) => (
                <li key={etapa.id} className="flex items-center gap-3">
                  <span className="text-muted-foreground w-10 shrink-0 text-xs tabular-nums">
                    {etapa.rotulo}
                  </span>
                  <span className="text-foreground min-w-0 flex-1 truncate text-[13.5px]">
                    {etapa.nome}
                  </span>
                  {/* A fita é a mesma leitura do gráfico somada: proporção sobre a maior etapa, para
                      a distância entre duas etapas ser visível sem contar dígito. */}
                  <span className="bg-sel hidden h-1.5 w-40 overflow-hidden rounded-full sm:block">
                    <span
                      className="block h-full rounded-full"
                      style={{
                        width: `${(total / maiorVolume) * 100}%`,
                        background: rampaNeutra(i, volume.length),
                      }}
                    />
                  </span>
                  <span className="text-foreground w-16 shrink-0 text-right text-[13.5px] tabular-nums">
                    {formatNumber(total)}
                  </span>
                </li>
              ))}
            </ul>
          </PainelCard>
        </>
      )}
    </div>
  );
}

/**
 * A legenda das etapas, escrita à mão: o ponto na tinta da rampa neutra (`rampaNeutra`) e o nome em
 * `muted-foreground`, no desenho da legenda do recharts nos outros gráficos (ponto redondo de 8px, 12px).
 *
 * A tinta sai da posição da etapa na lista, e é a mesma `series` que desenha as barras e o tooltip:
 * a rampa é neutra porque cor de dado tem papel fixo e a etapa já é uma ordem — quanto mais tarde no
 * eixo do vencimento, mais escura a tinta. O padrão do recharts leria tudo com o mesmo ponto.
 */
function Legenda({ series }: { series: SerieDeEtapa[] }) {
  if (series.length === 0) return null;
  return (
    <ul className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
      {series.map((s, i) => (
        <li key={s.id} className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <span
            aria-hidden
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ background: rampaNeutra(i, series.length) }}
          />
          {s.nome}
        </li>
      ))}
    </ul>
  );
}

/**
 * O tooltip é escrito à mão porque o do recharts não tem rodapé e pintaria o ponto pelo `fill` da
 * barra, que aqui é a tinta da rampa — e ela só se lê pela posição da etapa. O desenho é o do
 * `TooltipDoTempo`: uma linha por série, com o ponto na tinta, e o total da pilha embaixo.
 */
function Dica({
  active,
  payload,
  series,
}: {
  active?: boolean;
  payload?: Array<{ payload: LinhaDoDia }>;
  series: SerieDeEtapa[];
}) {
  if (!active || !payload?.length) return null;
  const linha = payload[0].payload;

  return (
    <div style={{ ...tooltipEstilo.contentStyle, padding: "8px 10px" }}>
      <div style={tooltipEstilo.labelStyle}>{formatDateOnly(String(linha.dia))}</div>
      {series.map((s, i) => (
        <div key={s.id} className="flex items-center gap-1.5 py-px">
          <span
            aria-hidden
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ background: rampaNeutra(i, series.length) }}
          />
          <span className="text-muted-foreground">{s.nome}</span>
          <span className="ml-auto pl-4 tabular-nums">
            {formatNumber(Number(linha[s.id] ?? 0))}
          </span>
        </div>
      ))}
      <div className="border-line mt-1 flex items-center gap-1.5 border-t pt-1 font-medium">
        <span>Total</span>
        <span className="ml-auto pl-4 tabular-nums">{formatNumber(Number(linha.total))}</span>
      </div>
    </div>
  );
}

/** Os atalhos que o log sabe responder. `Tudo` é a janela inteira, e não trinta dias. */
const ATALHOS = [
  { rotulo: "Hoje", dias: 1 },
  { rotulo: "7 dias", dias: 7 },
  { rotulo: "Tudo", dias: 0 },
] as const;

/**
 * De, até e três atalhos — nada além.
 *
 * `min` e `max` são a janela do log, no próprio controle: é mais honesto do que aceitar a data e
 * devolver um gráfico vazio, e é a mesma ideia do recorte que a aba de mensagens oferece — a tela
 * só oferece o que sabe honrar.
 */
function FiltroDePeriodo({
  periodo,
  onChange,
}: {
  periodo: Periodo;
  onChange: (p: Periodo) => void;
}) {
  return (
    <section aria-label="Período do dashboard" className="flex flex-wrap items-end gap-2">
      <Campo rotulo="De" para="disparos-de">
        <Input
          id="disparos-de"
          type="date"
          value={periodo.de}
          min={PERIODO_DO_LOG.de}
          max={periodo.ate}
          onChange={(e) => onChange({ ...periodo, de: e.target.value })}
          className="w-[9.5rem]"
        />
      </Campo>
      <Campo rotulo="Até" para="disparos-ate">
        <Input
          id="disparos-ate"
          type="date"
          value={periodo.ate}
          min={periodo.de}
          max={PERIODO_DO_LOG.ate}
          onChange={(e) => onChange({ ...periodo, ate: e.target.value })}
          className="w-[9.5rem]"
        />
      </Campo>

      {/* Os atalhos emendados num grupo só, como no `<GlobalFilters>`: lê-se como um seletor. */}
      <div className="border-input bg-surface flex h-9 items-stretch overflow-hidden rounded-[var(--wu-radius)] border">
        {ATALHOS.map((a, i) => (
          <Button
            key={a.rotulo}
            variant="ghost"
            onClick={() =>
              onChange(
                a.dias === 0
                  ? PERIODO_DO_LOG
                  : { de: somarDias(PERIODO_DO_LOG.ate, -(a.dias - 1)), ate: PERIODO_DO_LOG.ate },
              )
            }
            className={cn("h-full rounded-none px-3 text-[13px]", i > 0 && "border-input border-l")}
          >
            {a.rotulo}
          </Button>
        ))}
      </div>
    </section>
  );
}
