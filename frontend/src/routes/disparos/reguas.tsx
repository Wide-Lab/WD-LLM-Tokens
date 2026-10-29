import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Pencil, Plus, Trash2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { CabecalhoDaPagina } from "@/components/cabecalho-da-pagina";
import { DialogoEtapa } from "@/components/dialogo-etapa";
import { DialogoRegua } from "@/components/dialogo-regua";
import { ErrorBox } from "@/components/empty-states";
import { LinhaDoTempo } from "@/components/linha-do-tempo";
import { PainelCard } from "@/components/painel-card";
import { QuandoCai } from "@/components/quando-cai";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { clientesPorRegua } from "@/lib/clientes";
import { listarCarteira } from "@/lib/clientes-mock";
import { formatNumber } from "@/lib/format";
import {
  desviosDaPadrao,
  motivoSemDisparo,
  ordenar,
  reguaPadrao,
  rotuloDe,
  ANCORAS,
  ANEXOS,
  CONTAGENS,
  type Etapa,
  type Regua,
} from "@/lib/reguas";
import { etapaNova, listarReguas, removerEtapa, removerRegua } from "@/lib/reguas-mock";
import type { Template } from "@/lib/templates";
import { listarTemplates } from "@/lib/templates-mock";
import { cn, devolverFocoA, haTextoSelecionado } from "@/lib/utils";

export const Route = createFileRoute("/disparos/reguas")({
  head: () => ({
    meta: [
      { title: "Réguas — Painel de custos" },
      {
        name: "description",
        content: "Réguas de cobrança: as etapas de cada uma, quando disparam e com que template.",
      },
      { property: "og:title", content: "Réguas — Painel de custos" },
      {
        property: "og:description",
        content: "O ritmo do disparo, e em que cada régua difere da padrão.",
      },
    ],
  }),
  component: Reguas,
});

const CHAVE = ["reguas-disparos"];
/** A mesma chave da carteira: as duas abas leem a mesma lista, e uma escrita derruba as duas. */
const CHAVE_CARTEIRA = ["carteira-disparos"];
/** E a mesma do catálogo de `/whatsapp/templates`: a etapa aponta para ele, não o copia. */
const CHAVE_TEMPLATES = ["templates-whatsapp"];

/**
 * As réguas de cobrança — a segunda aba de Disparos, e a que decide **quando** a mensagem sai.
 *
 * Disparos tem duas metades. A régua diz o ritmo; a carteira diz quem segue esse ritmo. Nenhuma das
 * duas é origem de custo, e as duas mexem no gasto de amanhã pelo lado do **volume** — trocar um
 * `D+9` por um `D+2` não muda o preço de mensagem nenhuma e muda quantas mensagens existem, do mesmo
 * jeito que ligar uma etapa desligada muda.
 *
 * A tela toda gira em torno de uma decisão: **a unidade de substituição é a régua, não o campo.**
 * Por isso não há override por cliente, personalizar é atribuir outra régua, e uma régua nasce como
 * cópia da padrão guardando de onde cada etapa veio. É esse `origemId` que faz a linha do tempo
 * conseguir dizer *em que* a régua difere, em vez de mostrar duas listas soltas lado a lado.
 *
 * Sem `<GlobalFilters>`, pelo mesmo motivo de `/precos`, `/whatsapp/templates` e `/disparos/clientes`:
 * régua é cadastro, não leitura de período. Recortar por data não responderia nada aqui.
 */
function Reguas() {
  const queryClient = useQueryClient();
  const [selecionadaId, setSelecionadaId] = useState<string | null>(null);
  const [etapaAberta, setEtapaAberta] = useState<Etapa | null>(null);
  const [editandoRegua, setEditandoRegua] = useState<Regua | null>(null);
  const [criandoRegua, setCriandoRegua] = useState(false);
  const [excluindo, setExcluindo] = useState<Regua | null>(null);

  // Quem abriu o diálogo — a linha, o botão "Nova etapa" —, para o foco voltar a ele ao fechar. Os
  // diálogos não têm `DialogTrigger`, e sem isto o foco cairia no `<body>`.
  const origemDoFoco = useRef<HTMLElement | null>(null);
  const guardarOrigem = () => {
    origemDoFoco.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
  };
  const abrirEtapa = (etapa: Etapa) => {
    guardarOrigem();
    setEtapaAberta(etapa);
  };

  const q = useQuery({ queryKey: CHAVE, queryFn: listarReguas });
  const qCarteira = useQuery({ queryKey: CHAVE_CARTEIRA, queryFn: listarCarteira });
  const qTemplates = useQuery({ queryKey: CHAVE_TEMPLATES, queryFn: listarTemplates });

  const derrubarLeituras = () => {
    for (const chave of [CHAVE, CHAVE_CARTEIRA]) {
      void queryClient.invalidateQueries({ queryKey: chave });
    }
  };

  const excluirRegua = useMutation({
    mutationFn: (regua: Regua) => removerRegua(regua.id),
    onSuccess: (_, regua) => {
      derrubarLeituras();
      setSelecionadaId(null);
      setExcluindo(null);
      toast(`Régua "${regua.nome}" excluída`, {
        description: "Os clientes dela voltaram para a padrão.",
      });
    },
  });

  const excluirEtapa = useMutation({
    mutationFn: (v: { reguaId: string; etapa: Etapa }) => removerEtapa(v.reguaId, v.etapa.id),
    onSuccess: (_, v) => {
      derrubarLeituras();
      toast(`Etapa "${v.etapa.nome}" removida`);
    },
  });

  const reguas = q.data ?? [];
  const templates = qTemplates.data ?? [];
  const padrao = reguas.length > 0 ? reguaPadrao(reguas) : null;
  // A seleção vive por id e não por objeto: depois de salvar uma etapa, o objeto guardado no clique
  // é a versão anterior, e a tela seguiria desenhando a régua de antes da escrita.
  const regua = reguas.find((r) => r.id === selecionadaId) ?? padrao;

  const alcance =
    qCarteira.data && reguas.length > 0
      ? clientesPorRegua(qCarteira.data.clientes, qCarteira.data.vinculos, reguas)
      : null;

  return (
    <div className="flex flex-col gap-4">
      <CabecalhoDaPagina
        titulo="Réguas"
        subtitulo={
          padrao
            ? `${formatNumber(reguas.length)} ${reguas.length === 1 ? "régua" : "réguas"} · a padrão é ${padrao.nome}`
            : "O ritmo do disparo, e em que cada régua difere da padrão"
        }
        acoes={
          <Button
            disabled={!padrao}
            onClick={() => {
              guardarOrigem();
              setCriandoRegua(true);
            }}
          >
            <Plus />
            Nova régua
          </Button>
        }
      />

      {q.error ? (
        <ErrorBox error={q.error} onRetry={() => void q.refetch()} />
      ) : q.isLoading || !regua || !padrao ? (
        <Carregando />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {reguas.map((r) => (
              <CartaoDeRegua
                key={r.id}
                regua={r}
                selecionada={r.id === regua.id}
                clientes={alcance ? (alcance[r.id] ?? 0) : null}
                aoSelecionar={() => setSelecionadaId(r.id)}
              />
            ))}
          </div>

          <LinhaDoTempo regua={regua} padrao={padrao} />

          <PainelCard
            title={`Etapas de ${regua.nome}`}
            hint={textoDosDesvios(regua, padrao)}
            action={
              <div className="flex flex-wrap items-center justify-end gap-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={() => {
                    guardarOrigem();
                    setEditandoRegua(regua);
                  }}
                >
                  <Pencil />
                  Renomear
                </Button>
                {!regua.padrao && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-danger"
                    onClick={() => {
                      guardarOrigem();
                      setExcluindo(regua);
                    }}
                  >
                    <Trash2 />
                    Excluir régua
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => abrirEtapa(etapaNova())}>
                  <Plus />
                  Nova etapa
                </Button>
              </div>
            }
            bleed
            empty={regua.etapas.length === 0}
            emptyMessage="Régua sem etapa nenhuma. Nada dispara para os clientes atribuídos a ela."
          >
            {/* Abaixo de 700px a tabela vira lista de cartões: os mesmos fatos, sem rolagem lateral. */}
            <ul className="divide-line divide-y min-[700px]:hidden">
              {ordenar(regua.etapas).map((etapa) => (
                <EtapaCartao
                  key={etapa.id}
                  etapa={etapa}
                  templates={templates}
                  onAbrir={abrirEtapa}
                  onRemover={() => excluirEtapa.mutate({ reguaId: regua.id, etapa })}
                />
              ))}
            </ul>
            <div className="hidden min-[700px]:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Etapa</TableHead>
                    <TableHead>Quando</TableHead>
                    <TableHead>Cai em</TableHead>
                    <TableHead>Anexo</TableHead>
                    <TableHead>Template</TableHead>
                    <TableHead className="w-12 pr-4">
                      <span className="sr-only">Remover</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ordenar(regua.etapas).map((etapa) => (
                    <EtapaLinha
                      key={etapa.id}
                      etapa={etapa}
                      templates={templates}
                      onAbrir={abrirEtapa}
                      onRemover={() => excluirEtapa.mutate({ reguaId: regua.id, etapa })}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          </PainelCard>
        </>
      )}

      <DialogoRegua
        regua={criandoRegua ? null : editandoRegua}
        aberto={criandoRegua || editandoRegua !== null}
        onOpenChange={(v) => {
          if (v) return;
          setCriandoRegua(false);
          setEditandoRegua(null);
        }}
        aoCriar={(nova) => setSelecionadaId(nova.id)}
        origemDoFoco={origemDoFoco}
      />

      {regua && (
        <DialogoEtapa
          // Remontar a cada etapa: o diálogo guarda rascunho, e reaproveitá-lo entre duas etapas
          // abriria a segunda com o que se digitou na primeira.
          key={etapaAberta?.id ?? "nenhuma"}
          reguaId={regua.id}
          etapa={etapaAberta}
          templates={templates}
          aberto={etapaAberta !== null}
          onOpenChange={(v) => !v && setEtapaAberta(null)}
          origemDoFoco={origemDoFoco}
        />
      )}

      {/* Excluir régua pede confirmação, e excluir etapa não: a etapa se recria em trinta segundos,
          a régua arrasta os clientes atribuídos a ela de volta para a padrão. */}
      <AlertDialog open={excluindo !== null} onOpenChange={(v) => !v && setExcluindo(null)}>
        <AlertDialogContent onCloseAutoFocus={devolverFocoA(origemDoFoco)}>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {excluindo?.nome}?</AlertDialogTitle>
            <AlertDialogDescription>
              {alcance && excluindo
                ? `${formatNumber(alcance[excluindo.id] ?? 0)} cliente(s) seguem esta régua hoje e passam a seguir a padrão. As etapas dela somem junto.`
                : "Os clientes desta régua passam a seguir a padrão. As etapas dela somem junto."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => excluindo && excluirRegua.mutate(excluindo)}
              disabled={excluirRegua.isPending}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** A forma da tela enquanto as réguas não chegam: os cartões, a linha do tempo e a lista. */
function Carregando() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

/**
 * Uma régua no cartão: o nome, o motivo e o tamanho dela.
 *
 * O número de clientes é o que justifica a régua existir — régua sem cliente é régua que alguém
 * criou e nunca aplicou, e ela precisa ser visível para poder ser revogada. É também o que torna
 * "perfil de cliente" desnecessário: uma régua com muitos clientes *é* o perfil. A seleção é só
 * fundo e borda: o accent marca lugar e ação, e não há ação nenhuma na escolha da régua que se vê.
 */
function CartaoDeRegua({
  regua,
  selecionada,
  clientes,
  aoSelecionar,
}: {
  regua: Regua;
  selecionada: boolean;
  /** `null` enquanto a carteira não chegou: zero clientes é uma afirmação, e ainda não se sabe. */
  clientes: number | null;
  aoSelecionar: () => void;
}) {
  const ativas = regua.etapas.filter((e) => e.ativa).length;

  return (
    <button
      type="button"
      onClick={aoSelecionar}
      aria-pressed={selecionada}
      className={cn(
        "bg-card shadow-card flex min-w-0 cursor-pointer flex-col rounded-[var(--wu-radius)] border p-4 text-left transition-colors",
        selecionada ? "border-line-strong bg-sel" : "border-line hover:bg-hover",
      )}
    >
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-foreground text-sm font-semibold [overflow-wrap:anywhere]">
          {regua.nome}
        </span>
        {regua.padrao && <span className="text-subtle text-xs">padrão</span>}
      </div>
      <p className="text-muted-foreground mt-1.5 grow text-[13px]">{regua.motivo}</p>
      <div className="text-subtle mt-3 flex flex-wrap items-baseline gap-x-1.5 text-xs">
        <span className="text-foreground text-sm font-semibold tabular-nums">
          {clientes === null ? "—" : formatNumber(clientes)}
        </span>
        {clientes === 1 ? "cliente" : "clientes"}
        <span aria-hidden>·</span>
        <span className="text-foreground text-sm font-semibold tabular-nums">
          {formatNumber(ativas)}
        </span>
        {ativas === 1 ? "etapa ativa" : "etapas ativas"}
      </div>
    </button>
  );
}

/** Em que a régua difere da padrão, em uma linha. Na padrão não há o que comparar. */
function textoDosDesvios(regua: Regua, padrao: Regua): string | undefined {
  if (regua.id === padrao.id) return undefined;

  const { movidas, desligadas, novas } = desviosDaPadrao(regua, padrao);
  const partes = [
    movidas > 0 && `${movidas} movida${movidas > 1 ? "s" : ""}`,
    desligadas > 0 && `${desligadas} desligada${desligadas > 1 ? "s" : ""}`,
    novas > 0 && `${novas} nova${novas > 1 ? "s" : ""}`,
  ].filter(Boolean);

  return partes.length > 0
    ? `${partes.join(" · ")} em relação à padrão`
    : "igual à padrão — esta régua ainda não muda nada";
}

/**
 * O que identifica a etapa numa linha: o rótulo (`D-3`), o nome e o estado dela.
 *
 * O nome é o botão que abre o editor: a linha inteira abre, mas uma `<tr>` com `onClick` não é
 * focável, e este é o caminho do teclado e do leitor de tela. Etapa desligada fica em
 * `muted-foreground` e diz "desligada" em texto — a cor só reforça.
 */
function Identificacao({ etapa, onAbrir }: { etapa: Etapa; onAbrir: (e: Etapa) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
      <span className="bg-sel text-foreground rounded-[var(--wu-radius-sm)] px-1.5 py-0.5 text-xs font-medium tabular-nums">
        {rotuloDe(etapa)}
      </span>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={(e) => {
          // Para aqui: o resto da linha também abre, e sem isto o clique abriria duas vezes.
          e.stopPropagation();
          onAbrir(etapa);
        }}
        className={cn(
          "min-w-0 cursor-pointer rounded-[var(--wu-radius-sm)] text-left text-[13.5px] font-medium hover:underline",
          etapa.ativa ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {etapa.nome}
      </button>
      {!etapa.ativa && <span className="text-subtle text-xs">desligada</span>}
      {etapa.etapaFinal && <span className="text-subtle text-xs">· final</span>}
    </div>
  );
}

/** O template da etapa — o `name` da Meta, único texto em mono — e o aviso de que ela não dispara. */
function CelulaDeTemplate({ etapa, templates }: { etapa: Etapa; templates: Template[] }) {
  const semDisparo = motivoSemDisparo(etapa, templates);
  const template = templates.find((t) => t.nome === etapa.template);

  return (
    <>
      {etapa.template ? (
        <span className="flex flex-wrap items-baseline gap-x-1.5">
          <span className="text-foreground font-mono text-xs">{etapa.template}</span>
          {template && <span className="text-subtle text-xs">v{template.versao}</span>}
        </span>
      ) : (
        <span className="text-subtle text-xs">nenhum</span>
      )}
      {semDisparo && (
        <p className="text-danger mt-1 flex items-start gap-1.5 text-xs">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          não dispara · {semDisparo}
        </p>
      )}
    </>
  );
}

function BotaoRemover({ etapa, onRemover }: { etapa: Etapa; onRemover: () => void }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="text-subtle hover:text-danger h-8 w-8"
      onClick={(e) => {
        e.stopPropagation();
        onRemover();
      }}
      aria-label={`Remover etapa ${etapa.nome}`}
      title="Remover etapa"
    >
      <Trash2 />
    </Button>
  );
}

/** Uma etapa da régua. A linha inteira abre o editor, porque é o motivo de ela estar aqui. */
function EtapaLinha({
  etapa,
  templates,
  onAbrir,
  onRemover,
}: {
  etapa: Etapa;
  templates: Template[];
  onAbrir: (e: Etapa) => void;
  onRemover: () => void;
}) {
  return (
    // Clique que terminou uma seleção de texto é cópia, não pedido de abrir.
    <TableRow
      onClick={() => {
        if (haTextoSelecionado()) return;
        onAbrir(etapa);
      }}
      className="cursor-pointer"
    >
      <TableCell className="pl-4">
        <Identificacao etapa={etapa} onAbrir={onAbrir} />
      </TableCell>
      <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
        {ANCORAS[etapa.ancora].toLowerCase()}, {CONTAGENS[etapa.contagem]}
      </TableCell>
      <TableCell>
        <QuandoCai etapa={etapa} />
      </TableCell>
      <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
        {ANEXOS[etapa.anexo]}
      </TableCell>
      <TableCell>
        <CelulaDeTemplate etapa={etapa} templates={templates} />
      </TableCell>
      <TableCell className="pr-4">
        <BotaoRemover etapa={etapa} onRemover={onRemover} />
      </TableCell>
    </TableRow>
  );
}

/** A mesma etapa abaixo de 700px: identificação e remover em cima, os fatos em linhas. */
function EtapaCartao({
  etapa,
  templates,
  onAbrir,
  onRemover,
}: {
  etapa: Etapa;
  templates: Template[];
  onAbrir: (e: Etapa) => void;
  onRemover: () => void;
}) {
  return (
    // O cartão inteiro abre, como a linha da tabela; o botão do nome continua sendo o caminho do
    // teclado.
    <li
      onClick={() => {
        if (haTextoSelecionado()) return;
        onAbrir(etapa);
      }}
      className="flex cursor-pointer flex-col gap-2 px-4 py-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Identificacao etapa={etapa} onAbrir={onAbrir} />
        </div>
        <BotaoRemover etapa={etapa} onRemover={onRemover} />
      </div>
      <div className="text-muted-foreground text-xs">
        {ANCORAS[etapa.ancora].toLowerCase()}, {CONTAGENS[etapa.contagem]} · {ANEXOS[etapa.anexo]}
      </div>
      <QuandoCai etapa={etapa} />
      <div>
        <CelulaDeTemplate etapa={etapa} templates={templates} />
      </div>
    </li>
  );
}
