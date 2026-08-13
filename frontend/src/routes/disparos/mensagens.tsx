import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { AvisoDeMock } from "@/components/aviso-mock";
import { Cartao } from "@/components/cartao";
import { DialogoMensagem } from "@/components/dialogo-mensagem";
import { EmptyBox, ErrorBox } from "@/components/empty-states";
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
import { formatCurrency, formatDateOnly, formatDateTime, formatNumber } from "@/lib/format";
import {
  escala,
  saiu,
  valorTotal,
  COR_STATUS,
  RESPOSTAS,
  STATUS,
  type Mensagem,
  type Status,
} from "@/lib/mensagens-disparo";
import { listarMensagens, PERIODO_DO_LOG } from "@/lib/mensagens-disparo-mock";
import { listarReguas } from "@/lib/reguas-mock";
import { ordenar, raizDe, reguaPadrao, rotuloDe } from "@/lib/reguas";
import { cn } from "@/lib/utils";

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
 * O log da régua — a terceira aba de Disparos, e a única das três que **lê** em vez de cadastrar.
 *
 * Vem depois das outras duas na barra porque é a consequência delas: a régua diz o ritmo, a carteira
 * diz quem segue esse ritmo, e esta tela mostra o que as duas juntas produziram. É também onde se
 * descobre que uma das duas está errada — uma régua com muita `suprimida` é uma régua disparando
 * para quem o portal já tirou da fila.
 *
 * Não é a lista de `/whatsapp/mensagens` com outro título, e a diferença é a razão de a aba existir:
 * lá a linha é o que a Meta cobrou, e existe porque houve `wamid`. Aqui a linha é o que a régua
 * **decidiu**, inclusive quando decidiu não mandar. Suprimida e adiada nunca chegaram à Meta, não
 * custam nada e não aparecem em canto nenhum do painel de WhatsApp — e são as duas linhas que
 * provam que o bloqueio da carteira funcionou.
 *
 * Sem `<GlobalFilters>`, e por um motivo diferente do das outras três abas de cadastro: aqui período
 * até faria sentido — log é leitura de período. O que não faria sentido é o controle: o mock tem uma
 * janela fixa de duas semanas e ignoraria as datas escolhidas, e um filtro que parece filtrar e não
 * filtra é pior que filtro nenhum (o mesmo argumento de `filtersToParams`). O recorte que a tela
 * oferece é o que ela sabe honrar — status e etapa, que é como se lê um log de régua de qualquer
 * forma: não "o que saiu em março", e sim "o que não saiu, e de qual etapa".
 */
function MensagensDisparo() {
  const [filtroStatus, setFiltroStatus] = useState<Status | typeof TODOS>(TODOS);
  const [filtroEtapa, setFiltroEtapa] = useState<string>(TODOS);
  const [abertaId, setAbertaId] = useState<string | null>(null);

  const q = useQuery({ queryKey: CHAVE, queryFn: listarMensagens });
  const qReguas = useQuery({ queryKey: CHAVE_REGUAS, queryFn: listarReguas });

  const mensagens = useMemo(() => q.data ?? [], [q.data]);
  const reguas = useMemo(() => qReguas.data ?? [], [qReguas.data]);

  /**
   * O filtro por etapa é pela etapa da **padrão**, e junta as correspondentes das outras réguas.
   *
   * "Preventivo" existe nas três, com deslocamento diferente em cada uma — é a mesma decisão, e é
   * dela que se quer o recorte. Um botão por etapa de cada régua daria nove controles para três
   * perguntas, e o `origemId` está lá justamente para isso (`raizDe`).
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

  if (q.error) return <ErrorBox error={q.error} />;

  const sairam = mensagens.filter(saiu);
  const lidas = mensagens.filter((m) => m.status === "lida");
  const escalaram = mensagens.filter((m) => escala(m.resposta));
  const naoSairam = mensagens.filter((m) => !saiu(m));

  return (
    <div className="flex flex-col gap-4">

      {q.isLoading ? (
        <Carregando />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Cartao
              rotulo="Saíram"
              valor={formatNumber(sairam.length)}
              nota={`de ${formatNumber(mensagens.length)} montadas`}
            />
            <Cartao
              rotulo="Lidas"
              valor={porcentagem(lidas.length, sairam.length)}
              nota={`${formatNumber(lidas.length)} das que saíram`}
            />
            <Cartao
              rotulo="Escalaram"
              valor={formatNumber(escalaram.length)}
              nota="comprovante, contestação ou pedido de saída"
            />
            <Cartao
              rotulo="Não saíram"
              valor={formatNumber(naoSairam.length)}
              nota="suprimidas ou adiadas"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <Chip ativo={filtroStatus === TODOS} onClick={() => setFiltroStatus(TODOS)}>
              Todos
            </Chip>
            {(Object.keys(STATUS) as Status[]).map((s) => (
              <Chip key={s} ativo={filtroStatus === s} onClick={() => setFiltroStatus(s)}>
                <span className={COR_STATUS[s]}>{STATUS[s]}</span>
                <span className="text-muted-foreground">
                  {formatNumber(mensagens.filter((m) => m.status === s).length)}
                </span>
              </Chip>
            ))}

            {etapasDaPadrao.length > 0 && (
              <>
                <span className="bg-border mx-1.5 h-5 w-px" aria-hidden />
                <Chip ativo={filtroEtapa === TODOS} onClick={() => setFiltroEtapa(TODOS)}>
                  Todas as etapas
                </Chip>
                {etapasDaPadrao.map((e) => (
                  <Chip
                    key={e.id}
                    ativo={filtroEtapa === e.id}
                    onClick={() => setFiltroEtapa(e.id)}
                  >
                    <span className="leitura text-xs">{rotuloDe(e)}</span>
                    {e.nome}
                  </Chip>
                ))}
              </>
            )}
          </div>

          {lista.length === 0 ? (
            <EmptyBox message="Nenhuma mensagem com esse recorte. Limpe o filtro de status ou o de etapa." />
          ) : (
            <div className="bg-card overflow-hidden rounded-xl border shadow-sm">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="etiqueta py-3">Data</TableHead>
                      <TableHead className="etiqueta py-3">Cliente</TableHead>
                      <TableHead className="etiqueta py-3">Etapa</TableHead>
                      <TableHead className="etiqueta py-3">Status</TableHead>
                      <TableHead className="etiqueta py-3">Resposta</TableHead>
                      <TableHead className="etiqueta py-3 text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lista.map((m) => (
                      <Linha key={m.id} mensagem={m} onAbrir={() => setAbertaId(m.id)} />
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          <p className="text-muted-foreground text-xs">
            {formatNumber(lista.length)} de {formatNumber(mensagens.length)}{" "}
            {mensagens.length === 1 ? "mensagem" : "mensagens"}, de{" "}
            {formatDateOnly(PERIODO_DO_LOG.de)} a {formatDateOnly(PERIODO_DO_LOG.ate)}. No serviço
            real esta tela se divide em duas tabelas: o que a Meta diz que aconteceu, dedup por{" "}
            <code>wamid</code>, e o envio que a régua decidiu — ligadas por ele. O que não saiu só
            existe na segunda, e é por isso que este log não é o de <code>/whatsapp/mensagens</code>
            .
          </p>
        </>
      )}

      <DialogoMensagem
        mensagem={aberta}
        aberto={aberta !== null}
        onOpenChange={(v) => !v && setAbertaId(null)}
      />
    </div>
  );
}

function Carregando() {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
      <Skeleton className="h-8 w-full rounded-sm" />
      <Skeleton className="h-96 w-full rounded-xl" />
    </div>
  );
}

/** `73%`. Sem casa decimal: a leitura é de proporção, e o décimo aqui é ruído. */
function porcentagem(parte: number, total: number): string {
  if (total === 0) return "—";
  return `${Math.round((parte / total) * 100)}%`;
}

/**
 * Uma mensagem no log. A linha inteira abre o detalhe, porque é o motivo de ela estar aqui.
 *
 * O status é texto e só texto, na cor da rampa de `COR_STATUS`. Selo seria o desenho errado: numa
 * lista longa, uma pastilha em toda linha vira faixa, e o que se procura aqui é a exceção — a
 * suprimida e a que falhou. O motivo entra logo abaixo, porque status sem motivo não é auditoria.
 *
 * O valor sai em mono e **sem** o violeta de custo: é dívida do cliente no portal, não gasto deste
 * painel, o mesmo cuidado que a carteira tem com o valor em aberto.
 */
function Linha({ mensagem, onAbrir }: { mensagem: Mensagem; onAbrir: () => void }) {
  const quando = mensagem.enviadaEm ?? mensagem.montadaEm;

  return (
    <TableRow onClick={onAbrir} className="cursor-pointer">
      <TableCell className="leitura py-3 text-xs whitespace-nowrap">
        {formatDateTime(quando)}
      </TableCell>
      <TableCell className="py-3">
        <div className="text-sm font-medium">{mensagem.cliente}</div>
        <div className="text-muted-foreground mt-0.5 text-xs">
          {mensagem.reguaNome} · {formatNumber(mensagem.titulos.length)}{" "}
          {mensagem.titulos.length === 1 ? "título" : "títulos"}
        </div>
      </TableCell>
      <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
        {mensagem.etapaNome}
      </TableCell>
      <TableCell className="py-3">
        <div className={cn("text-sm", COR_STATUS[mensagem.status])}>{STATUS[mensagem.status]}</div>
        {mensagem.motivo && (
          <div className="text-muted-foreground mt-0.5 max-w-64 text-xs leading-snug">
            {mensagem.motivo}
          </div>
        )}
      </TableCell>
      <TableCell className="text-xs">
        {mensagem.resposta === "nenhuma" ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <>
            <div>{RESPOSTAS[mensagem.resposta]}</div>
            {/* Escalou: a régua para aqui e quem continua é gente. É o que a linha precisa dizer. */}
            {escala(mensagem.resposta) && (
              <div className="text-muted-foreground mt-0.5">vai para o analista</div>
            )}
          </>
        )}
      </TableCell>
      <TableCell className="leitura text-right text-sm whitespace-nowrap">
        {formatCurrency(valorTotal(mensagem), "BRL")}
      </TableCell>
    </TableRow>
  );
}

/** Botão de recorte. Igual ao dos outros filtros de uma tela só: baixo, discreto, e marcado. */
function Chip({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      aria-pressed={ativo}
      className={cn("h-7 gap-1.5 text-xs font-normal", ativo && "border-foreground/30 bg-accent")}
    >
      {children}
    </Button>
  );
}
