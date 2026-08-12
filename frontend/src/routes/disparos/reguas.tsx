import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pencil, Plus, Trash2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { AvisoDeMock } from "@/components/aviso-mock";
import { DialogoEtapa } from "@/components/dialogo-etapa";
import { DialogoRegua } from "@/components/dialogo-regua";
import { EmptyBox, ErrorBox } from "@/components/empty-states";
import { LinhaDoTempo } from "@/components/linha-do-tempo";
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
import { cn } from "@/lib/utils";

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

  if (q.error) return <ErrorBox error={q.error} />;

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
      <AvisoDeMock>
        Esta aba ainda não fala com o backend: as réguas vivem em memória e voltam ao início a cada
        recarga. Criar, mover e desligar etapa funciona na tela e não grava nada — e nada dispara,
        porque o motor que monta o lote não existe deste lado.
      </AvisoDeMock>

      {q.isLoading || !regua || !padrao ? (
        <Carregando />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="etiqueta">
              {formatNumber(reguas.length)} {reguas.length === 1 ? "régua" : "réguas"} · a padrão é{" "}
              {padrao.nome}
            </p>
            <Button size="sm" variant="outline" onClick={() => setCriandoRegua(true)}>
              <Plus className="h-4 w-4" />
              Nova régua
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {reguas.map((r) => (
              <Cartao
                key={r.id}
                regua={r}
                selecionada={r.id === regua.id}
                clientes={alcance ? (alcance[r.id] ?? 0) : null}
                aoSelecionar={() => setSelecionadaId(r.id)}
              />
            ))}
          </div>

          <LinhaDoTempo regua={regua} padrao={padrao} />

          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h2 className="text-sm font-medium">Etapas de {regua.nome}</h2>
            <Desvios regua={regua} padrao={padrao} />
            <div className="ml-auto flex flex-wrap gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={() => setEditandoRegua(regua)}
              >
                <Pencil className="h-4 w-4" />
                Renomear
              </Button>
              {!regua.padrao && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => setExcluindo(regua)}
                >
                  <Trash2 className="h-4 w-4" />
                  Excluir régua
                </Button>
              )}
              <Button size="sm" onClick={() => setEtapaAberta(etapaNova())}>
                <Plus className="h-4 w-4" />
                Nova etapa
              </Button>
            </div>
          </div>

          {regua.etapas.length === 0 ? (
            <EmptyBox message="Régua sem etapa nenhuma. Nada dispara para os clientes atribuídos a ela." />
          ) : (
            <div className="bg-card overflow-hidden rounded-xl border shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="etiqueta py-3">Etapa</TableHead>
                    <TableHead className="etiqueta py-3">Quando</TableHead>
                    <TableHead className="etiqueta py-3">Cai em</TableHead>
                    <TableHead className="etiqueta py-3">Anexo</TableHead>
                    <TableHead className="etiqueta py-3">Template</TableHead>
                    <TableHead className="w-10 pr-3" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ordenar(regua.etapas).map((etapa) => (
                    <Linha
                      key={etapa.id}
                      etapa={etapa}
                      templates={templates}
                      onAbrir={() => setEtapaAberta(etapa)}
                      onRemover={() => excluirEtapa.mutate({ reguaId: regua.id, etapa })}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <p className="text-muted-foreground text-xs">
            Mexer numa etapa vale a partir do próximo lote montado, e não passa pela Meta: o que ela
            aprova é o texto, e o texto está no template. Etapa ativa sem template aprovado é
            bloqueio de salvamento no serviço real — aqui fica como aviso, porque não há motor que
            dispare.
          </p>
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
        />
      )}

      {/* Excluir régua pede confirmação, e excluir etapa não: a etapa se recria em trinta segundos,
          a régua arrasta os clientes atribuídos a ela de volta para a padrão. */}
      <AlertDialog open={excluindo !== null} onOpenChange={(v) => !v && setExcluindo(null)}>
        <AlertDialogContent>
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

function Carregando() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
      </div>
      <Skeleton className="h-40 w-full rounded-xl" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}

/**
 * Uma régua no cartão: o nome, o motivo e o tamanho dela.
 *
 * O número de clientes é o que justifica a régua existir — régua sem cliente é régua que alguém
 * criou e nunca aplicou, e ela precisa ser visível para poder ser revogada. É também o que torna
 * "perfil de cliente" desnecessário: uma régua com muitos clientes *é* o perfil.
 */
function Cartao({
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
        "bg-card flex flex-col rounded-xl border p-4 text-left shadow-sm transition-colors",
        selecionada ? "border-foreground/25 bg-accent/40" : "hover:bg-accent/20",
      )}
    >
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-sm font-medium">{regua.nome}</span>
        {regua.padrao && <span className="etiqueta">padrão</span>}
      </div>
      <p className="text-muted-foreground mt-1.5 grow text-xs leading-relaxed">{regua.motivo}</p>
      <div className="text-muted-foreground mt-3 flex items-baseline gap-1.5 text-xs">
        <span className="leitura text-foreground text-sm">
          {clientes === null ? "—" : formatNumber(clientes)}
        </span>
        {clientes === 1 ? "cliente" : "clientes"}
        <span className="mx-1">·</span>
        <span className="leitura text-foreground text-sm">{formatNumber(ativas)}</span>
        {ativas === 1 ? "etapa ativa" : "etapas ativas"}
      </div>
    </button>
  );
}

/** Em que a régua difere da padrão, em uma linha. Na padrão não há o que comparar. */
function Desvios({ regua, padrao }: { regua: Regua; padrao: Regua }) {
  if (regua.id === padrao.id) return null;

  const { movidas, desligadas, novas } = desviosDaPadrao(regua, padrao);
  const partes = [
    movidas > 0 && `${movidas} movida${movidas > 1 ? "s" : ""}`,
    desligadas > 0 && `${desligadas} desligada${desligadas > 1 ? "s" : ""}`,
    novas > 0 && `${novas} nova${novas > 1 ? "s" : ""}`,
  ].filter(Boolean);

  return (
    <span className="text-muted-foreground text-xs">
      {partes.length > 0
        ? `${partes.join(" · ")} em relação à padrão`
        : "igual à padrão — esta régua ainda não muda nada"}
    </span>
  );
}

/** Uma etapa da régua. A linha inteira abre o editor, porque é o motivo de ela estar aqui. */
function Linha({
  etapa,
  templates,
  onAbrir,
  onRemover,
}: {
  etapa: Etapa;
  templates: Template[];
  onAbrir: () => void;
  onRemover: () => void;
}) {
  const semDisparo = motivoSemDisparo(etapa, templates);
  const template = templates.find((t) => t.nome === etapa.template);

  return (
    <TableRow onClick={onAbrir} className="cursor-pointer">
      <TableCell className="py-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="leitura bg-secondary text-secondary-foreground rounded-sm px-1.5 py-0.5 text-xs">
            {rotuloDe(etapa)}
          </span>
          <span className={cn("text-sm font-medium", !etapa.ativa && "text-muted-foreground")}>
            {etapa.nome}
          </span>
          {!etapa.ativa && <span className="text-muted-foreground text-xs">desligada</span>}
          {etapa.etapaFinal && <span className="text-muted-foreground text-xs">· final</span>}
        </div>
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
      <TableCell className="text-xs">
        {etapa.template ? (
          <span className="flex flex-wrap items-baseline gap-1.5">
            <span className="font-mono">{etapa.template}</span>
            {template && <span className="leitura text-muted-foreground">v{template.versao}</span>}
          </span>
        ) : (
          <span className="text-muted-foreground">nenhum</span>
        )}
        {semDisparo && (
          <div className="text-destructive mt-1 flex items-center gap-1.5">
            <TriangleAlert className="h-3 w-3 shrink-0" aria-hidden />
            não dispara · {semDisparo}
          </div>
        )}
      </TableCell>
      <TableCell className="pr-3">
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-destructive h-7 w-7"
          onClick={(e) => {
            e.stopPropagation();
            onRemover();
          }}
          aria-label={`Remover etapa ${etapa.nome}`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
}
