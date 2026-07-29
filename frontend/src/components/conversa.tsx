import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { ArrowUp } from "lucide-react";

import { BALDES } from "@/components/medidor";
import { EmptyBox, ErrorBox } from "@/components/empty-states";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiGet } from "@/lib/api";
import { formatCurrency, formatDayLabel, formatNumber, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { EventoItem, EventosResponse } from "@/lib/api-types";

/**
 * A conversa — a transcrição do ator, lida de ponta a ponta.
 *
 * Não é balão de aplicativo de mensagem. Isto é um painel de custo, e um chat que larga o
 * dinheiro pelo caminho deixa de responder a pergunta da tela. O desenho é o medidor
 * desenrolado no tempo: uma **fita de registro** com uma calha de instrumento na margem
 * (hora e custo) e, em cada troca, um traço cruzando a espinha com a largura proporcional
 * aos tokens daquela troca — o perfil de peso da conversa, visível antes de ler o texto.
 *
 * A unidade da fita é a **troca**, não a mensagem: `mensagem` e `resposta` moram na mesma
 * linha de `registro_uso` (uma chamada ao LLM), então separá-las em dois eventos soltos
 * inventaria uma cronologia que o banco não tem.
 */

const PAGINA = 50;

type Params = Record<string, string | undefined>;

export function Conversa({ baseParams }: { baseParams: Params }) {
  const q = useInfiniteQuery({
    queryKey: ["conversa", baseParams],
    queryFn: ({ pageParam }) =>
      apiGet<EventosResponse>("/v1/llm/eventos", {
        ...baseParams,
        limite: PAGINA,
        offset: pageParam,
      }),
    initialPageParam: 0,
    // A API devolve do mais novo para o mais antigo, então "próxima página" é ir para trás
    // no tempo. O offset acumulado é a contagem do que já veio.
    getNextPageParam: (_ultima, paginas) => {
      const carregadas = paginas.reduce((s, p) => s + p.itens.length, 0);
      return carregadas < (paginas[0]?.total ?? 0) ? carregadas : undefined;
    },
  });

  if (q.isLoading) return <EsqueletoDaConversa />;
  if (q.error)
    return (
      <div className="p-4">
        <ErrorBox error={q.error} />
      </div>
    );

  const paginas = q.data?.pages ?? [];
  const total = paginas[0]?.total ?? 0;

  // Do mais antigo para o mais novo: conversa se lê de cima para baixo, e a última linha é
  // a mais recente — como em qualquer histórico de mensagem.
  const trocas = paginas
    .flatMap((p) => p.itens)
    .slice()
    .reverse();

  if (trocas.length === 0) {
    return (
      <div className="p-4">
        <EmptyBox message="Este ator não fez chamadas no período selecionado." />
      </div>
    );
  }

  // A escala do perfil é relativa ao que está em tela: o traço responde "esta troca pesou
  // mais que as outras", não "esta troca gastou N tokens" — esse número é o modo tabela.
  const maiorTroca = Math.max(...trocas.map(tokensDaTroca), 1);

  return (
    <div className="flex flex-col px-4 py-5 sm:px-6">
      {q.hasNextPage && (
        <div className="mb-6 flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => q.fetchNextPage()}
            disabled={q.isFetchingNextPage}
            className="gap-1.5"
          >
            <ArrowUp className="h-3.5 w-3.5" />
            {q.isFetchingNextPage ? "Carregando…" : "Carregar trocas anteriores"}
          </Button>
        </div>
      )}

      {trocas.map((troca, i) => {
        const anterior = trocas[i - 1];
        return (
          <div key={troca.id}>
            {mudouODia(anterior, troca) && <ReguaDoDia iso={troca.criado_em} primeira={i === 0} />}
            <Troca
              troca={troca}
              proporcao={tokensDaTroca(troca) / maiorTroca}
              // O modelo só aparece quando muda: repeti-lo em toda troca é ruído, e a troca
              // de modelo no meio da conversa é justamente o que vale ser visto.
              modelo={anterior?.modelo === troca.modelo ? undefined : troca.modelo}
            />
          </div>
        );
      })}

      <p className="text-muted-foreground border-t pt-4 text-center font-mono text-[0.6875rem]">
        {formatNumber(trocas.length)} de {formatNumber(total)} {total === 1 ? "troca" : "trocas"} no
        período
      </p>
    </div>
  );
}

function tokensDaTroca(e: EventoItem): number {
  return BALDES.reduce((s, b) => s + e[b.chave], 0);
}

function mudouODia(anterior: EventoItem | undefined, atual: EventoItem): boolean {
  if (!anterior) return true;
  return new Date(anterior.criado_em).toDateString() !== new Date(atual.criado_em).toDateString();
}

function ReguaDoDia({ iso, primeira }: { iso: string; primeira: boolean }) {
  return (
    <div className={cn("flex items-center gap-3 pb-5", !primeira && "pt-3")}>
      <div className="etiqueta shrink-0">{formatDayLabel(iso)}</div>
      <div className="bg-border h-px flex-1" />
    </div>
  );
}

function Troca({
  troca,
  proporcao,
  modelo,
}: {
  troca: EventoItem;
  proporcao: number;
  modelo?: string;
}) {
  const semConteudo = !troca.mensagem && !troca.resposta;

  return (
    <article className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-3 sm:grid-cols-[5.5rem_minmax(0,1fr)] sm:gap-x-4">
      {/* A calha de instrumento: hora e dinheiro, as duas leituras que não são texto. */}
      <div className="pt-px text-right">
        <div className="leitura text-muted-foreground text-[0.6875rem]">
          {formatTime(troca.criado_em)}
        </div>
        {/* Não quebra no meio da quantia, pela mesma razão do medidor: valor partido em duas
            linhas deixa de ser legível como dinheiro. */}
        <div className="leitura text-custo mt-0.5 overflow-hidden text-[0.6875rem] text-ellipsis whitespace-nowrap">
          {formatCurrency(troca.custo, troca.moeda)}
        </div>
      </div>

      {/* A espinha da fita, e o que cresce dela. */}
      <div className="border-l pb-7 pl-4 sm:pl-5">
        <Perfil troca={troca} proporcao={proporcao} />

        {semConteudo ? (
          <div className="text-muted-foreground rounded-sm border border-dashed px-3 py-2 text-xs">
            Chamada sem conteúdo registrado. Os tokens contam no período; o texto não veio no
            evento.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <Turno papel="Ator" texto={troca.mensagem} cor="var(--balde-entrada)" />
            <Turno
              papel="Agente"
              texto={troca.resposta}
              cor="var(--balde-saida)"
              modelo={modelo}
              recuado
            />
          </div>
        )}
      </div>
    </article>
  );
}

/**
 * O traço que cruza a espinha: largura contra a troca mais pesada em tela, repartido nas
 * mesmas quatro cores do medidor. Sem animação de entrada — a fita do topo cresce uma vez
 * porque é uma leitura só; cinquenta traços crescendo seria debandada.
 */
function Perfil({ troca, proporcao }: { troca: EventoItem; proporcao: number }) {
  const total = tokensDaTroca(troca);
  const partes = BALDES.map((b) => ({ ...b, valor: troca[b.chave] })).filter((p) => p.valor > 0);

  return (
    <div
      className="mb-3 -ml-4 w-full max-w-[16rem] sm:-ml-5"
      role="img"
      aria-label={`${formatNumber(total)} tokens nesta troca`}
    >
      <div
        className="bg-muted flex h-[3px] overflow-hidden rounded-full"
        // Piso de 8%: uma troca curta perto de uma longa desapareceria, e some com ela a
        // única marca de que a chamada aconteceu.
        style={{ width: `${Math.max(proporcao * 100, 8)}%` }}
      >
        {partes.map((p) => (
          <div key={p.chave} style={{ width: `${(p.valor / total) * 100}%`, background: p.cor }} />
        ))}
      </div>
    </div>
  );
}

const LIMITE_DE_CORTE = 600;

function Turno({
  papel,
  texto,
  cor,
  modelo,
  recuado,
}: {
  papel: string;
  texto: string | null;
  cor: string;
  modelo?: string;
  /** O turno do agente entra um degrau, para a ida e volta ter ritmo sem virar balão. */
  recuado?: boolean;
}) {
  const [inteiro, setInteiro] = useState(false);
  const longo = (texto?.length ?? 0) > LIMITE_DE_CORTE;

  return (
    <div className={cn("min-w-0", recuado && "ml-4 sm:ml-8")}>
      <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="etiqueta">{papel}</span>
        {modelo && (
          <span className="text-muted-foreground font-mono text-[0.6875rem]">{modelo}</span>
        )}
      </div>
      {texto ? (
        <>
          {/* A borda carrega o balde: o que o ator mandou virou token de entrada, o que o
              agente devolveu virou token de saída. */}
          <p
            className={cn(
              "border-l-2 pl-3 text-[0.9375rem] leading-relaxed break-words whitespace-pre-wrap",
              longo && !inteiro && "line-clamp-[8]",
            )}
            style={{ borderLeftColor: cor }}
          >
            {texto}
          </p>
          {longo && (
            <button
              type="button"
              onClick={() => setInteiro((v) => !v)}
              className="text-muted-foreground hover:text-foreground mt-1.5 ml-3 font-mono text-[0.6875rem] underline underline-offset-2 transition-colors"
            >
              {inteiro ? "Recolher" : "Mostrar tudo"}
            </button>
          )}
        </>
      ) : (
        <p className="text-muted-foreground border-l-2 border-dashed pl-3 text-sm">Não informado</p>
      )}
    </div>
  );
}

function EsqueletoDaConversa() {
  return (
    <div className="flex flex-col gap-7 px-4 py-5 sm:px-6">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-3 sm:grid-cols-[5.5rem_minmax(0,1fr)] sm:gap-x-4"
        >
          <Skeleton className="h-8 w-full" />
          <div className="flex flex-col gap-2 border-l pl-4 sm:pl-5">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="ml-4 h-16 w-[85%] sm:ml-8" />
          </div>
        </div>
      ))}
    </div>
  );
}
