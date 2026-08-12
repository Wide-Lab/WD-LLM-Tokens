import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { AvisoDeMock } from "@/components/aviso-mock";
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
import { eixo, tooltipEstilo } from "@/lib/grafico";
import { formatDateOnly, formatNumber } from "@/lib/format";
import { listarMensagens, PERIODO_DO_LOG } from "@/lib/mensagens-disparo-mock";
import { listarReguas } from "@/lib/reguas-mock";

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
 * parece filtrar e não filtra é pior do que controle nenhum.
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

  if (erro) return <ErrorBox error={erro} />;

  const dias = dados.length;

  return (
    <div className="flex flex-col gap-4">
      <AvisoDeMock>
        Esta aba ainda não fala com o backend: ela agrega o mesmo log em memória da aba de
        mensagens, que cobre {formatDateOnly(PERIODO_DO_LOG.de)} a{" "}
        {formatDateOnly(PERIODO_DO_LOG.ate)} e é gerado de novo a cada recarga. No serviço real a
        soma vem do banco por período, e o filtro de data vira o recorte da consulta.
      </AvisoDeMock>

      <FiltroDePeriodo periodo={periodo} onChange={setPedido} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Cartao
          rotulo="Mensagens enviadas"
          valor={formatNumber(resumo.mensagens)}
          nota={
            dias > 0
              ? `em ${formatNumber(dias)} ${dias === 1 ? "dia" : "dias"} · o que chegou à Meta`
              : "o que chegou à Meta"
          }
          carregando={carregando}
        />
        <Cartao
          rotulo="Clientes"
          valor={formatNumber(resumo.clientes)}
          nota="distintos, e não uma vez por etapa"
          carregando={carregando}
        />
        <Cartao
          rotulo="Títulos"
          valor={formatNumber(resumo.titulos)}
          nota="citados nas mensagens que saíram"
          carregando={carregando}
        />
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
            <Tooltip cursor={{ fill: "var(--muted)" }} content={<Dica series={series} />} />
            {series.map((s, i) => (
              <Bar
                key={s.id}
                dataKey={s.id}
                stackId="etapa"
                fill="var(--foreground)"
                fillOpacity={opacidade(i, series.length)}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </PainelCard>

      <PainelCard
        title="Volume por etapa no período"
        hint={`${formatDateOnly(periodo.de)} — ${formatDateOnly(periodo.ate)}`}
        loading={carregando}
        empty={!carregando && volume.length === 0}
        emptyMessage="Nenhuma etapa disparou no período."
        bleed
      >
        <div className="flex flex-col gap-3 p-5">
          {volume.map(({ etapa, total }, i) => (
            <div key={etapa.id} className="flex items-center gap-3">
              <span className="etiqueta w-10 shrink-0">{etapa.rotulo}</span>
              <span className="min-w-0 flex-1 truncate text-sm">{etapa.nome}</span>
              {/* A fita é a mesma leitura do gráfico somada: proporção sobre a maior etapa, para
                  a distância entre duas etapas ser visível sem contar dígito. */}
              <span className="bg-muted hidden h-[3px] w-40 overflow-hidden rounded-full sm:block">
                <span
                  className="block h-full bg-foreground"
                  style={{
                    width: `${(total / Math.max(...volume.map((v) => v.total), 1)) * 100}%`,
                    opacity: opacidade(i, volume.length),
                  }}
                />
              </span>
              <span className="leitura w-16 shrink-0 text-right text-sm">
                {formatNumber(total)}
              </span>
            </div>
          ))}
        </div>
      </PainelCard>
    </div>
  );
}

/**
 * A rampa neutra das etapas, e ela é só tinta.
 *
 * Nem violeta nem petróleo: no painel inteiro violeta é dinheiro e petróleo é token (`styles.css`),
 * e gastar um dos dois numa etapa faria a cor mentir na tela em que ela é o dado. Sobra a escala
 * neutra, e aqui ela basta porque a etapa **é uma rampa**: quanto mais tarde no eixo do vencimento,
 * mais escura a tinta. É a mesma escolha do `COR_STATUS` do log, pelo mesmo motivo — e é por isso
 * que a linha do tempo das réguas também não tem cor semântica nenhuma.
 */
function opacidade(indice: number, total: number): number {
  if (total <= 1) return 0.85;
  return 0.3 + (0.6 * indice) / (total - 1);
}

function Legenda({ series }: { series: SerieDeEtapa[] }) {
  if (series.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {series.map((s, i) => (
        <span
          key={s.id}
          className="text-muted-foreground flex items-center gap-1.5 text-[0.6875rem]"
        >
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-[2px] bg-foreground"
            style={{ opacity: opacidade(i, series.length) }}
            aria-hidden
          />
          {s.nome}
        </span>
      ))}
    </div>
  );
}

/**
 * O tooltip é escrito à mão porque a legenda do recharts leria tudo igual.
 *
 * As séries compartilham a cor e se distinguem pela opacidade; o quadradinho padrão do recharts usa
 * só o `fill`, e num empilhado de quatro etapas mostraria quatro quadrados idênticos.
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
    <div style={tooltipEstilo.contentStyle} className="flex flex-col gap-1 font-mono">
      <div style={tooltipEstilo.labelStyle}>{formatDateOnly(String(linha.dia))}</div>
      {series.map((s, i) => (
        <div key={s.id} className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 shrink-0 rounded-[2px] bg-popover-foreground"
              style={{ opacity: opacidade(i, series.length) }}
              aria-hidden
            />
            {s.nome}
          </span>
          <span>{formatNumber(Number(linha[s.id] ?? 0))}</span>
        </div>
      ))}
      <div className="mt-0.5 flex items-center justify-between gap-6 border-t pt-1">
        <span>Total</span>
        <span>{formatNumber(Number(linha.total))}</span>
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
    <section
      aria-label="Período do dashboard"
      className="bg-card flex flex-wrap items-end gap-x-4 gap-y-3 rounded-xl border p-4 shadow-sm"
    >
      <Campo rotulo="De" para="disparos-de">
        <Input
          id="disparos-de"
          type="date"
          value={periodo.de}
          min={PERIODO_DO_LOG.de}
          max={periodo.ate}
          onChange={(e) => onChange({ ...periodo, de: e.target.value })}
          className="h-9 w-[9.5rem] font-mono text-xs"
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
          className="h-9 w-[9.5rem] font-mono text-xs"
        />
      </Campo>

      <div className="border-input flex h-9 items-stretch overflow-hidden rounded-md border">
        {ATALHOS.map((a, i) => (
          <Button
            key={a.rotulo}
            variant="ghost"
            size="sm"
            onClick={() =>
              onChange(
                a.dias === 0
                  ? PERIODO_DO_LOG
                  : { de: somarDias(PERIODO_DO_LOG.ate, -(a.dias - 1)), ate: PERIODO_DO_LOG.ate },
              )
            }
            className={`h-full rounded-none px-3 text-xs font-medium ${i > 0 ? "border-input border-l" : ""}`}
          >
            {a.rotulo}
          </Button>
        ))}
      </div>

      <p className="text-muted-foreground ml-auto max-w-sm text-xs">
        O log cobre {formatDateOnly(PERIODO_DO_LOG.de)} a {formatDateOnly(PERIODO_DO_LOG.ate)}. Data
        fora da janela é cortada para dentro dela.
      </p>
    </section>
  );
}
