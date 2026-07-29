import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, type ReactNode } from "react";
import { ArrowLeft, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

import { Conteudo } from "@/components/conteudo";
import { Conversa } from "@/components/conversa";
import { FiltroModelo } from "@/components/filtro-modelo";
import { GlobalFilters } from "@/components/global-filters";
import { Medidor } from "@/components/medidor";
import { PainelCard } from "@/components/painel-card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { apiGet } from "@/lib/api";
import { useFilters, filtersToParams } from "@/lib/filters";
import { formatCurrency, formatDateTime, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { EventosResponse, EventoItem, MetricaBucket } from "@/lib/api-types";

export const Route = createFileRoute("/llm/eventos/$ator")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.ator} — Eventos de LLM — Painel de custos` },
      {
        name: "description",
        content: `Detalhe de uso de tokens, custo e conteúdo das chamadas do ator ${params.ator}.`,
      },
      {
        property: "og:title",
        content: `${params.ator} — Eventos de LLM — Painel de custos`,
      },
      {
        property: "og:description",
        content: "Requisições, tokens, custo e conteúdo das chamadas de um ator.",
      },
    ],
  }),
  component: AtorPage,
});

const PAGE_SIZE = 50;

function AtorPage() {
  const { ator } = Route.useParams();
  const { filters } = useFilters();

  // O ator vem da URL, não do campo de busca da barra de filtros: dentro do detalhe ele é o
  // assunto da tela, e deixar o filtro global sobrescrevê-lo esvaziaria a página do próprio ator.
  const base = { ...filtersToParams(filters), modelo: filters.modelo || undefined, ator };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" asChild className="-ml-2 gap-1.5">
          <Link to="/llm/eventos">
            <ArrowLeft className="h-4 w-4" />
            Atores
          </Link>
        </Button>
        <h2 className="min-w-0 truncate font-mono text-lg font-medium" title={ator}>
          {ator}
        </h2>
      </div>

      <GlobalFilters>
        <FiltroModelo />
      </GlobalFilters>
      <Leitura baseParams={base} />
      <PorModelo baseParams={base} />
      <Chamadas baseParams={base} />
    </div>
  );
}

type Params = Record<string, string | undefined>;

function Leitura({ baseParams }: { baseParams: Params }) {
  const q = useQuery({
    queryKey: ["metricas-llm", baseParams],
    queryFn: () => apiGet<MetricaBucket[]>("/v1/llm/metricas", baseParams),
  });

  return (
    <Medidor
      totais={q.data?.[0]}
      carregando={q.isLoading}
      erro={q.error}
      titulo="Gasto deste ator"
    />
  );
}

function PorModelo({ baseParams }: { baseParams: Params }) {
  const params = { ...baseParams, grupo: "modelo" };
  const q = useQuery({
    queryKey: ["metricas-llm", params],
    queryFn: () => apiGet<MetricaBucket[]>("/v1/llm/metricas", params),
  });

  const modelos = (q.data ?? []).slice().sort((a, b) => (b.custo ?? 0) - (a.custo ?? 0));

  return (
    <PainelCard
      title="Modelos usados"
      hint={modelos.length > 0 ? `${modelos.length} no período` : undefined}
      bleed
      loading={q.isLoading}
      error={q.error}
      empty={!q.isLoading && modelos.length === 0}
      emptyMessage="Este ator não chamou nenhum modelo no período."
    >
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="etiqueta py-3 pl-5">Modelo</TableHead>
              <TableHead className="etiqueta py-3 text-right">Reqs.</TableHead>
              <TableHead className="etiqueta py-3 text-right">Entrada</TableHead>
              <TableHead className="etiqueta py-3 text-right">Saída</TableHead>
              <TableHead className="etiqueta py-3 text-right">Cache L/E</TableHead>
              <TableHead className="etiqueta py-3 pr-5 text-right">Custo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {modelos.map((m) => (
              <TableRow key={m.grupo}>
                <TableCell className="pl-5 font-mono text-xs font-medium">{m.grupo}</TableCell>
                <TableCell className="text-right font-mono text-xs">
                  {formatNumber(m.requisicoes)}
                </TableCell>
                <TableCell className="text-right font-mono text-xs">
                  {formatNumber(m.tokens_entrada)}
                </TableCell>
                <TableCell className="text-right font-mono text-xs">
                  {formatNumber(m.tokens_saida)}
                </TableCell>
                <TableCell className="text-muted-foreground text-right font-mono text-xs">
                  {formatNumber(m.tokens_cache_leitura)} / {formatNumber(m.tokens_cache_escrita)}
                </TableCell>
                <TableCell className="leitura text-custo pr-5 text-right text-sm whitespace-nowrap">
                  {formatCurrency(m.custo, m.moeda)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </PainelCard>
  );
}

type Modo = "tabela" | "conversa";

/**
 * Duas leituras do mesmo recorte. A tabela responde "quanto custou cada chamada"; a conversa
 * responde "o que foi dito". Nenhuma substitui a outra, e por isso o alternador fica no
 * cabeçalho do quadro — é a mesma leitura em outra forma, não outra tela.
 */
function Chamadas({ baseParams }: { baseParams: Params }) {
  const [modo, setModo] = useState<Modo>("tabela");
  const alternador = <AlternadorDeModo modo={modo} onModo={setModo} />;

  if (modo === "conversa") {
    return (
      <PainelCard title="Chamadas" action={alternador} bleed>
        <Conversa baseParams={baseParams} />
      </PainelCard>
    );
  }

  return <ChamadasTabela baseParams={baseParams} acao={alternador} />;
}

function AlternadorDeModo({ modo, onModo }: { modo: Modo; onModo: (m: Modo) => void }) {
  return (
    <div className="bg-muted flex items-center gap-0.5 rounded-sm p-0.5">
      {(["tabela", "conversa"] as const).map((m) => (
        <button
          key={m}
          type="button"
          aria-pressed={modo === m}
          onClick={() => onModo(m)}
          className={cn(
            "etiqueta rounded-[3px] px-2.5 py-1 transition-colors",
            modo === m ? "bg-card text-foreground shadow-sm" : "hover:text-foreground",
          )}
        >
          {m === "tabela" ? "Tabela" : "Conversa"}
        </button>
      ))}
    </div>
  );
}

function ChamadasTabela({ baseParams, acao }: { baseParams: Params; acao: ReactNode }) {
  const [offset, setOffset] = useState(0);
  const [abertos, setAbertos] = useState<Set<string>>(new Set());

  // Voltar para a primeira página quando o período (ou qualquer filtro) muda: o offset antigo
  // aponta para um lugar que não existe mais no novo resultado.
  useEffect(() => {
    setOffset(0);
  }, [baseParams.de, baseParams.ate, baseParams.aplicacao, baseParams.modelo, baseParams.ator]);

  const params = { ...baseParams, limite: PAGE_SIZE, offset };
  const q = useQuery({
    queryKey: ["eventos-llm", params],
    queryFn: () => apiGet<EventosResponse>("/v1/llm/eventos", params),
  });

  const alternar = (id: string) =>
    setAbertos((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(id)) proximo.delete(id);
      else proximo.add(id);
      return proximo;
    });

  const data = q.data;
  const total = data?.total ?? 0;
  const pagina = Math.floor(offset / PAGE_SIZE) + 1;
  const paginas = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PainelCard
        title="Chamadas"
        hint={total > 0 ? `${formatNumber(total)} no período` : undefined}
        action={acao}
        bleed
        loading={q.isLoading}
        error={q.error}
        empty={!q.isLoading && (!data || data.itens.length === 0)}
        emptyMessage="Este ator não fez chamadas no período selecionado."
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-8 pl-3" />
                <TableHead className="etiqueta py-3">Data/hora</TableHead>
                <TableHead className="etiqueta py-3">Aplicação</TableHead>
                <TableHead className="etiqueta py-3">Modelo</TableHead>
                <TableHead className="etiqueta py-3 text-right">Entrada</TableHead>
                <TableHead className="etiqueta py-3 text-right">Saída</TableHead>
                <TableHead className="etiqueta py-3 text-right">Cache L/E</TableHead>
                <TableHead className="etiqueta py-3 pr-5 text-right">Custo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.itens ?? []).map((e) => (
                <Chamada key={e.id} evento={e} aberto={abertos.has(e.id)} onAlternar={alternar} />
              ))}
            </TableBody>
          </Table>
        </div>
      </PainelCard>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-muted-foreground font-mono text-xs">
          {total > 0
            ? `${formatNumber(offset + 1)}–${formatNumber(
                Math.min(offset + PAGE_SIZE, total),
              )} de ${formatNumber(total)}`
            : "Nenhum resultado"}
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            disabled={offset === 0 || q.isFetching}
          >
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </Button>
          <div className="etiqueta">
            {pagina} / {paginas}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setOffset(offset + PAGE_SIZE)}
            disabled={offset + PAGE_SIZE >= total || q.isFetching}
          >
            Próxima
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </>
  );
}

function Chamada({
  evento,
  aberto,
  onAlternar,
}: {
  evento: EventoItem;
  aberto: boolean;
  onAlternar: (id: string) => void;
}) {
  const temConteudo = Boolean(evento.mensagem || evento.resposta);

  return (
    <>
      <TableRow className={aberto ? "border-b-0" : undefined}>
        <TableCell className="p-1 pl-3">
          {temConteudo && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onAlternar(evento.id)}
              aria-expanded={aberto}
              aria-label={aberto ? "Ocultar conteúdo" : "Ver conteúdo"}
            >
              <ChevronDown
                className={`h-4 w-4 transition-transform ${aberto ? "rotate-180" : ""}`}
              />
            </Button>
          )}
        </TableCell>
        <TableCell className="text-muted-foreground font-mono text-xs whitespace-nowrap">
          {formatDateTime(evento.criado_em)}
        </TableCell>
        <TableCell>
          <Badge variant="secondary" className="font-mono text-[0.6875rem] font-normal">
            {evento.aplicacao}
          </Badge>
        </TableCell>
        <TableCell className="whitespace-nowrap">
          <div className="font-mono text-xs font-medium">{evento.modelo}</div>
          {evento.provedor && (
            <div className="text-muted-foreground text-[0.6875rem]">{evento.provedor}</div>
          )}
        </TableCell>
        <TableCell className="text-right font-mono text-xs">
          {formatNumber(evento.tokens_entrada)}
        </TableCell>
        <TableCell className="text-right font-mono text-xs">
          {formatNumber(evento.tokens_saida)}
        </TableCell>
        <TableCell className="text-muted-foreground text-right font-mono text-xs">
          {formatNumber(evento.tokens_cache_leitura)} / {formatNumber(evento.tokens_cache_escrita)}
        </TableCell>
        <TableCell className="leitura text-custo pr-5 text-right text-sm whitespace-nowrap">
          {formatCurrency(evento.custo, evento.moeda)}
        </TableCell>
      </TableRow>
      {aberto && (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={8} className="bg-muted/50 px-5 pt-1 pb-5">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* A borda de cada painel usa a cor do balde correspondente: o que o ator mandou
                  virou token de entrada, o que o agente devolveu virou token de saída. */}
              <Conteudo
                titulo="Mensagem do ator"
                texto={evento.mensagem}
                cor="var(--balde-entrada)"
              />
              <Conteudo
                titulo="Resposta do agente"
                texto={evento.resposta}
                cor="var(--balde-saida)"
              />
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
