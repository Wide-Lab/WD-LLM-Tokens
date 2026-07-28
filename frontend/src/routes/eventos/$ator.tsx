import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowLeft,
  ArrowUpFromLine,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Coins,
  Database,
} from "lucide-react";

import { GlobalFilters } from "@/components/global-filters";
import { ErrorBox, EmptyBox } from "@/components/empty-states";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
import type { EventosResponse, EventoItem, MetricaBucket } from "@/lib/api-types";

export const Route = createFileRoute("/eventos/$ator")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.ator} — Eventos — Painel LLM` },
      {
        name: "description",
        content: `Detalhe de uso de tokens, custo e conteúdo das chamadas do ator ${params.ator}.`,
      },
      { property: "og:title", content: `${params.ator} — Eventos — Painel LLM` },
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
  const base = { ...filtersToParams(filters), ator };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/eventos" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Atores
          </Link>
        </Button>
        <h1 className="min-w-0 truncate text-lg font-semibold" title={ator}>
          {ator}
        </h1>
      </div>

      <GlobalFilters />
      <KpiCards baseParams={base} />
      <PorModelo baseParams={base} />
      <Chamadas baseParams={base} />
    </div>
  );
}

type Params = Record<string, string | undefined>;

function KpiCards({ baseParams }: { baseParams: Params }) {
  const q = useQuery({
    queryKey: ["metricas", baseParams],
    queryFn: () => apiGet<MetricaBucket[]>("/v1/metricas", baseParams),
  });

  const totais = q.data?.[0];
  const moeda = totais?.moeda ?? "USD";
  const cache = (totais?.tokens_cache_leitura ?? 0) + (totais?.tokens_cache_escrita ?? 0);

  const kpis = [
    {
      label: "Requisições",
      icon: Activity,
      value: totais ? formatNumber(totais.requisicoes) : "—",
    },
    {
      label: "Custo total",
      icon: Coins,
      value: totais ? formatCurrency(totais.custo, moeda) : "—",
    },
    {
      label: "Tokens de entrada",
      icon: ArrowDownToLine,
      value: totais ? formatNumber(totais.tokens_entrada) : "—",
    },
    {
      label: "Tokens de saída",
      icon: ArrowUpFromLine,
      value: totais ? formatNumber(totais.tokens_saida) : "—",
    },
    { label: "Tokens de cache", icon: Database, value: totais ? formatNumber(cache) : "—" },
  ];

  if (q.isError) return <ErrorBox error={q.error} />;

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      {kpis.map((k) => (
        <Card key={k.label} className="overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">{k.label}</CardTitle>
            <k.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {q.isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="truncate text-2xl font-bold tracking-tight">{k.value}</div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function PorModelo({ baseParams }: { baseParams: Params }) {
  const params = { ...baseParams, grupo: "modelo" };
  const q = useQuery({
    queryKey: ["metricas", params],
    queryFn: () => apiGet<MetricaBucket[]>("/v1/metricas", params),
  });

  const modelos = (q.data ?? []).slice().sort((a, b) => (b.custo ?? 0) - (a.custo ?? 0));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">Uso por modelo</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {q.isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : q.isError ? (
          <div className="p-4">
            <ErrorBox error={q.error} />
          </div>
        ) : modelos.length === 0 ? (
          <div className="p-4">
            <EmptyBox message="Nenhum modelo usado no período." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Modelo</TableHead>
                  <TableHead className="text-right">Requisições</TableHead>
                  <TableHead className="text-right">Entrada</TableHead>
                  <TableHead className="text-right">Saída</TableHead>
                  <TableHead className="text-right">Cache L/E</TableHead>
                  <TableHead className="text-right">Custo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {modelos.map((m) => (
                  <TableRow key={m.grupo}>
                    <TableCell className="font-medium">{m.grupo}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(m.requisicoes)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(m.tokens_entrada)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(m.tokens_saida)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatNumber(m.tokens_cache_leitura)} /{" "}
                      {formatNumber(m.tokens_cache_escrita)}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap font-medium tabular-nums">
                      {formatCurrency(m.custo, m.moeda)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Chamadas({ baseParams }: { baseParams: Params }) {
  const [offset, setOffset] = useState(0);
  const [abertos, setAbertos] = useState<Set<string>>(new Set());

  // Voltar para a primeira página quando o período (ou qualquer filtro) muda: o offset antigo
  // aponta para um lugar que não existe mais no novo resultado.
  useEffect(() => {
    setOffset(0);
  }, [baseParams.de, baseParams.ate, baseParams.aplicacao, baseParams.modelo, baseParams.ator]);

  const params = { ...baseParams, limite: PAGE_SIZE, offset };
  const q = useQuery({
    queryKey: ["eventos", params],
    queryFn: () => apiGet<EventosResponse>("/v1/eventos", params),
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
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Chamadas</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {q.isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : q.isError ? (
            <div className="p-4">
              <ErrorBox error={q.error} />
            </div>
          ) : !data || data.itens.length === 0 ? (
            <div className="p-4">
              <EmptyBox message="Nenhuma chamada deste ator no período." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
                    <TableHead>Data/hora</TableHead>
                    <TableHead>Aplicação</TableHead>
                    <TableHead>Modelo</TableHead>
                    <TableHead className="text-right">Entrada</TableHead>
                    <TableHead className="text-right">Saída</TableHead>
                    <TableHead className="text-right">Cache L/E</TableHead>
                    <TableHead className="text-right">Custo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.itens.map((e) => (
                    <Chamada
                      key={e.id}
                      evento={e}
                      aberto={abertos.has(e.id)}
                      onAlternar={alternar}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">
          {total > 0
            ? `Mostrando ${offset + 1}–${Math.min(offset + PAGE_SIZE, total)} de ${formatNumber(
                total,
              )}`
            : "Nenhum resultado"}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            disabled={offset === 0 || q.isFetching}
          >
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </Button>
          <div className="text-sm text-muted-foreground">
            Página {pagina} de {paginas}
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
      <TableRow>
        <TableCell className="p-1">
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
        <TableCell className="whitespace-nowrap font-mono text-xs">
          {formatDateTime(evento.criado_em)}
        </TableCell>
        <TableCell>
          <Badge variant="secondary">{evento.aplicacao}</Badge>
        </TableCell>
        <TableCell className="whitespace-nowrap">
          <div className="text-sm">{evento.modelo}</div>
          <div className="text-xs text-muted-foreground">{evento.provedor}</div>
        </TableCell>
        <TableCell className="text-right tabular-nums">
          {formatNumber(evento.tokens_entrada)}
        </TableCell>
        <TableCell className="text-right tabular-nums">
          {formatNumber(evento.tokens_saida)}
        </TableCell>
        <TableCell className="text-right tabular-nums text-muted-foreground">
          {formatNumber(evento.tokens_cache_leitura)} / {formatNumber(evento.tokens_cache_escrita)}
        </TableCell>
        <TableCell className="text-right whitespace-nowrap font-medium tabular-nums">
          {formatCurrency(evento.custo, evento.moeda)}
        </TableCell>
      </TableRow>
      {aberto && (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={8} className="bg-muted/40 p-4">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <Conteudo titulo="Mensagem do ator" texto={evento.mensagem} />
              <Conteudo titulo="Resposta do agente" texto={evento.resposta} />
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function Conteudo({ titulo, texto }: { titulo: string; texto: string | null }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="text-xs font-medium text-muted-foreground">{titulo}</div>
      {texto ? (
        // `whitespace-pre-wrap` porque prompt e resposta vêm com quebra de linha, e a altura é
        // limitada para uma resposta longa não empurrar a tabela inteira para fora da tela.
        <div className="max-h-64 overflow-y-auto rounded-md border bg-background p-3 text-sm break-words whitespace-pre-wrap">
          {texto}
        </div>
      ) : (
        <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
          Não informado
        </div>
      )}
    </div>
  );
}
