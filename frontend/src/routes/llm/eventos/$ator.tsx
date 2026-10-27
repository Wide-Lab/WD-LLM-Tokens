import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import {
  ArrowLeft,
  Boxes,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ListOrdered,
  MessagesSquare,
} from "lucide-react";

import { CabecalhoDaPagina } from "@/components/cabecalho-da-pagina";
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
import { apiGet } from "@/lib/api";
import { useFilters, filtersToParams } from "@/lib/filters";
import { formatCurrency, formatDateTime, formatNumber } from "@/lib/format";
import { cn, haTextoSelecionado } from "@/lib/utils";
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
      <CabecalhoDaPagina
        titulo={ator}
        subtitulo="Chamadas de LLM deste ator no período, com o que foi dito e quanto custou"
        acoes={
          <Button variant="outline" asChild>
            <Link to="/llm/eventos">
              <ArrowLeft className="h-4 w-4" />
              Voltar para atores
            </Link>
          </Button>
        }
      />

      <GlobalFilters recortesDaSecao={["modelo"]}>
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
      onRetry={() => void q.refetch()}
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
      icon={Boxes}
      hint={modelos.length > 0 ? `${formatNumber(modelos.length)} no período` : undefined}
      bleed
      loading={q.isLoading}
      error={q.error}
      onRetry={() => void q.refetch()}
      empty={!q.isLoading && modelos.length === 0}
      emptyMessage="Este ator não chamou nenhum modelo no período."
    >
      <ul className="divide-line divide-y min-[700px]:hidden">
        {modelos.map((m) => (
          <li key={m.grupo} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="text-foreground truncate font-medium">{m.grupo}</div>
              <div className="text-subtle mt-0.5 text-xs">
                {formatNumber(m.requisicoes)} {m.requisicoes === 1 ? "requisição" : "requisições"} ·{" "}
                {formatNumber(totalDeTokens(m))} tokens
              </div>
            </div>
            <div className="text-foreground shrink-0 font-medium">
              {formatCurrency(m.custo, m.moeda)}
            </div>
          </li>
        ))}
      </ul>
      <div className="hidden min-[700px]:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Modelo</TableHead>
              <TableHead className="text-right">Entrada</TableHead>
              <TableHead className="text-right">Saída</TableHead>
              <TableHead className="text-right">Cache leitura / escrita</TableHead>
              <TableHead className="pr-4 text-right">Custo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {modelos.map((m) => (
              <TableRow key={m.grupo}>
                <TableCell className="pl-4">
                  <div className="text-foreground font-medium">{m.grupo}</div>
                  <div className="text-subtle text-xs">
                    {formatNumber(m.requisicoes)}{" "}
                    {m.requisicoes === 1 ? "requisição" : "requisições"}
                  </div>
                </TableCell>
                <TableCell className="text-right">{formatNumber(m.tokens_entrada)}</TableCell>
                <TableCell className="text-right">{formatNumber(m.tokens_saida)}</TableCell>
                <TableCell className="text-muted-foreground text-right">
                  {formatNumber(m.tokens_cache_leitura)} / {formatNumber(m.tokens_cache_escrita)}
                </TableCell>
                <TableCell className="text-foreground pr-4 text-right font-medium whitespace-nowrap">
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
 *
 * O cartão é um só nas duas formas, e só o corpo troca: se a raiz mudasse de tipo, o React
 * desmontaria o alternador junto, e o botão que acabou de receber Enter levaria o foco para o
 * `body`.
 */
function Chamadas({ baseParams }: { baseParams: Params }) {
  const [modo, setModo] = useState<Modo>("tabela");
  const [offset, setOffset] = useState(0);
  const [abertos, setAbertos] = useState<Set<string>>(new Set());

  // Voltar para a primeira página quando o período (ou qualquer filtro) muda: o offset antigo
  // aponta para um lugar que não existe mais no novo resultado.
  useEffect(() => {
    setOffset(0);
  }, [baseParams.de, baseParams.ate, baseParams.aplicacao, baseParams.modelo, baseParams.ator]);

  const emTabela = modo === "tabela";
  const params = { ...baseParams, limite: PAGE_SIZE, offset };
  // Na conversa a tabela não está na tela, e a consulta dela fica parada — como antes, quando ela
  // nem montava.
  const q = useQuery({
    queryKey: ["eventos-llm", params],
    queryFn: () => apiGet<EventosResponse>("/v1/llm/eventos", params),
    enabled: emTabela,
  });

  const alternar = (id: string) =>
    setAbertos((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(id)) proximo.delete(id);
      else proximo.add(id);
      return proximo;
    });

  const data = q.data;
  const itens = data?.itens ?? [];
  const total = data?.total ?? 0;
  const pagina = Math.floor(offset / PAGE_SIZE) + 1;
  const paginas = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-3">
      <PainelCard
        title="Chamadas"
        icon={emTabela ? ListOrdered : MessagesSquare}
        hint={emTabela && total > 0 ? `${formatNumber(total)} no período` : undefined}
        action={<AlternadorDeModo modo={modo} onModo={setModo} />}
        bleed
        loading={emTabela && q.isLoading}
        error={emTabela ? q.error : null}
        onRetry={() => void q.refetch()}
        empty={emTabela && !q.isLoading && itens.length === 0}
        emptyMessage="Este ator não fez chamadas no período selecionado."
      >
        {emTabela ? (
          <>
            <ul className="divide-line divide-y min-[700px]:hidden">
              {itens.map((e) => (
                <ChamadaCartao
                  key={e.id}
                  evento={e}
                  aberto={abertos.has(e.id)}
                  onAlternar={alternar}
                />
              ))}
            </ul>
            <div className="hidden min-[700px]:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10 pl-3" />
                    <TableHead>Modelo</TableHead>
                    <TableHead className="text-right">Entrada</TableHead>
                    <TableHead className="text-right">Saída</TableHead>
                    <TableHead className="text-right">Cache leitura / escrita</TableHead>
                    <TableHead className="text-right">Custo</TableHead>
                    <TableHead className="pr-4 text-right">Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itens.map((e) => (
                    <ChamadaLinha
                      key={e.id}
                      evento={e}
                      aberto={abertos.has(e.id)}
                      onAlternar={alternar}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        ) : (
          <Conversa baseParams={baseParams} />
        )}
      </PainelCard>

      {/* O rodapé só existe quando há linhas: carregando, com erro ou vazio ele diria "Nenhum
          resultado · Página 1 de 1" embaixo de um cartão que diz outra coisa. */}
      {emTabela && !q.isLoading && !q.error && itens.length > 0 && (
        <Paginacao
          offset={offset}
          total={total}
          pagina={pagina}
          paginas={paginas}
          ocupado={q.isFetching}
          onOffset={setOffset}
        />
      )}
    </div>
  );
}

/** Controle segmentado: duas formas da mesma leitura, a ativa em `surface` sobre o trilho `sel`. */
function AlternadorDeModo({ modo, onModo }: { modo: Modo; onModo: (m: Modo) => void }) {
  return (
    <div
      role="group"
      aria-label="Forma de leitura"
      className="bg-sel flex h-8 items-center gap-0.5 rounded-[var(--wu-radius)] p-0.5"
    >
      {(["tabela", "conversa"] as const).map((m) => (
        <button
          key={m}
          type="button"
          aria-pressed={modo === m}
          onClick={() => onModo(m)}
          className={cn(
            "h-full rounded-[var(--wu-radius-sm)] px-2.5 text-[13px] font-medium transition-colors",
            modo === m
              ? "bg-surface text-foreground shadow-card"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {m === "tabela" ? "Tabela" : "Conversa"}
        </button>
      ))}
    </div>
  );
}

function Paginacao({
  offset,
  total,
  pagina,
  paginas,
  ocupado,
  onOffset,
}: {
  offset: number;
  total: number;
  pagina: number;
  paginas: number;
  ocupado: boolean;
  onOffset: (o: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="text-muted-foreground text-[13px]">
        {total > 0
          ? `${formatNumber(offset + 1)}–${formatNumber(
              Math.min(offset + PAGE_SIZE, total),
            )} de ${formatNumber(total)}`
          : "Nenhum resultado"}
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onOffset(Math.max(0, offset - PAGE_SIZE))}
          disabled={offset === 0 || ocupado}
        >
          <ChevronLeft className="h-4 w-4" />
          Anterior
        </Button>
        <div className="text-muted-foreground px-1 text-[13px]">
          Página {formatNumber(pagina)} de {formatNumber(paginas)}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onOffset(offset + PAGE_SIZE)}
          disabled={offset + PAGE_SIZE >= total || ocupado}
        >
          Próxima
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/** A mensagem do ator e a resposta do agente, lado a lado, com a cor do balde de cada uma. */
function ConteudoDaChamada({ evento }: { evento: EventoItem }) {
  return (
    <div className="grid grid-cols-1 gap-3 min-[1100px]:grid-cols-2">
      {/* A borda de cada painel usa a cor do balde correspondente: o que o ator mandou
          virou token de entrada, o que o agente devolveu virou token de saída. */}
      <Conteudo titulo="Mensagem do ator" texto={evento.mensagem} cor="var(--balde-entrada)" />
      <Conteudo titulo="Resposta do agente" texto={evento.resposta} cor="var(--balde-saida)" />
    </div>
  );
}

function BotaoDeConteudo({
  aberto,
  onClick,
  comRotulo,
}: {
  aberto: boolean;
  onClick: () => void;
  comRotulo?: boolean;
}) {
  return (
    <Button
      variant="ghost"
      size={comRotulo ? "sm" : "icon"}
      className={comRotulo ? "-ml-2 h-7 px-2" : "h-8 w-8"}
      onClick={(e) => {
        // Para aqui, e não na célula: o resto da célula continua abrindo a linha.
        e.stopPropagation();
        onClick();
      }}
      aria-expanded={aberto}
      aria-label={aberto ? "Ocultar conteúdo" : "Ver conteúdo"}
    >
      <ChevronDown className={cn("h-4 w-4 transition-transform", aberto && "rotate-180")} />
      {comRotulo && (aberto ? "Ocultar conteúdo" : "Ver conteúdo")}
    </Button>
  );
}

function ChamadaLinha({
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
      {/* A linha inteira abre o conteúdo, como no wide-ui; o botão continua sendo o caminho do
          teclado e do leitor de tela, e para o próprio clique para não alternar duas vezes.
          Clique que terminou uma seleção de texto é cópia, não pedido de abrir. */}
      <TableRow
        className={cn(aberto && "border-b-0", temConteudo && "cursor-pointer")}
        onClick={
          temConteudo
            ? () => {
                if (haTextoSelecionado()) return;
                onAlternar(evento.id);
              }
            : undefined
        }
      >
        <TableCell className="py-0 pr-0 pl-3">
          {temConteudo && <BotaoDeConteudo aberto={aberto} onClick={() => onAlternar(evento.id)} />}
        </TableCell>
        <TableCell className="whitespace-nowrap">
          <div className="text-foreground font-medium">{evento.modelo}</div>
          <div className="text-subtle text-xs">
            {[evento.aplicacao, evento.provedor].filter(Boolean).join(" · ")}
          </div>
        </TableCell>
        <TableCell className="text-right">{formatNumber(evento.tokens_entrada)}</TableCell>
        <TableCell className="text-right">{formatNumber(evento.tokens_saida)}</TableCell>
        <TableCell className="text-muted-foreground text-right">
          {formatNumber(evento.tokens_cache_leitura)} / {formatNumber(evento.tokens_cache_escrita)}
        </TableCell>
        <TableCell className="text-foreground text-right font-medium whitespace-nowrap">
          {formatCurrency(evento.custo, evento.moeda)}
        </TableCell>
        <TableCell className="text-muted-foreground pr-4 text-right whitespace-nowrap">
          {formatDateTime(evento.criado_em, { segundos: true })}
        </TableCell>
      </TableRow>
      {aberto && (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={7} className="bg-raised h-auto px-4 pt-1 pb-4">
            <ConteudoDaChamada evento={evento} />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function ChamadaCartao({
  evento,
  aberto,
  onAlternar,
}: {
  evento: EventoItem;
  aberto: boolean;
  onAlternar: (id: string) => void;
}) {
  const temConteudo = Boolean(evento.mensagem || evento.resposta);
  const tokens = totalDeTokens(evento);

  return (
    <li className="flex flex-col gap-1 px-4 py-3">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="text-subtle">{formatDateTime(evento.criado_em, { segundos: true })}</span>
        <span className="text-foreground text-[13.5px] font-medium">
          {formatCurrency(evento.custo, evento.moeda)}
        </span>
      </div>
      <div className="text-foreground truncate font-medium">{evento.modelo}</div>
      <div className="text-subtle text-xs">
        {[evento.aplicacao, evento.provedor].filter(Boolean).join(" · ")} · {formatNumber(tokens)}{" "}
        tokens
      </div>
      {temConteudo && (
        <div>
          <BotaoDeConteudo aberto={aberto} onClick={() => onAlternar(evento.id)} comRotulo />
        </div>
      )}
      {aberto && (
        <div className="pt-1">
          <ConteudoDaChamada evento={evento} />
        </div>
      )}
    </li>
  );
}

/** Os quatro baldes somados: não se sobrepõem, então a soma é o total de tokens da linha. */
function totalDeTokens(t: {
  tokens_entrada: number;
  tokens_saida: number;
  tokens_cache_leitura: number;
  tokens_cache_escrita: number;
}) {
  return t.tokens_entrada + t.tokens_saida + t.tokens_cache_leitura + t.tokens_cache_escrita;
}
