import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

import { Conteudo } from "@/components/conteudo";
import { FiltrosWhatsapp } from "@/components/filtros-whatsapp";
import { GlobalFilters } from "@/components/global-filters";
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
import { useFilters, whatsappToParams } from "@/lib/filters";
import { formatCurrency, formatDateTime, formatNumber } from "@/lib/format";
import { visualDaCategoria, visualDaDirecao } from "@/lib/grafico";
import { cn } from "@/lib/utils";
import type { MensagemItem, MensagensResponse } from "@/lib/api-types";

export const Route = createFileRoute("/whatsapp/mensagens")({
  head: () => ({
    meta: [
      { title: "Mensagens — Painel de custos" },
      {
        name: "description",
        content: "Lista de mensagens de WhatsApp com categoria, país, cobrança e custo.",
      },
      { property: "og:title", content: "Mensagens — Painel de custos" },
      {
        property: "og:description",
        content: "A linha crua de cada mensagem: quem falou, para onde foi e quanto custou.",
      },
    ],
  }),
  component: MensagensPage,
});

const PAGE_SIZE = 50;

/**
 * A lista crua, nos moldes de `/llm/eventos` — e com uma diferença de fundo.
 *
 * No LLM a porta de entrada é o ator, porque a pergunta é "quem está gastando" e uma linha por
 * chamada quase nunca responde. Aqui a linha **é** a leitura: uma mensagem é a unidade de cobrança
 * da Meta, e é nesta tabela que se descobre uma mensagem cobrável sem preço cadastrado — o buraco
 * que nenhum gráfico denuncia, porque ela sai da soma em silêncio.
 */
function MensagensPage() {
  const { filters } = useFilters();
  const base = whatsappToParams(filters);

  const [offset, setOffset] = useState(0);
  const [abertos, setAbertos] = useState<Set<string>>(new Set());

  // Voltar para a primeira página quando qualquer filtro muda: o offset antigo aponta para um
  // lugar que não existe mais no novo resultado.
  useEffect(() => {
    setOffset(0);
  }, [base.de, base.ate, base.aplicacao, base.ator, base.categoria, base.direcao]);

  const params = { ...base, limite: PAGE_SIZE, offset };
  const q = useQuery({
    queryKey: ["mensagens-whatsapp", params],
    queryFn: () => apiGet<MensagensResponse>("/v1/whatsapp/mensagens", params),
  });

  const alternar = (id: string) =>
    setAbertos((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(id)) proximo.delete(id);
      else proximo.add(id);
      return proximo;
    });

  const total = q.data?.total ?? 0;
  const pagina = Math.floor(offset / PAGE_SIZE) + 1;
  const paginas = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-4">
      <GlobalFilters>
        <FiltrosWhatsapp />
      </GlobalFilters>

      <PainelCard
        title="Mensagens"
        hint={total > 0 ? `${formatNumber(total)} no período` : undefined}
        bleed
        loading={q.isLoading}
        error={q.error}
        empty={!q.isLoading && (q.data?.itens.length ?? 0) === 0}
        emptyMessage="Nenhuma mensagem neste período. Amplie as datas ou limpe os filtros."
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-8 pl-3" />
                <TableHead className="etiqueta py-3">Data/hora</TableHead>
                <TableHead className="etiqueta py-3">Ator</TableHead>
                <TableHead className="etiqueta py-3">Direção</TableHead>
                <TableHead className="etiqueta py-3">Categoria</TableHead>
                <TableHead className="etiqueta py-3">País</TableHead>
                <TableHead className="etiqueta py-3">Cobrável</TableHead>
                <TableHead className="etiqueta py-3 text-right">Custo</TableHead>
                <TableHead className="etiqueta py-3 pr-5">Conteúdo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(q.data?.itens ?? []).map((m) => (
                <Linha key={m.id} mensagem={m} aberta={abertos.has(m.id)} onAlternar={alternar} />
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
    </div>
  );
}

const CORTE_DA_PREVIA = 90;

function Linha({
  mensagem,
  aberta,
  onAlternar,
}: {
  mensagem: MensagemItem;
  aberta: boolean;
  onAlternar: (id: string) => void;
}) {
  const direcao = visualDaDirecao(mensagem.direcao);
  const categoria = visualDaCategoria(mensagem.categoria);
  const cor = direcao?.cor ?? "var(--border)";

  return (
    <>
      <TableRow
        // A linha inteira é o gatilho porque ler a mensagem é o motivo de estar aqui — mas o
        // controle focável continua sendo o botão, que também alterna e por isso segura o clique
        // para não alternar duas vezes.
        onClick={() => onAlternar(mensagem.id)}
        className={cn("cursor-pointer", aberta && "border-b-0")}
      >
        {/* O filete na direção da mensagem: descendo a lista, quem falou se lê antes da coluna. */}
        <TableCell className="border-l-2 p-1 pl-3" style={{ borderLeftColor: cor }}>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => {
              e.stopPropagation();
              onAlternar(mensagem.id);
            }}
            aria-expanded={aberta}
            aria-label={aberta ? "Ocultar conteúdo" : "Ver conteúdo"}
          >
            <ChevronDown className={cn("h-4 w-4 transition-transform", aberta && "rotate-180")} />
          </Button>
        </TableCell>
        <TableCell className="text-muted-foreground font-mono text-xs whitespace-nowrap">
          {formatDateTime(mensagem.criado_em)}
        </TableCell>
        <TableCell className="max-w-[10rem] truncate font-mono text-xs" title={mensagem.ator}>
          {mensagem.ator}
        </TableCell>
        <TableCell className="text-xs whitespace-nowrap">
          <span className="inline-flex items-center gap-1.5">
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ background: cor }}
              aria-hidden
            />
            {direcao?.nome ?? mensagem.direcao}
          </span>
        </TableCell>
        <TableCell className="text-xs whitespace-nowrap">
          {categoria ? (
            <span className="inline-flex items-center gap-1.5">
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: categoria.cor }}
                aria-hidden
              />
              {categoria.nome}
            </span>
          ) : (
            // Recebida: a Meta categoriza o que sai, não o que entra.
            <span className="text-muted-foreground">—</span>
          )}
        </TableCell>
        <TableCell className="font-mono text-xs">{mensagem.pais}</TableCell>
        <TableCell className="text-xs whitespace-nowrap">
          {mensagem.cobravel ? (
            "Cobrável"
          ) : (
            // Discreto de propósito: a maior parte da conversa cai na janela gratuita, e um
            // marcador forte em quase toda linha deixaria de marcar coisa nenhuma.
            <span className="text-muted-foreground">Grátis</span>
          )}
        </TableCell>
        <TableCell className="leitura text-custo pr-1 text-right text-sm whitespace-nowrap">
          <CelulaCusto mensagem={mensagem} />
        </TableCell>
        <TableCell className="text-muted-foreground max-w-[22rem] truncate pr-5 text-xs">
          {mensagem.conteudo ? (
            previa(mensagem.conteudo)
          ) : (
            <span className="italic">sem conteúdo</span>
          )}
        </TableCell>
      </TableRow>

      {aberta && (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={9} className="bg-muted/50 px-5 pt-1 pb-5">
            <Conteudo
              titulo={mensagem.direcao === "recebida" ? "Mensagem do cliente" : "Mensagem enviada"}
              texto={mensagem.conteudo}
              cor={cor}
            />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

/**
 * As três coisas que a coluna de custo pode dizer, e que não podem virar o mesmo pixel.
 *
 * `null` só acontece com mensagem **cobrável sem preço cadastrado** para `(categoria, país, data)`,
 * e é o caminho pelo qual alguém descobre que precisa cadastrar um preço — a mensagem some da soma
 * sem erro nenhum. Por isso o `title` diz qual preço falta, em vez de um traço mudo.
 *
 * A não-cobrável fica em branco: o `0,00` dela competiria visualmente com os valores reais, e a
 * coluna ao lado já disse "grátis".
 */
function CelulaCusto({ mensagem }: { mensagem: MensagemItem }) {
  if (!mensagem.cobravel) return null;

  if (mensagem.custo === null) {
    return (
      <span
        className="text-muted-foreground cursor-help"
        title={`Sem preço cadastrado para ${mensagem.categoria ?? "esta categoria"} em ${
          mensagem.pais
        } nesta data. A mensagem é cobrável e fica fora da soma até o preço existir.`}
      >
        —
      </span>
    );
  }

  return <>{formatCurrency(mensagem.custo, mensagem.moeda)}</>;
}

function previa(texto: string): string {
  const limpo = texto.replace(/\s+/g, " ").trim();
  return limpo.length > CORTE_DA_PREVIA ? `${limpo.slice(0, CORTE_DA_PREVIA)}…` : limpo;
}
