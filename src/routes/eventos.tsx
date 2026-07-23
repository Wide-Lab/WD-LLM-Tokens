import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { GlobalFilters } from "@/components/global-filters";
import { NeedsConfig, ErrorBox, EmptyBox } from "@/components/empty-states";
import { Card, CardContent } from "@/components/ui/card";
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
import { apiFetch, useApiConfig } from "@/lib/api-config";
import { useFilters, filtersToParams } from "@/lib/filters";
import { formatCurrency, formatDateTime, formatNumber } from "@/lib/format";
import type { EventosResponse } from "@/lib/api-types";

export const Route = createFileRoute("/eventos")({
  head: () => ({
    meta: [
      { title: "Eventos — Painel LLM" },
      {
        name: "description",
        content: "Auditoria detalhada de eventos de uso de tokens por modelo, aplicação e ator.",
      },
      { property: "og:title", content: "Eventos — Painel LLM" },
      {
        property: "og:description",
        content: "Registro paginado de todas as chamadas de LLM com tokens e custo.",
      },
    ],
  }),
  component: EventosPage,
});

const PAGE_SIZE = 50;

function EventosPage() {
  const { config, isConfigured } = useApiConfig();
  const { filters } = useFilters();
  const [offset, setOffset] = useState(0);

  // reset pagination when filters change
  useEffect(() => {
    setOffset(0);
  }, [filters.de, filters.ate, filters.aplicacao, filters.modelo, filters.ator]);

  const params = { ...filtersToParams(filters), limite: PAGE_SIZE, offset };

  const q = useQuery({
    queryKey: ["eventos", config.baseUrl, config.apiKey, params],
    queryFn: () => apiFetch<EventosResponse>(config, "/v1/eventos", params),
    enabled: isConfigured,
  });

  if (!isConfigured)
    return (
      <>
        <GlobalFilters />
        <div className="mt-6">
          <NeedsConfig />
        </div>
      </>
    );

  const data = q.data;
  const total = data?.total ?? 0;
  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-4">
      <GlobalFilters />
      <Card>
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
              <EmptyBox message="Nenhum evento encontrado com esses filtros." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/hora</TableHead>
                    <TableHead>Aplicação</TableHead>
                    <TableHead>Ator</TableHead>
                    <TableHead>Modelo</TableHead>
                    <TableHead className="text-right">Entrada</TableHead>
                    <TableHead className="text-right">Saída</TableHead>
                    <TableHead className="text-right">Cache L/E</TableHead>
                    <TableHead className="text-right">Custo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.itens.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="whitespace-nowrap font-mono text-xs">
                        {formatDateTime(e.criado_em)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{e.aplicacao}</Badge>
                      </TableCell>
                      <TableCell className="max-w-[180px] truncate" title={e.ator}>
                        {e.ator}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <div className="text-sm">{e.modelo}</div>
                        <div className="text-xs text-muted-foreground">{e.provedor}</div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(e.tokens_entrada)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(e.tokens_saida)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {formatNumber(e.tokens_cache_leitura)} /{" "}
                        {formatNumber(e.tokens_cache_escrita)}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap font-medium tabular-nums">
                        {formatCurrency(e.custo, e.moeda)}
                      </TableCell>
                    </TableRow>
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
            Página {page} de {totalPages}
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
    </div>
  );
}
