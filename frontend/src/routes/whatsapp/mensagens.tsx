import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ListOrdered } from "lucide-react";

import { BotaoDeConteudo } from "@/components/botao-de-conteudo";
import { CabecalhoDaPagina } from "@/components/cabecalho-da-pagina";
import { Conteudo } from "@/components/conteudo";
import { FiltrosWhatsapp } from "@/components/filtros-whatsapp";
import { GlobalFilters } from "@/components/global-filters";
import { Paginacao } from "@/components/paginacao";
import { PainelCard } from "@/components/painel-card";
import { StatusPill } from "@/components/status-pill";
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
import { cn, haTextoSelecionado } from "@/lib/utils";
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

  const itens = q.data?.itens ?? [];
  const total = q.data?.total ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <CabecalhoDaPagina
        titulo="Mensagens de WhatsApp"
        subtitulo="Uma linha por mensagem: quem falou, se a Meta cobrou e quanto custou. Abra a linha para ler o texto"
      />
      <GlobalFilters recortesDaSecao={["categoria", "direcao"]}>
        <FiltrosWhatsapp />
      </GlobalFilters>

      <div className="flex flex-col gap-3">
        <PainelCard
          title="Mensagens"
          icon={ListOrdered}
          hint={total > 0 ? `${formatNumber(total)} no período` : undefined}
          bleed
          loading={q.isLoading}
          error={q.error}
          onRetry={() => void q.refetch()}
          empty={!q.isLoading && itens.length === 0}
          emptyMessage="Nenhuma mensagem neste período. Amplie as datas ou limpe os filtros."
        >
          {/* Abaixo de 700px a tabela vira lista de cartões: as mesmas linhas, sem rolagem lateral. */}
          <ul className="divide-line divide-y min-[700px]:hidden">
            {itens.map((m) => (
              <MensagemCartao
                key={m.id}
                mensagem={m}
                aberta={abertos.has(m.id)}
                onAlternar={alternar}
              />
            ))}
          </ul>
          <div className="hidden min-[700px]:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10 pl-3">
                    <span className="sr-only">Conteúdo</span>
                  </TableHead>
                  <TableHead>Ator</TableHead>
                  <TableHead>Direção</TableHead>
                  <TableHead>Cobrança</TableHead>
                  <TableHead>Conteúdo</TableHead>
                  <TableHead className="text-right">Custo</TableHead>
                  <TableHead className="pr-4 text-right">Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itens.map((m) => (
                  <MensagemLinha
                    key={m.id}
                    mensagem={m}
                    aberta={abertos.has(m.id)}
                    onAlternar={alternar}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        </PainelCard>

        {/* O rodapé só existe quando há linhas: carregando, com erro ou vazio ele diria "Nenhum
            resultado · Página 1 de 1" embaixo de um cartão que diz outra coisa. */}
        {!q.isLoading && !q.error && itens.length > 0 && (
          <Paginacao
            offset={offset}
            total={total}
            tamanho={PAGE_SIZE}
            ocupado={q.isFetching}
            onOffset={setOffset}
          />
        )}
      </div>
    </div>
  );
}

const CORTE_DA_PREVIA = 90;

/** A categoria em palavras. As recebidas não têm: a Meta categoriza o que sai, não o que entra. */
function nomeDaCategoria(m: MensagemItem): string {
  return visualDaCategoria(m.categoria)?.nome ?? "Sem categoria";
}

/**
 * Se a Meta cobrou, como pílula — é estado da mensagem, e quem decide é a Meta (`pricing.billable`):
 * o painel copia, não recalcula. "Grátis" fica no tom neutro de propósito: a maior parte da conversa
 * cai na janela gratuita, e um marcador forte em quase toda linha deixaria de marcar coisa nenhuma.
 */
function Cobranca({ mensagem }: { mensagem: MensagemItem }) {
  return mensagem.cobravel ? (
    <StatusPill tom="progress">Cobrável</StatusPill>
  ) : (
    <StatusPill tom="neutral">Grátis</StatusPill>
  );
}

/** A direção com o ponto na cor dela — a mesma da borda do texto quando a linha abre. */
function Direcao({ mensagem }: { mensagem: MensagemItem }) {
  const direcao = visualDaDirecao(mensagem.direcao);
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ background: direcao?.cor ?? "var(--wu-line-strong)" }}
      />
      {direcao?.nome ?? mensagem.direcao}
    </span>
  );
}

/**
 * Qual preço falta, por extenso. Vai no `title` da pílula "Sem preço" e repetido na linha aberta,
 * porque `title` não existe no toque nem no teclado — e é por aqui que se descobre o que cadastrar.
 */
function precoQueFalta(m: MensagemItem): string {
  const categoria = m.categoria ? nomeDaCategoria(m) : "esta categoria";
  return `Sem preço cadastrado para ${categoria} em ${m.pais} nesta data. A mensagem é cobrável e fica fora da soma até o preço existir.`;
}

/** O texto da mensagem e o `wamid` — o id técnico, em mono, para achar a mensagem do lado da Meta. */
function ConteudoDaMensagem({ mensagem }: { mensagem: MensagemItem }) {
  const cor = visualDaDirecao(mensagem.direcao)?.cor ?? "var(--wu-line-strong)";
  return (
    <div className="flex min-w-0 flex-col gap-3">
      {mensagem.cobravel && mensagem.custo === null && (
        <p className="text-muted-foreground text-[12.5px]">{precoQueFalta(mensagem)}</p>
      )}
      <Conteudo
        titulo={mensagem.direcao === "recebida" ? "Mensagem do cliente" : "Mensagem enviada"}
        texto={mensagem.conteudo}
        cor={cor}
      />
      {mensagem.id_externo && (
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-subtle text-[12.5px]">wamid</span>
          <span className="text-foreground font-mono text-xs break-all">{mensagem.id_externo}</span>
        </div>
      )}
    </div>
  );
}

function MensagemLinha({
  mensagem,
  aberta,
  onAlternar,
}: {
  mensagem: MensagemItem;
  aberta: boolean;
  onAlternar: (id: string) => void;
}) {
  return (
    <>
      {/* A linha inteira abre o conteúdo, como no wide-ui; o botão continua sendo o caminho do
          teclado. Clique que terminou uma seleção de texto é cópia, não pedido de abrir. */}
      <TableRow
        onClick={() => {
          if (haTextoSelecionado()) return;
          onAlternar(mensagem.id);
        }}
        className={cn("cursor-pointer", aberta && "border-b-0")}
      >
        <TableCell className="py-0 pr-0 pl-3">
          <BotaoDeConteudo aberto={aberta} onClick={() => onAlternar(mensagem.id)} />
        </TableCell>
        <TableCell className="max-w-[13rem]">
          <div className="text-foreground truncate font-medium" title={mensagem.ator}>
            {mensagem.ator}
          </div>
          <div className="text-subtle truncate text-xs">
            {mensagem.aplicacao} · {mensagem.pais}
          </div>
        </TableCell>
        <TableCell className="whitespace-nowrap">
          <Direcao mensagem={mensagem} />
          <div className="text-subtle text-xs">{nomeDaCategoria(mensagem)}</div>
        </TableCell>
        <TableCell>
          <Cobranca mensagem={mensagem} />
        </TableCell>
        {/* `w-full max-w-0`: em tabela de layout automático um `max-w` em rem no `<td>` é ignorado e a
            coluna cresce até caber a prévia inteira, empurrando Data para fora a 1280. Com largura
            zero de máximo ela ocupa só a sobra, e o `truncate` corta dentro dela. */}
        <TableCell className="text-muted-foreground w-full max-w-0 truncate">
          {mensagem.conteudo ? (
            previa(mensagem.conteudo)
          ) : (
            <span className="text-subtle">Sem conteúdo</span>
          )}
        </TableCell>
        <TableCell className="text-foreground text-right font-medium whitespace-nowrap">
          <CelulaCusto mensagem={mensagem} />
        </TableCell>
        <TableCell className="text-muted-foreground pr-4 text-right whitespace-nowrap">
          {formatDateTime(mensagem.criado_em, { segundos: true })}
        </TableCell>
      </TableRow>

      {aberta && (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={7} className="bg-raised h-auto px-4 pt-1 pb-4">
            <ConteudoDaMensagem mensagem={mensagem} />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

/** A mesma linha abaixo de 700px: data e cobrança em cima, o ator, e os fatos numa linha meta. */
function MensagemCartao({
  mensagem,
  aberta,
  onAlternar,
}: {
  mensagem: MensagemItem;
  aberta: boolean;
  onAlternar: (id: string) => void;
}) {
  return (
    // O cartão inteiro abre, como a linha da tabela; o botão continua sendo o caminho do teclado.
    <li
      onClick={() => {
        if (haTextoSelecionado()) return;
        onAlternar(mensagem.id);
      }}
      className="flex cursor-pointer flex-col gap-1 px-4 py-3"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-subtle text-xs">
          {formatDateTime(mensagem.criado_em, { segundos: true })}
        </span>
        <Cobranca mensagem={mensagem} />
      </div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-foreground min-w-0 truncate font-medium" title={mensagem.ator}>
          {mensagem.ator}
        </span>
        <span className="text-foreground shrink-0 font-medium">
          <CelulaCusto mensagem={mensagem} />
        </span>
      </div>
      <div className="text-subtle text-xs">
        {visualDaDirecao(mensagem.direcao)?.nome ?? mensagem.direcao} · {nomeDaCategoria(mensagem)}{" "}
        · {mensagem.pais} · {mensagem.aplicacao}
      </div>
      <div>
        <BotaoDeConteudo aberto={aberta} onClick={() => onAlternar(mensagem.id)} comRotulo />
      </div>
      {aberta && (
        <div className="pt-1">
          <ConteudoDaMensagem mensagem={mensagem} />
        </div>
      )}
    </li>
  );
}

/**
 * As três coisas que a coluna de custo pode dizer, e que não podem virar o mesmo pixel.
 *
 * `null` só acontece com mensagem **cobrável sem preço cadastrado** para `(categoria, país, data)`,
 * e é o caminho pelo qual alguém descobre que precisa cadastrar um preço — a mensagem some da soma
 * sem erro nenhum. Por isso ela sai como pílula "Sem preço" (o mesmo tom do "Sem preço vigente" da
 * tela de preços), com o `title` dizendo qual preço falta (repetido na linha aberta), em vez de um
 * traço mudo.
 *
 * A não-cobrável fica em branco: o `0,00` dela competiria visualmente com os valores reais, e a
 * pílula de cobrança já disse "grátis".
 */
function CelulaCusto({ mensagem }: { mensagem: MensagemItem }) {
  if (!mensagem.cobravel) return null;

  if (mensagem.custo === null) {
    return (
      <StatusPill tom="pending" className="cursor-help" title={precoQueFalta(mensagem)}>
        Sem preço
      </StatusPill>
    );
  }

  return <>{formatCurrency(mensagem.custo, mensagem.moeda)}</>;
}

function previa(texto: string): string {
  const limpo = texto.replace(/\s+/g, " ").trim();
  return limpo.length > CORTE_DA_PREVIA ? `${limpo.slice(0, CORTE_DA_PREVIA)}…` : limpo;
}
