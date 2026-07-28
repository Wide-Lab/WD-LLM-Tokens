import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";

import { GlobalFilters } from "@/components/global-filters";
import { ErrorBox, EmptyBox } from "@/components/empty-states";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiGet } from "@/lib/api";
import { useFilters, filtersToParams } from "@/lib/filters";
import { formatCurrency, formatNumber } from "@/lib/format";
import type { MetricaBucket } from "@/lib/api-types";

export const Route = createFileRoute("/eventos/")({
  head: () => ({
    meta: [
      { title: "Eventos — Painel LLM" },
      {
        name: "description",
        content: "Consumo de tokens e custo agrupados por ator.",
      },
      { property: "og:title", content: "Eventos — Painel LLM" },
      {
        property: "og:description",
        content: "Quem consumiu quanto: requisições, tokens e custo por ator.",
      },
    ],
  }),
  component: AtoresPage,
});

/**
 * A porta de entrada dos eventos é o **ator**, não a linha crua.
 *
 * A lista solta de eventos respondia "o que aconteceu às 14h32", que quase nunca é a pergunta —
 * a pergunta é "quem está gastando". Agrupar é `/v1/metricas?grupo=ator`, o mesmo endpoint dos
 * gráficos, sem paginação: o `GROUP BY` já reduz a um punhado de linhas. A lista crua continua
 * existindo, um clique adiante, dentro do ator.
 */
function AtoresPage() {
  const { filters } = useFilters();
  const params = { ...filtersToParams(filters), grupo: "ator" };

  const q = useQuery({
    queryKey: ["metricas", params],
    queryFn: () => apiGet<MetricaBucket[]>("/v1/metricas", params),
  });

  const atores = (q.data ?? []).slice().sort((a, b) => (b.custo ?? 0) - (a.custo ?? 0));

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
          ) : atores.length === 0 ? (
            <div className="p-4">
              <EmptyBox message="Nenhum ator encontrado com esses filtros." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ator</TableHead>
                    <TableHead className="text-right">Requisições</TableHead>
                    <TableHead className="text-right">Entrada</TableHead>
                    <TableHead className="text-right">Saída</TableHead>
                    <TableHead className="text-right">Cache L/E</TableHead>
                    <TableHead className="text-right">Custo</TableHead>
                    <TableHead className="w-8" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {atores.map((a) => (
                    <TableRow key={a.grupo} className="cursor-pointer">
                      <TableCell className="max-w-[280px] truncate p-0">
                        {/* O link cobre a célula inteira: linha clicável sem `onClick` num
                            `<tr>`, que não é focável nem abre em nova aba. */}
                        <Link
                          to="/eventos/$ator"
                          params={{ ator: a.grupo ?? "" }}
                          className="block truncate px-4 py-2 font-medium hover:underline"
                          title={a.grupo}
                        >
                          {a.grupo}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(a.requisicoes)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(a.tokens_entrada)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(a.tokens_saida)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {formatNumber(a.tokens_cache_leitura)} /{" "}
                        {formatNumber(a.tokens_cache_escrita)}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap font-medium tabular-nums">
                        {formatCurrency(a.custo, a.moeda)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <ChevronRight className="h-4 w-4" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {atores.length > 0 && (
        <div className="text-sm text-muted-foreground">
          {atores.length === 1 ? "1 ator no período" : `${atores.length} atores no período`}
        </div>
      )}
    </div>
  );
}
