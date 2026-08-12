import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { toast } from "sonner";

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
import { bloqueio, vinculoVazio, FLAGS, type Cliente, type Vinculo } from "@/lib/clientes";
import { salvarVinculo } from "@/lib/clientes-mock";
import { ordenar, reguaDoCliente, reguaPadrao, rotuloDe, type Regua } from "@/lib/reguas";
import { formatCurrency, formatNumber } from "@/lib/format";

/** A chave que a lista usa — o diálogo derruba a mesma leitura depois de gravar. */
const CHAVE = ["carteira-disparos"];

/** O valor do `Select` que representa "sem régua atribuída". Radix não aceita item de valor "". */
const HERDA = "__herda__";

/**
 * O editor de vínculo: a tela em que se mexe só no que é nosso.
 *
 * O diálogo inteiro é a costura desenhada de perto. Em cima, num bloco fechado e com cadeado, o que
 * veio do portal — e que não tem campo, nem botão, nem jeito de editar. Embaixo, os quatro dados que
 * são nossos: a régua que dá o ritmo, o número verificado no WhatsApp, o gerente que recebe o alerta
 * e o opt-out. Mostrar os dois juntos é o que dá sentido à tela: sem os títulos em aberto ninguém
 * decide qual régua atribuir, e um formulário que aceitasse editar a razão social prometeria uma
 * gravação que o portal nunca receberia.
 *
 * A escrita ainda é do mock (`lib/clientes-mock.ts`): a aba é frontend, sem rota no backend.
 */
export function DialogoVinculo({
  cliente,
  vinculo,
  reguas,
  aberto,
  onOpenChange,
}: {
  /** `null` fecha o diálogo. A tela mantém um só montado e troca o cliente dele. */
  cliente: Cliente | null;
  vinculo: Vinculo | null;
  reguas: Regua[];
  aberto: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [rascunho, setRascunho] = useState<Vinculo | null>(null);

  // Reinicia a cada abertura e a cada troca de cliente: o diálogo é reaproveitado por todas as
  // linhas, e sem isso a segunda abriria com o vínculo da primeira.
  useEffect(() => {
    if (!aberto || !cliente) return;
    setRascunho(vinculo ?? vinculoVazio(cliente.id));
  }, [aberto, cliente, vinculo]);

  const salvar = useMutation({
    mutationFn: (v: Vinculo) => salvarVinculo(v),
    onSuccess: (v) => {
      void queryClient.invalidateQueries({ queryKey: CHAVE });
      const regua = reguaDoCliente(reguas, v.reguaId);
      toast.success("Vínculo salvo", {
        description: `${cliente?.razaoSocial} segue a régua ${regua.nome}.`,
      });
      onOpenChange(false);
    },
  });

  if (!cliente || !rascunho) return null;

  const mudar = <K extends keyof Vinculo>(campo: K, valor: Vinculo[K]) =>
    setRascunho({ ...rascunho, [campo]: valor });

  const regua = reguaDoCliente(reguas, rascunho.reguaId);
  const ativas = ordenar(regua.etapas).filter((e) => e.ativa);
  const barrado = bloqueio(cliente, rascunho);
  const padrao = reguaPadrao(reguas);

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">{cliente.razaoSocial}</DialogTitle>
          <DialogDescription>
            O que está no bloco de cima vem do portal e não se edita aqui. O de baixo é nosso — é
            exatamente o que o portal não tem onde guardar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-muted/50 rounded-sm border px-4 py-3">
            <div className="etiqueta flex items-center gap-1.5">
              <Lock className="h-3 w-3 shrink-0" aria-hidden />
              Do portal
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3">
              <div>
                <dt className="etiqueta">Documento</dt>
                <dd className="leitura mt-1.5 text-sm leading-none">{cliente.documento}</dd>
              </div>
              <div>
                <dt className="etiqueta">Cidade</dt>
                <dd className="mt-1.5 text-sm leading-none">{cliente.cidade}</dd>
              </div>
              <div>
                <dt className="etiqueta">Em aberto</dt>
                <dd className="leitura mt-1.5 text-sm leading-none">
                  {formatCurrency(cliente.valorAberto, "BRL")}
                  <span className="text-muted-foreground ml-1.5 text-xs">
                    {formatNumber(cliente.titulosAbertos)} tít.
                  </span>
                </dd>
              </div>
              <div>
                <dt className="etiqueta">Telefone do cadastro</dt>
                <dd className="leitura mt-1.5 text-sm leading-none">{cliente.telefone ?? "—"}</dd>
              </div>
              <div className="col-span-2">
                <dt className="etiqueta">Flags</dt>
                <dd className="mt-1.5 text-sm leading-none">
                  {cliente.flags.length === 0
                    ? "nenhuma"
                    : cliente.flags.map((f) => FLAGS[f]).join(" · ")}
                </dd>
              </div>
            </dl>
          </div>

          <div className="space-y-2">
            <Label htmlFor="vinculo-regua" className="etiqueta">
              Régua
            </Label>
            <Select
              value={rascunho.reguaId ?? HERDA}
              onValueChange={(v) => mudar("reguaId", v === HERDA ? null : v)}
            >
              <SelectTrigger id="vinculo-regua">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={HERDA}>Segue a padrão — {padrao.nome}</SelectItem>
                {reguas
                  .filter((r) => !r.padrao)
                  .map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.nome}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">
              Sem atribuição o cliente segue a padrão, e é o caso da maior parte da carteira. Trocar
              aqui muda o ritmo dele, não o texto: o texto é o template, e passa pela Meta.
            </p>
          </div>

          {/* O efeito da escolha, na mesma tela da escolha: quantos disparos e por qual template.
              É o que impede a régua de ser um nome sem consequência visível. */}
          <div className="rounded-sm border px-4 py-3">
            <div className="etiqueta">O que ele recebe — {regua.nome}</div>
            {ativas.length === 0 ? (
              <p className="text-muted-foreground mt-2 text-xs">
                {regua.nome} não tem etapa ativa: este cliente não recebe nada.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {ativas.map((etapa) => (
                  <li key={etapa.id} className="flex flex-wrap items-center gap-2.5 text-xs">
                    <span className="leitura bg-secondary text-secondary-foreground rounded-sm px-1.5 py-0.5">
                      {rotuloDe(etapa)}
                    </span>
                    <span>{etapa.nome}</span>
                    {/* Etapa ativa sem template não envia nada, e é na régua que isso se resolve. */}
                    <span className="text-muted-foreground font-mono">
                      {etapa.template ?? "sem template"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-muted-foreground mt-3 text-xs">{regua.motivo}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="vinculo-numero" className="etiqueta">
                Número vinculado
              </Label>
              <Input
                id="vinculo-numero"
                className="font-mono"
                placeholder="+55 48 90000-0000"
                value={rascunho.numeroVinculado ?? ""}
                onChange={(e) => mudar("numeroVinculado", e.target.value || null)}
              />
              <p className="text-muted-foreground text-xs">
                Verificado no WhatsApp. Sem ele nada sai, mesmo com régua atribuída.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="vinculo-gerente" className="etiqueta">
                Gerente da conta
              </Label>
              <Input
                id="vinculo-gerente"
                placeholder="Ninguém"
                value={rascunho.gerenteDaConta ?? ""}
                onChange={(e) => mudar("gerenteDaConta", e.target.value || null)}
              />
              <p className="text-muted-foreground text-xs">
                Quem recebe o alerta quando a régua chega na última etapa.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-sm border px-4 py-3">
            <div>
              <div className="text-sm font-medium">Pediu para sair</div>
              <p className="text-muted-foreground mt-1 text-xs">
                Suspende a régua inteira para este cliente. Exigência do WhatsApp, não preferência
                nossa.
              </p>
            </div>
            <Switch
              checked={rascunho.optOut}
              onCheckedChange={(v) => mudar("optOut", v)}
              aria-label="Pediu para sair"
            />
          </div>

          {barrado && (
            <div className="border-destructive/50 flex flex-col gap-1 rounded-sm border-l-2 py-1.5 pl-3">
              <span className="etiqueta">Não recebe</span>
              <p className="text-muted-foreground text-xs">{barrado}</p>
            </div>
          )}
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
