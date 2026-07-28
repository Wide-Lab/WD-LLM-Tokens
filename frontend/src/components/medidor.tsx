import { useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { ErrorBox } from "@/components/empty-states";
import { formatCurrency, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MetricaBucket } from "@/lib/api-types";

/**
 * O medidor — a leitura de cabeçalho do painel.
 *
 * Substitui a fileira de cartões idênticos porque ela escondia o fato mais característico
 * do modelo de dados: os quatro baldes de token **não se sobrepõem** e somam o total
 * (`docs/modelo-de-dados.md`). Cinco números soltos não mostram isso; uma barra única
 * repartida em quatro mostra — a proporção é a informação.
 *
 * Custo fica de fora da fita, e em violeta, porque é outra substância: não é uma quinta
 * fatia de token, é o que a soma custou.
 */

/** Exportado porque a conversa desenha a mesma fita por troca: a ordem e as cores dos quatro
 *  baldes têm que sair daqui, ou os dois desenhos divergem na primeira mexida. */
export const BALDES = [
  { chave: "tokens_entrada", nome: "Entrada", cor: "var(--balde-entrada)" },
  { chave: "tokens_saida", nome: "Saída", cor: "var(--balde-saida)" },
  {
    chave: "tokens_cache_leitura",
    nome: "Cache leitura",
    cor: "var(--balde-cache-leitura)",
  },
  {
    chave: "tokens_cache_escrita",
    nome: "Cache escrita",
    cor: "var(--balde-cache-escrita)",
  },
] as const;

export function Medidor({
  totais,
  carregando,
  erro,
  titulo = "Gasto no período",
}: {
  totais?: MetricaBucket;
  carregando?: boolean;
  erro?: unknown;
  titulo?: string;
}) {
  const [destacado, setDestacado] = useState<string | null>(null);

  if (erro) return <ErrorBox error={erro} />;

  const moeda = totais?.moeda ?? "USD";
  const partes = BALDES.map((b) => ({ ...b, valor: totais?.[b.chave] ?? 0 }));
  const totalTokens = partes.reduce((s, p) => s + p.valor, 0);
  const requisicoes = totais?.requisicoes ?? 0;
  const custo = totais?.custo ?? null;
  const porRequisicao = custo !== null && requisicoes > 0 ? custo / requisicoes : null;

  return (
    <section className="grid grid-cols-1 overflow-hidden rounded-xl border bg-card shadow-sm lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
      {/* Leitura de custo */}
      <div className="flex flex-col justify-center gap-2 border-b p-5 lg:border-b-0 lg:border-r">
        <div className="etiqueta">{titulo}</div>
        {carregando ? (
          <Skeleton className="h-9 w-40" />
        ) : (
          // Nunca quebra no meio do número: um valor partido em duas linhas deixa de ser
          // legível como quantia. Se estourar a coluna, corta na borda.
          <div className="leitura text-custo overflow-hidden text-2xl leading-none text-ellipsis whitespace-nowrap sm:text-[1.75rem]">
            {formatCurrency(custo, moeda)}
          </div>
        )}
        {carregando ? (
          <Skeleton className="h-4 w-32" />
        ) : (
          <div className="text-muted-foreground text-xs">
            <span className="text-foreground font-medium tabular-nums">
              {formatNumber(requisicoes)}
            </span>{" "}
            {requisicoes === 1 ? "requisição" : "requisições"}
            {porRequisicao !== null && (
              <>
                {" · "}
                <span className="tabular-nums">{formatCurrency(porRequisicao, moeda)}</span> cada
              </>
            )}
          </div>
        )}
      </div>

      {/* A fita: os quatro baldes em proporção */}
      <div className="flex flex-col gap-3 p-5">
        <div className="flex items-baseline justify-between gap-3">
          <div className="etiqueta">Tokens no período</div>
          {carregando ? (
            <Skeleton className="h-5 w-24" />
          ) : (
            <div className="leitura text-lg">{formatNumber(totalTokens)}</div>
          )}
        </div>

        {carregando ? (
          <Skeleton className="h-9 w-full" />
        ) : totalTokens === 0 ? (
          <div className="border-border text-muted-foreground flex h-9 items-center justify-center rounded-sm border border-dashed text-xs">
            Nenhum token registrado neste período.
          </div>
        ) : (
          <div className="bg-muted flex h-9 w-full overflow-hidden rounded-sm" aria-hidden="true">
            {partes
              .filter((p) => p.valor > 0)
              .map((p, i) => (
                <div
                  key={p.chave}
                  // A largura transiciona porque o mesmo segmento sobrevive à troca de
                  // filtro: a proporção nova desliza a partir da antiga em vez de saltar.
                  className="fita-segmento transition-[width,opacity] duration-300"
                  style={{
                    width: `${(p.valor / totalTokens) * 100}%`,
                    background: p.cor,
                    animationDelay: `${i * 70}ms`,
                    opacity: destacado && destacado !== p.chave ? 0.25 : 1,
                  }}
                />
              ))}
          </div>
        )}

        {/* A legenda carrega os números em texto — a fita é a forma, não a fonte. */}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          {partes.map((p) => (
            <div
              key={p.chave}
              className="min-w-0"
              onMouseEnter={() => setDestacado(p.chave)}
              onMouseLeave={() => setDestacado(null)}
            >
              <dt className="flex items-center gap-1.5">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                  style={{ background: p.cor }}
                />
                <span
                  className={cn(
                    "truncate text-xs transition-colors",
                    destacado === p.chave ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {p.nome}
                </span>
              </dt>
              <dd className="mt-1 pl-4">
                {carregando ? (
                  <Skeleton className="h-4 w-16" />
                ) : (
                  <>
                    <span className="leitura text-sm">{formatNumber(p.valor)}</span>
                    <span className="text-muted-foreground ml-1.5 font-mono text-[0.6875rem] tabular-nums">
                      {totalTokens > 0 ? `${((p.valor / totalTokens) * 100).toFixed(1)}%` : "—"}
                    </span>
                  </>
                )}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
