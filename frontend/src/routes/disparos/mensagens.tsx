import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { ListOrdered } from "lucide-react";

import { CabecalhoDaPagina } from "@/components/cabecalho-da-pagina";
import { Cartao } from "@/components/cartao";
import { DialogoMensagem } from "@/components/dialogo-mensagem";
import { ErrorBox } from "@/components/empty-states";
import { Campo } from "@/components/global-filters";
import { PainelCard } from "@/components/painel-card";
import { SeloStatusDisparo } from "@/components/selo-status-disparo";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDateOnly, formatDateTime, formatNumber } from "@/lib/format";
import {
  escala,
  saiu,
  valorTotal,
  RESPOSTAS,
  STATUS,
  type Mensagem,
  type Status,
} from "@/lib/mensagens-disparo";
import { listarMensagens, PERIODO_DO_LOG } from "@/lib/mensagens-disparo-mock";
import { listarReguas } from "@/lib/reguas-mock";
import { ordenar, raizDe, reguaPadrao, rotuloDe } from "@/lib/reguas";
import { haTextoSelecionado } from "@/lib/utils";

export const Route = createFileRoute("/disparos/mensagens")({
  head: () => ({
    meta: [
      { title: "Mensagens — Painel de custos" },
      {
        name: "description",
        content: "Log da régua: o que saiu, o que não saiu e por quê, com a resposta do cliente.",
      },
      { property: "og:title", content: "Mensagens — Painel de custos" },
      {
        property: "og:description",
        content: "O que os dois cadastros de Disparos causaram, uma linha por mensagem.",
      },
    ],
  }),
  component: MensagensDisparo,
});

const CHAVE = ["mensagens-disparos"];
/** A mesma chave da aba de réguas: o filtro por etapa lê a lista de lá, não uma cópia. */
const CHAVE_REGUAS = ["reguas-disparos"];

const TODOS = "__todos__";

/**
 * O log da régua — a última aba de Disparos, e a que lista em vez de somar.
 *
 * Vem depois das outras porque é a consequência delas: a régua diz o ritmo, a carteira diz quem
 * segue esse ritmo, e esta tela mostra o que as duas juntas produziram. É também onde se descobre
 * que uma das duas está errada — uma régua com muita `suprimida` é uma régua disparando para quem o
 * portal já tirou da fila.
 *
 * Não é a lista de `/whatsapp/mensagens` com outro título, e a diferença é a razão de a aba existir:
 * lá a linha é o que a Meta cobrou, e existe porque houve `wamid`. Aqui a linha é o que a régua
 * **decidiu**, inclusive quando decidiu não mandar. Suprimida e adiada nunca chegaram à Meta, não
 * custam nada e não aparecem em canto nenhum do painel de WhatsApp — e são as duas linhas que
 * provam que o bloqueio da carteira funcionou.
 *
 * Sem `<GlobalFilters>`, pelo mesmo motivo do dashboard: aplicação, ator e granularidade não
 * existem aqui, e o mock tem janela fixa que ignoraria as datas — um controle que parece filtrar e
 * não filtra é pior do que controle nenhum. Ele só empresta o `Campo`. O recorte que a tela oferece
 * é o que ela sabe honrar, status e etapa, que é como se lê um log de régua: não "o que saiu em
 * março", e sim "o que não saiu, e de qual etapa".
 */
function MensagensDisparo() {
  const [filtroStatus, setFiltroStatus] = useState<Status | typeof TODOS>(TODOS);
  const [filtroEtapa, setFiltroEtapa] = useState<string>(TODOS);
  const [abertaId, setAbertaId] = useState<string | null>(null);

  // Quem abriu o diálogo — o nome do cliente, a linha —, para o foco voltar a ele ao fechar. O
  // diálogo não tem `DialogTrigger`, e sem isto o foco cairia no `<body>`.
  const origemDoFoco = useRef<HTMLElement | null>(null);
  const abrir = (m: Mensagem) => {
    origemDoFoco.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setAbertaId(m.id);
  };

  const q = useQuery({ queryKey: CHAVE, queryFn: listarMensagens });
  const qReguas = useQuery({ queryKey: CHAVE_REGUAS, queryFn: listarReguas });

  const mensagens = useMemo(() => q.data ?? [], [q.data]);
  const reguas = useMemo(() => qReguas.data ?? [], [qReguas.data]);

  /**
   * O filtro por etapa é pela etapa da **padrão**, e junta as correspondentes das outras réguas.
   *
   * "Preventivo" existe nas três, com deslocamento diferente em cada uma — é a mesma decisão, e é
   * dela que se quer o recorte. Uma opção por etapa de cada régua daria nove para três perguntas, e
   * o `origemId` está lá justamente para isso (`raizDe`).
   */
  const raizPorEtapa = useMemo(
    () =>
      Object.fromEntries(
        reguas.flatMap((r) => r.etapas.map((e) => [e.id, raizDe(e)] as const)),
      ) as Record<string, string>,
    [reguas],
  );

  const etapasDaPadrao = reguas.length > 0 ? ordenar(reguaPadrao(reguas).etapas) : [];

  const lista = useMemo(
    () =>
      mensagens.filter(
        (m) =>
          (filtroStatus === TODOS || m.status === filtroStatus) &&
          (filtroEtapa === TODOS || raizPorEtapa[m.etapaId] === filtroEtapa),
      ),
    [mensagens, filtroStatus, filtroEtapa, raizPorEtapa],
  );

  // A mensagem aberta vem sempre da lista, e não do estado guardado no clique — o log não muda,
  // mas o padrão da seção é este, e uma exceção aqui só se descobriria no dia em que ele mudasse.
  const aberta = abertaId ? (mensagens.find((m) => m.id === abertaId) ?? null) : null;

  // A contagem de cada status é sobre o log inteiro, e não sobre a lista filtrada: é ela que diz
  // quantas há antes de escolher, e é onde uma `falhou` não passa despercebida.
  const porStatus = useMemo(() => {
    const contagem = Object.fromEntries(
      (Object.keys(STATUS) as Status[]).map((s) => [s, 0]),
    ) as Record<Status, number>;
    for (const m of mensagens) contagem[m.status] += 1;
    return contagem;
  }, [mensagens]);

  const sairam = mensagens.filter(saiu);
  const lidas = mensagens.filter((m) => m.status === "lida");
  const escalaram = mensagens.filter((m) => escala(m.resposta));
  const naoSairam = mensagens.filter((m) => !saiu(m));

  return (
    <div className="flex flex-col gap-4">
      <CabecalhoDaPagina
        titulo="Mensagens"
        subtitulo="O que a régua decidiu para cada cliente, o que saiu e o que o cliente respondeu"
      />

      {q.error ? (
        <ErrorBox error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <>
          <section aria-label="Recorte do log" className="flex flex-wrap items-end gap-2">
            <Campo rotulo="Status" para="filtro-status">
              <Select
                value={filtroStatus}
                onValueChange={(v) => setFiltroStatus(v as Status | typeof TODOS)}
              >
                <SelectTrigger id="filtro-status" className="w-[11rem]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODOS}>Todos</SelectItem>
                  {(Object.keys(STATUS) as Status[]).map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS[s]} · {formatNumber(porStatus[s])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>

            {etapasDaPadrao.length > 0 && (
              <Campo rotulo="Etapa" para="filtro-etapa">
                <Select value={filtroEtapa} onValueChange={setFiltroEtapa}>
                  <SelectTrigger id="filtro-etapa" className="w-[14rem]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={TODOS}>Todas as etapas</SelectItem>
                    {etapasDaPadrao.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {rotuloDe(e)} · {e.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Campo>
            )}
          </section>

          <div className="grid grid-cols-2 gap-3 min-[1100px]:grid-cols-4">
            <Cartao
              rotulo="Saíram"
              valor={formatNumber(sairam.length)}
              nota={`de ${formatNumber(mensagens.length)} montadas`}
              carregando={q.isLoading}
            />
            <Cartao
              rotulo="Lidas"
              valor={porcentagem(lidas.length, sairam.length)}
              nota={`${formatNumber(lidas.length)} das que saíram`}
              carregando={q.isLoading}
            />
            <Cartao
              rotulo="Escalaram"
              valor={formatNumber(escalaram.length)}
              nota="comprovante, contestação ou pedido de saída"
              carregando={q.isLoading}
            />
            <Cartao
              rotulo="Não saíram"
              valor={formatNumber(naoSairam.length)}
              nota="suprimidas ou adiadas"
              carregando={q.isLoading}
            />
          </div>

          <PainelCard
            title="Mensagens"
            icon={ListOrdered}
            hint={
              q.isLoading
                ? undefined
                : `${formatNumber(lista.length)} de ${formatNumber(mensagens.length)} · ${formatDateOnly(PERIODO_DO_LOG.de)} a ${formatDateOnly(PERIODO_DO_LOG.ate)}`
            }
            bleed
            loading={q.isLoading}
            empty={lista.length === 0}
            emptyMessage={
              mensagens.length === 0
                ? "Nenhuma mensagem no log."
                : "Nenhuma mensagem com esse recorte. Limpe o filtro de status ou o de etapa."
            }
          >
            {/* Abaixo de 700px a tabela vira lista de cartões: as mesmas linhas, sem rolagem lateral. */}
            <ul className="divide-line divide-y min-[700px]:hidden">
              {lista.map((m) => (
                <MensagemCartao key={m.id} mensagem={m} onAbrir={abrir} />
              ))}
            </ul>
            <div className="hidden min-[700px]:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Data</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Etapa</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Resposta</TableHead>
                    <TableHead className="pr-4 text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lista.map((m) => (
                    <MensagemLinha key={m.id} mensagem={m} onAbrir={abrir} />
                  ))}
                </TableBody>
              </Table>
            </div>
          </PainelCard>
        </>
      )}

      <DialogoMensagem
        mensagem={aberta}
        aberto={aberta !== null}
        onOpenChange={(v) => !v && setAbertaId(null)}
        origemDoFoco={origemDoFoco}
      />
    </div>
  );
}

/** `73%`. Sem casa decimal: a leitura é de proporção, e o décimo aqui é ruído. */
function porcentagem(parte: number, total: number): string {
  if (total === 0) return "—";
  return `${Math.round((parte / total) * 100)}%`;
}

/**
 * O cliente, com a régua e a quantidade de títulos embaixo. O nome é o botão que abre o detalhe: a
 * linha inteira abre, mas uma `<tr>` com `onClick` não é focável, e este é o caminho do teclado e
 * do leitor de tela.
 */
function Identificacao({
  mensagem,
  onAbrir,
}: {
  mensagem: Mensagem;
  onAbrir: (m: Mensagem) => void;
}) {
  return (
    <div className="min-w-0">
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={(e) => {
          // Para aqui: o resto da linha também abre, e sem isto o clique abriria duas vezes.
          e.stopPropagation();
          onAbrir(mensagem);
        }}
        className="text-foreground min-w-0 cursor-pointer rounded-[var(--wu-radius-sm)] text-left text-[13.5px] font-medium [overflow-wrap:anywhere] hover:underline"
      >
        {mensagem.cliente}
      </button>
      <div className="text-subtle mt-0.5 text-xs">
        {mensagem.reguaNome} · {formatNumber(mensagem.titulos.length)}{" "}
        {mensagem.titulos.length === 1 ? "título" : "títulos"}
      </div>
    </div>
  );
}

/**
 * O status em pílula e, logo abaixo, o motivo: status sem motivo não é auditoria. É o que mais
 * interessa numa suprimida ou adiada, que nunca chegaram à Meta.
 */
function CelulaDeStatus({ mensagem }: { mensagem: Mensagem }) {
  return (
    <div className="flex flex-col items-start gap-1">
      <SeloStatusDisparo status={mensagem.status} />
      {mensagem.motivo && (
        <span className="text-subtle max-w-64 text-xs leading-snug">{mensagem.motivo}</span>
      )}
    </div>
  );
}

/**
 * O que o cliente fez. Escalou: a régua para aqui e quem continua é gente, e é o que a linha
 * precisa dizer. Resposta é fato do cliente e não estado da mensagem, por isso é texto, sem pílula.
 */
function CelulaDeResposta({ mensagem }: { mensagem: Mensagem }) {
  if (mensagem.resposta === "nenhuma") return <span className="text-subtle">—</span>;
  return (
    <>
      <div className="text-foreground">{RESPOSTAS[mensagem.resposta]}</div>
      {escala(mensagem.resposta) && <div className="text-subtle text-xs">vai para o analista</div>}
    </>
  );
}

/**
 * O valor dos títulos é dívida do cliente no portal, não gasto deste painel, e sai em `fg` como o
 * resto: sem o tratamento de custo, o mesmo cuidado que a carteira tem com o valor em aberto.
 */
function Valor({ mensagem }: { mensagem: Mensagem }) {
  return (
    <span className="text-foreground tabular-nums">
      {formatCurrency(valorTotal(mensagem), "BRL")}
    </span>
  );
}

interface PropsDaLinha {
  mensagem: Mensagem;
  onAbrir: (m: Mensagem) => void;
}

/** Uma mensagem no log. A linha inteira abre o detalhe, porque é o motivo de ela estar aqui. */
function MensagemLinha({ mensagem, onAbrir }: PropsDaLinha) {
  const quando = mensagem.enviadaEm ?? mensagem.montadaEm;

  return (
    // Clique que terminou uma seleção de texto é cópia, não pedido de abrir.
    <TableRow
      onClick={() => {
        if (haTextoSelecionado()) return;
        onAbrir(mensagem);
      }}
      className="cursor-pointer"
    >
      <TableCell className="text-muted-foreground pl-4 whitespace-nowrap tabular-nums">
        {formatDateTime(quando)}
      </TableCell>
      <TableCell>
        <Identificacao mensagem={mensagem} onAbrir={onAbrir} />
      </TableCell>
      <TableCell className="text-muted-foreground whitespace-nowrap">
        {mensagem.etapaNome}
      </TableCell>
      <TableCell>
        <CelulaDeStatus mensagem={mensagem} />
      </TableCell>
      <TableCell>
        <CelulaDeResposta mensagem={mensagem} />
      </TableCell>
      <TableCell className="pr-4 text-right whitespace-nowrap">
        <Valor mensagem={mensagem} />
      </TableCell>
    </TableRow>
  );
}

/** A mesma mensagem abaixo de 700px: data e status em cima, o cliente, e os fatos numa linha meta. */
function MensagemCartao({ mensagem, onAbrir }: PropsDaLinha) {
  const quando = mensagem.enviadaEm ?? mensagem.montadaEm;

  return (
    // O cartão inteiro abre, como a linha da tabela; o botão do nome continua sendo o caminho do
    // teclado.
    <li
      onClick={() => {
        if (haTextoSelecionado()) return;
        onAbrir(mensagem);
      }}
      className="flex cursor-pointer flex-col gap-1.5 px-4 py-3"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-subtle text-xs tabular-nums">{formatDateTime(quando)}</span>
        <SeloStatusDisparo status={mensagem.status} />
      </div>
      <div className="flex items-baseline justify-between gap-3">
        <Identificacao mensagem={mensagem} onAbrir={onAbrir} />
        <span className="shrink-0 text-[13.5px]">
          <Valor mensagem={mensagem} />
        </span>
      </div>
      <div className="text-subtle text-xs">{mensagem.etapaNome}</div>
      {mensagem.motivo && <div className="text-subtle text-xs leading-snug">{mensagem.motivo}</div>}
      {mensagem.resposta !== "nenhuma" && (
        <div className="text-[13px]">
          <CelulaDeResposta mensagem={mensagem} />
        </div>
      )}
    </li>
  );
}
