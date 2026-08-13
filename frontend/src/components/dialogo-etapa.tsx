import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Loader2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { QuandoCai } from "@/components/quando-cai";
import { SeloEstadoMeta } from "@/components/selo-estado-meta";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
}: {
  reguaId: string;
  /** `null` fecha o diálogo. A tela mantém um só montado e troca a etapa dele. */
  etapa: Etapa | null;
  templates: Template[];
  aberto: boolean;
  onOpenChange: (v: boolean) => void;
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">{rascunho.nome}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="etapa-nome" className="etiqueta">
              Nome
            </Label>
            <Input
              id="etapa-nome"
              value={rascunho.nome}
              onChange={(e) => mudar("nome", e.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="etapa-ancora" className="etiqueta">
                Âncora
              </Label>
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

            <div className="space-y-2">
              <Label htmlFor="etapa-deslocamento" className="etiqueta">
                Dias
              </Label>
              <Input
                id="etapa-deslocamento"
                type="number"
                className="leitura"
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

            <div className="space-y-2">
              <Label htmlFor="etapa-contagem" className="etiqueta">
                Contagem
              </Label>
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

          <div className="bg-muted/50 rounded-sm border px-4 py-3">
            <div className="etiqueta">Cai em</div>
            <div className="mt-2">
              <QuandoCai etapa={rascunho} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="etapa-template" className="etiqueta">
                Template
              </Label>
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
              {escolhido ? (
                <div className="flex flex-wrap items-center gap-2">
                  <SeloEstadoMeta estado={escolhido.estado} />
                  <span className="text-muted-foreground text-xs">
                    {escolhido.rascunho !== null && escolhido.aprovadoEmProducao
                      ? `sai a v${escolhido.versao}; há rascunho pendente`
                      : `sai a v${escolhido.versao}`}
                  </span>
                </div>
              ) : (
                <p className="text-muted-foreground text-xs"></p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="etapa-anexo" className="etiqueta">
                Anexo
              </Label>
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
            <div className="border-destructive/50 flex flex-col gap-1 rounded-sm border-l-2 py-1.5 pl-3">
              <span className="etiqueta flex items-center gap-1.5">
                <TriangleAlert className="h-3 w-3 shrink-0" aria-hidden />
                Não dispara
              </span>
              <p className="text-muted-foreground text-xs">
                Etapa ativa {semDisparo}: título que chegar nela não tem o que enviar. No serviço
                real isto bloqueia o salvamento.
              </p>
            </div>
          )}

          <div className="flex items-center justify-between gap-4 rounded-sm border px-4 py-3">
            <div>
              <div className="text-sm font-medium">Ativa</div>
            </div>
            <Switch
              checked={rascunho.ativa}
              onCheckedChange={(v) => mudar("ativa", v)}
              aria-label="Ativa"
            />
          </div>

          <div className="flex items-center justify-between gap-4 rounded-sm border px-4 py-3">
            <div>
              <div className="text-sm font-medium">Etapa final</div>
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
            {salvar.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
