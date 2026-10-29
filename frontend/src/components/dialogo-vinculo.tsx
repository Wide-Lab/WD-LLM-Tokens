import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type RefObject } from "react";
import { Loader2, Lock, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

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
import { bloqueio, vinculoVazio, type Cliente, type Vinculo } from "@/lib/clientes";
import { salvarVinculo } from "@/lib/clientes-mock";
import { ordenar, reguaDoCliente, reguaPadrao, rotuloDe, type Regua } from "@/lib/reguas";
import { formatCurrency, formatNumber } from "@/lib/format";
import { devolverFocoA } from "@/lib/utils";

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
  origemDoFoco,
}: {
  /** `null` fecha o diálogo. A tela mantém um só montado e troca o cliente dele. */
  cliente: Cliente | null;
  vinculo: Vinculo | null;
  reguas: Regua[];
  aberto: boolean;
  onOpenChange: (v: boolean) => void;
  /** Quem abriu o diálogo, para o foco voltar a ele ao fechar. */
  origemDoFoco?: RefObject<HTMLElement | null>;
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
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-lg"
        onCloseAutoFocus={devolverFocoA(origemDoFoco)}
      >
        <DialogHeader>
          <DialogTitle className="[overflow-wrap:anywhere]">{cliente.razaoSocial}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-raised rounded-[var(--wu-radius)] px-4 py-3">
            <div className="text-subtle flex items-center gap-1.5 text-[12.5px]">
              <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Do portal
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3">
              <div>
                <dt className="text-subtle text-[12.5px]">Documento</dt>
                <dd className="text-foreground mt-1 text-[13.5px] tabular-nums">
                  {cliente.documento}
                </dd>
              </div>
              <div>
                <dt className="text-subtle text-[12.5px]">Cidade</dt>
                <dd className="text-foreground mt-1 text-[13.5px]">{cliente.cidade}</dd>
              </div>
              <div>
                <dt className="text-subtle text-[12.5px]">Em aberto</dt>
                <dd className="text-foreground mt-1 text-[13.5px] tabular-nums">
                  {formatCurrency(cliente.valorAberto, "BRL")}
                  <span className="text-subtle ml-1.5 text-xs">
                    {formatNumber(cliente.titulosAbertos)} tít.
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-subtle text-[12.5px]">Telefone do cadastro</dt>
                <dd className="text-foreground mt-1 text-[13.5px] tabular-nums">
                  {cliente.telefone ?? "—"}
                </dd>
              </div>
            </dl>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="vinculo-regua">Régua</Label>
            <Select
              value={rascunho.reguaId ?? HERDA}
              onValueChange={(v) => mudar("reguaId", v === HERDA ? null : v)}
            >
              <SelectTrigger id="vinculo-regua" className="w-full">
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
          </div>

          {/* O efeito da escolha, na mesma tela da escolha: quantos disparos e por qual template.
              É o que impede a régua de ser um nome sem consequência visível. */}
          <div className="border-line rounded-[var(--wu-radius)] border px-4 py-3">
            <div className="text-subtle text-[12.5px]">O que ele recebe — {regua.nome}</div>
            {ativas.length === 0 ? (
              <p className="text-muted-foreground mt-2 text-xs">
                {regua.nome} não tem etapa ativa: este cliente não recebe nada.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {ativas.map((etapa) => (
                  <li key={etapa.id} className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    <span className="bg-sel text-foreground rounded-[var(--wu-radius-sm)] px-1.5 py-0.5 text-xs font-medium tabular-nums">
                      {rotuloDe(etapa)}
                    </span>
                    <span className="text-foreground text-[13px]">{etapa.nome}</span>
                    {/* O `name` da Meta é o id técnico literal, e por isso o único texto em mono.
                        Etapa sem template não dispara. */}
                    {etapa.template ? (
                      <span className="text-muted-foreground font-mono text-xs">
                        {etapa.template}
                      </span>
                    ) : (
                      <span className="text-subtle text-xs">sem template</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="vinculo-numero">Número vinculado</Label>
              <Input
                id="vinculo-numero"
                className="tabular-nums"
                placeholder="+55 48 90000-0000"
                value={rascunho.numeroVinculado ?? ""}
                onChange={(e) => mudar("numeroVinculado", e.target.value || null)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vinculo-gerente">Gerente da conta</Label>
              <Input
                id="vinculo-gerente"
                placeholder="Ninguém"
                value={rascunho.gerenteDaConta ?? ""}
                onChange={(e) => mudar("gerenteDaConta", e.target.value || null)}
              />
            </div>
          </div>

          <div className="border-line flex items-center justify-between gap-4 rounded-[var(--wu-radius)] border px-4 py-3">
            <div className="text-foreground text-[13.5px] font-medium">Pediu para sair</div>
            <Switch
              checked={rascunho.optOut}
              onCheckedChange={(v) => mudar("optOut", v)}
              aria-label="Pediu para sair"
            />
          </div>

          {barrado && (
            <div className="bg-danger-bg flex gap-2.5 rounded-[var(--wu-radius)] px-3 py-2">
              <TriangleAlert className="text-danger mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <div className="text-foreground text-[12.5px]">
                <p className="font-medium">Não recebe</p>
                <p className="mt-0.5">{barrado}</p>
              </div>
            </div>
          )}
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
