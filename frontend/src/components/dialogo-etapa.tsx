import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type RefObject } from "react";
import { Loader2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { QuandoCai } from "@/components/quando-cai";
import { SeloEstadoMeta } from "@/components/selo-estado-meta";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { motivoSemDisparo, ANCORAS, ANEXOS, CONTAGENS, type Etapa } from "@/lib/reguas";
import { salvarEtapa } from "@/lib/reguas-mock";
import type { Template } from "@/lib/templates";
import { devolverFocoA } from "@/lib/utils";

/** As duas leituras que a escrita derruba: a lista de réguas e a carteira, que aponta para elas. */
const CHAVES = [["reguas-disparos"], ["carteira-disparos"]];

/** O valor do `Select` que representa "nenhum template". Radix não aceita item de valor "". */
const SEM_TEMPLATE = "__nenhum__";

/**
 * O editor de etapa: âncora, deslocamento, contagem, anexo e o template que sai.
 *
 * É a tela em que mexer muda o disparo de amanhã sem deploy e **sem passar de novo pela Meta** — e
 * essa é a divisão que o diálogo inteiro existe para deixar clara. Ritmo é nosso e é barato; texto
 * é da Meta e é caro, por isso o template aparece aqui como escolha de catálogo e não como campo de
 * texto: quem quiser mudar o que está escrito muda em `/whatsapp/templates`, onde a mudança gera
 * versão e espera aprovação.
 *
 * O bloco "cai em" está no meio do formulário, e não no fim, porque é a única confirmação de que a
 * combinação escolhida faz o que a pessoa quis: três selects e um número não dizem, sozinhos, que o
 * preventivo vai cair numa segunda-feira útil.
 */
export function DialogoEtapa({
  reguaId,
  etapa,
  templates,
  aberto,
  onOpenChange,
  origemDoFoco,
}: {
  reguaId: string;
  /** `null` fecha o diálogo. A tela mantém um só montado e troca a etapa dele. */
  etapa: Etapa | null;
  templates: Template[];
  aberto: boolean;
  onOpenChange: (v: boolean) => void;
  /** Quem abriu o diálogo, para o foco voltar a ele ao fechar. */
  origemDoFoco?: RefObject<HTMLElement | null>;
}) {
  const queryClient = useQueryClient();
  const [rascunho, setRascunho] = useState<Etapa | null>(null);
  // O deslocamento tem estado de texto próprio: um campo numérico controlado por número não deixa
  // apagar o conteúdo para digitar outro, e "−" sozinho não é número nenhum enquanto se escreve.
  const [deslocamento, setDeslocamento] = useState("0");

  useEffect(() => {
    if (!aberto || !etapa) return;
    setRascunho(etapa);
    setDeslocamento(String(etapa.deslocamento));
  }, [aberto, etapa]);

  const salvar = useMutation({
    mutationFn: (e: Etapa) => salvarEtapa(reguaId, e),
    onSuccess: (_, e) => {
      for (const chave of CHAVES) void queryClient.invalidateQueries({ queryKey: chave });
      toast.success(`Etapa "${e.nome}" salva`, {
        description: "Vale a partir do próximo lote montado.",
      });
      onOpenChange(false);
    },
  });

  if (!rascunho) return null;

  const mudar = <K extends keyof Etapa>(campo: K, valor: Etapa[K]) =>
    setRascunho({ ...rascunho, [campo]: valor });

  const escolhido = templates.find((t) => t.nome === rascunho.template);
  const semDisparo = motivoSemDisparo(rascunho, templates);

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-lg"
        onCloseAutoFocus={devolverFocoA(origemDoFoco)}
      >
        <DialogHeader>
          <DialogTitle className="[overflow-wrap:anywhere]">{rascunho.nome}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="etapa-nome">Nome</Label>
            <Input
              id="etapa-nome"
              value={rascunho.nome}
              onChange={(e) => mudar("nome", e.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="etapa-ancora">Âncora</Label>
              <Select
                value={rascunho.ancora}
                onValueChange={(v) => mudar("ancora", v as Etapa["ancora"])}
              >
                <SelectTrigger id="etapa-ancora" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ANCORAS).map(([chave, rotulo]) => (
                    <SelectItem key={chave} value={chave}>
                      {rotulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="etapa-deslocamento">Dias</Label>
              <Input
                id="etapa-deslocamento"
                type="number"
                className="tabular-nums"
                value={deslocamento}
                onChange={(e) => {
                  const texto = e.target.value;
                  setDeslocamento(texto);
                  const numero = Number(texto);
                  if (texto.trim() !== "" && !Number.isNaN(numero)) mudar("deslocamento", numero);
                }}
                onBlur={() => setDeslocamento(String(rascunho.deslocamento))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="etapa-contagem">Contagem</Label>
              <Select
                value={rascunho.contagem}
                onValueChange={(v) => mudar("contagem", v as Etapa["contagem"])}
              >
                <SelectTrigger id="etapa-contagem" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CONTAGENS).map(([chave, rotulo]) => (
                    <SelectItem key={chave} value={chave}>
                      {rotulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="bg-raised rounded-[var(--wu-radius)] px-4 py-3">
            <div className="text-subtle text-[12.5px]">Cai em</div>
            <div className="mt-1.5">
              <QuandoCai etapa={rascunho} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="etapa-template">Template</Label>
              <Select
                value={rascunho.template ?? SEM_TEMPLATE}
                onValueChange={(v) => mudar("template", v === SEM_TEMPLATE ? null : v)}
              >
                <SelectTrigger id="etapa-template" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SEM_TEMPLATE}>Nenhum</SelectItem>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.nome}>
                      <span className="font-mono">{t.nome}</span>
                      {t.aprovadoEmProducao ? "" : " · sem aprovação"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {escolhido && (
                <div className="flex flex-wrap items-center gap-2">
                  <SeloEstadoMeta estado={escolhido.estado} />
                  <span className="text-subtle text-xs">
                    {escolhido.rascunho !== null && escolhido.aprovadoEmProducao
                      ? `sai a v${escolhido.versao}; há rascunho pendente`
                      : `sai a v${escolhido.versao}`}
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="etapa-anexo">Anexo</Label>
              <Select
                value={rascunho.anexo}
                onValueChange={(v) => mudar("anexo", v as Etapa["anexo"])}
              >
                <SelectTrigger id="etapa-anexo" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ANEXOS).map(([chave, rotulo]) => (
                    <SelectItem key={chave} value={chave}>
                      {rotulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {semDisparo && (
            <div className="bg-danger-bg flex gap-2.5 rounded-[var(--wu-radius)] px-3 py-2">
              <TriangleAlert className="text-danger mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <div className="text-foreground text-[12.5px]">
                <p className="font-medium">Não dispara</p>
                <p className="mt-0.5">
                  Etapa ativa {semDisparo}: título que chegar nela não tem o que enviar. No serviço
                  real isto bloqueia o salvamento.
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-4 border-line rounded-[var(--wu-radius)] border px-4 py-3">
            <div>
              <div className="text-foreground text-[13.5px] font-medium">Ativa</div>
            </div>
            <Switch
              checked={rascunho.ativa}
              onCheckedChange={(v) => mudar("ativa", v)}
              aria-label="Ativa"
            />
          </div>

          <div className="flex items-center justify-between gap-4 border-line rounded-[var(--wu-radius)] border px-4 py-3">
            <div>
              <div className="text-foreground text-[13.5px] font-medium">Etapa final</div>
            </div>
            <Switch
              checked={rascunho.etapaFinal}
              onCheckedChange={(v) => mudar("etapaFinal", v)}
              aria-label="Etapa final"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={salvar.isPending} onClick={() => salvar.mutate(rascunho)}>
            {salvar.isPending && <Loader2 className="animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
