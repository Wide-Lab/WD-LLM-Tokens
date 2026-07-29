import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";

import { FiltroModelo } from "@/components/filtro-modelo";
import { GlobalFilters } from "@/components/global-filters";
import { PainelCard } from "@/components/painel-card";
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

export const Route = createFileRoute("/llm/eventos/")({
  head: () => ({
    meta: [
      { title: "Eventos de LLM — Painel de custos" },
      {
        name: "description",
        content: "Consumo de tokens e custo agrupados por ator.",
      },
      { property: "og:title", content: "Eventos de LLM — Painel de custos" },
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
 * a pergunta é "quem está gastando". Agrupar é `/v1/llm/metricas?grupo=ator`, o mesmo endpoint dos
 * gráficos, sem paginação: o `GROUP BY` já reduz a um punhado de linhas. A lista crua continua
 * existindo, um clique adiante, dentro do ator.
 */
function AtoresPage() {
  const { filters } = useFilters();
  const params = {
    ...filtersToParams(filters),
    modelo: filters.modelo || undefined,
    grupo: "ator",
  };

  const q = useQuery({
    queryKey: ["metricas-llm", params],
    queryFn: () => apiGet<MetricaBucket[]>("/v1/llm/metricas", params),
  });

  const atores = (q.data ?? []).slice().sort((a, b) => (b.custo ?? 0) - (a.custo ?? 0));

  return (
    <div className="flex flex-col gap-4">
      <GlobalFilters>
        <FiltroModelo />
      </GlobalFilters>
      <PainelCard
        title="Atores"
        hint={atores.length > 0 ? `${atores.length} no período` : undefined}
        bleed
        loading={q.isLoading}
        error={q.error}
        empty={!q.isLoading && atores.length === 0}
        emptyMessage="Nenhum ator registrou chamadas neste período. Amplie as datas ou limpe os filtros."
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="etiqueta py-3 pl-5">Ator</TableHead>
                <TableHead className="etiqueta py-3 text-right">Reqs.</TableHead>
                <TableHead className="etiqueta py-3 text-right">Entrada</TableHead>
                <TableHead className="etiqueta py-3 text-right">Saída</TableHead>
                <TableHead className="etiqueta py-3 text-right">Cache L/E</TableHead>
                <TableHead className="etiqueta py-3 pr-5 text-right">Custo</TableHead>
                <TableHead className="w-8 pr-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {atores.map((a) => (
                <TableRow key={a.grupo} className="group">
                  <TableCell className="max-w-[280px] truncate p-0">
                    {/* O link cobre a célula inteira: linha clicável sem `onClick` num
                        `<tr>`, que não é focável nem abre em nova aba. */}
                    <Link
                      to="/llm/eventos/$ator"
                      params={{ ator: a.grupo ?? "" }}
                      className="focus-visible:ring-ring block truncate py-2.5 pl-5 font-medium focus-visible:ring-2 focus-visible:outline-none"
                      title={a.grupo}
                    >
                      {a.grupo}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {formatNumber(a.requisicoes)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {formatNumber(a.tokens_entrada)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {formatNumber(a.tokens_saida)}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-right font-mono text-xs">
                    {formatNumber(a.tokens_cache_leitura)} / {formatNumber(a.tokens_cache_escrita)}
                  </TableCell>
                  <TableCell className="leitura text-custo pr-5 text-right text-sm whitespace-nowrap">
                    {formatCurrency(a.custo, a.moeda)}
                  </TableCell>
                  <TableCell className="pr-4">
                    <ChevronRight className="text-muted-foreground group-hover:text-foreground h-4 w-4 transition-colors" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </PainelCard>
    </div>
  );
}
