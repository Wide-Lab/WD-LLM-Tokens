import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Users } from "lucide-react";

import { CabecalhoDaPagina } from "@/components/cabecalho-da-pagina";
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
import { haTextoSelecionado } from "@/lib/utils";
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
  const navigate = useNavigate();
  const router = useRouter();
  // O mesmo endereço que o `<Link>` da célula monta, para a nova aba abrir onde o link abriria.
  const abrirEmNovaAba = (ator: string) => {
    const { href } = router.buildLocation({ to: "/llm/eventos/$ator", params: { ator } });
    window.open(href, "_blank", "noopener");
  };
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
      <CabecalhoDaPagina
        titulo="Eventos de LLM"
        subtitulo="Quem consumiu quanto no período. Abra um ator para ver as chamadas dele"
      />
      <GlobalFilters recortesDaSecao={["modelo"]}>
        <FiltroModelo />
      </GlobalFilters>
      <PainelCard
        title="Atores"
        icon={Users}
        hint={atores.length > 0 ? `${formatNumber(atores.length)} no período` : undefined}
        bleed
        loading={q.isLoading}
        error={q.error}
        onRetry={() => void q.refetch()}
        empty={!q.isLoading && atores.length === 0}
        emptyMessage="Nenhum ator registrou chamadas neste período. Amplie as datas ou limpe os filtros."
      >
        {/* Abaixo de 700px a tabela vira lista de cartões: as mesmas linhas, sem rolagem lateral. */}
        <ul className="divide-line divide-y min-[700px]:hidden">
          {atores.map((a) => (
            <li key={a.grupo}>
              <Link
                to="/llm/eventos/$ator"
                params={{ ator: a.grupo ?? "" }}
                className="hover:bg-hover flex items-center gap-3 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-foreground truncate font-medium">{a.grupo}</div>
                  <div className="text-subtle mt-0.5 text-xs">
                    {formatNumber(a.requisicoes)}{" "}
                    {a.requisicoes === 1 ? "requisição" : "requisições"} ·{" "}
                    {formatNumber(
                      a.tokens_entrada +
                        a.tokens_saida +
                        a.tokens_cache_leitura +
                        a.tokens_cache_escrita,
                    )}{" "}
                    tokens
                  </div>
                </div>
                <div className="text-foreground shrink-0 font-medium">
                  {formatCurrency(a.custo, a.moeda)}
                </div>
                <ChevronRight className="text-subtle h-4 w-4 shrink-0" />
              </Link>
            </li>
          ))}
        </ul>

        <div className="hidden min-[700px]:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Ator</TableHead>
                <TableHead className="text-right">Entrada</TableHead>
                <TableHead className="text-right">Saída</TableHead>
                <TableHead className="text-right">Cache leitura / escrita</TableHead>
                <TableHead className="text-right">Custo</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {atores.map((a) => (
                <TableRow
                  key={a.grupo}
                  className="group cursor-pointer"
                  // A linha inteira abre o ator, como no wide-ui. O clique que já caiu no link
                  // passa reto: ele navega sozinho (e abre em nova aba com Ctrl). Fora dele, a
                  // linha imita o link: Ctrl, ⌘ ou o botão do meio abrem em nova aba, e o clique
                  // que terminou uma seleção de texto é cópia, não navegação.
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest("a")) return;
                    if (haTextoSelecionado()) return;
                    if (e.ctrlKey || e.metaKey) {
                      abrirEmNovaAba(a.grupo ?? "");
                      return;
                    }
                    void navigate({ to: "/llm/eventos/$ator", params: { ator: a.grupo ?? "" } });
                  }}
                  onMouseDown={(e) => {
                    // Sem isto o botão do meio liga a rolagem automática do navegador e o
                    // `auxclick` não chega.
                    if (e.button === 1 && !(e.target as HTMLElement).closest("a"))
                      e.preventDefault();
                  }}
                  onAuxClick={(e) => {
                    if (e.button !== 1 || (e.target as HTMLElement).closest("a")) return;
                    abrirEmNovaAba(a.grupo ?? "");
                  }}
                >
                  <TableCell className="max-w-[320px] p-0">
                    {/* O link é o caminho do teclado e do "abrir em nova aba": um `<tr>` com
                        `onClick` não é focável. */}
                    <Link
                      to="/llm/eventos/$ator"
                      params={{ ator: a.grupo ?? "" }}
                      className="block py-2 pl-4"
                      title={a.grupo}
                    >
                      <span className="text-foreground block truncate font-medium">{a.grupo}</span>
                      <span className="text-subtle block text-xs">
                        {formatNumber(a.requisicoes)}{" "}
                        {a.requisicoes === 1 ? "requisição" : "requisições"}
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell className="text-right">{formatNumber(a.tokens_entrada)}</TableCell>
                  <TableCell className="text-right">{formatNumber(a.tokens_saida)}</TableCell>
                  <TableCell className="text-muted-foreground text-right">
                    {formatNumber(a.tokens_cache_leitura)} / {formatNumber(a.tokens_cache_escrita)}
                  </TableCell>
                  <TableCell className="text-foreground text-right font-medium whitespace-nowrap">
                    {formatCurrency(a.custo, a.moeda)}
                  </TableCell>
                  <TableCell className="pr-3">
                    <ChevronRight className="text-subtle group-hover:text-foreground h-4 w-4 transition-colors" />
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
