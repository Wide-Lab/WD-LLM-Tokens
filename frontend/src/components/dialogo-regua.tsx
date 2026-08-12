import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { criarRegua, salvarRegua } from "@/lib/reguas-mock";
import type { Regua } from "@/lib/reguas";

/** As duas leituras que a escrita derruba: a lista de réguas e a carteira, que aponta para elas. */
const CHAVES = [["reguas-disparos"], ["carteira-disparos"]];

/**
 * Nome e motivo — os dois únicos campos da régua em si; o resto dela são as etapas.
 *
 * Serve para criar e para renomear, porque é o mesmo par de campos. O **motivo** é obrigatório na
 * intenção, ainda que não no código: uma régua é uma exceção à padrão, e exceção sem motivo escrito
 * é exceção que ninguém revoga daqui a um ano — quem chegar depois não vai saber se ainda vale.
 */
export function DialogoRegua({
  regua,
  aberto,
  onOpenChange,
  aoCriar,
}: {
  /** `null` cria. A tela mantém um só diálogo montado e troca o que ele edita. */
  regua: Regua | null;
  aberto: boolean;
  onOpenChange: (v: boolean) => void;
  aoCriar: (regua: Regua) => void;
}) {
  const queryClient = useQueryClient();
  const [nome, setNome] = useState("");
  const [motivo, setMotivo] = useState("");
  const criando = regua === null;

  // Reinicia a cada abertura: o diálogo é reaproveitado, e sem isso a criação seguinte abriria com
  // o texto da régua renomeada antes.
  useEffect(() => {
    if (!aberto) return;
    setNome(regua?.nome ?? "");
    setMotivo(regua?.motivo ?? "");
  }, [aberto, regua]);

  const derrubarLeituras = () => {
    for (const chave of CHAVES) void queryClient.invalidateQueries({ queryKey: chave });
  };

  const salvar = useMutation({
    mutationFn: async () => {
      if (criando) return criarRegua(nome.trim(), motivo.trim());
      await salvarRegua(regua.id, nome.trim(), motivo.trim());
      return null;
    },
    onSuccess: (nova) => {
      derrubarLeituras();
      if (nova) {
        aoCriar(nova);
        toast.success(`Régua "${nova.nome}" criada`, {
          description: "Copiada da padrão. Nenhum cliente foi atribuído ainda.",
        });
      } else {
        toast.success("Régua salva");
      }
      onOpenChange(false);
    },
  });

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">
            {criando ? "Nova régua" : `Renomear ${regua.nome}`}
          </DialogTitle>
          <DialogDescription>
            {criando
              ? "Nasce como cópia da padrão, apontando para os mesmos templates. Ajuste as etapas aqui e atribua os clientes na aba de clientes."
              : "O motivo aparece no cartão da régua. É o que permite a alguém revogar a exceção daqui a um ano."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="regua-nome" className="etiqueta">
              Nome
            </Label>
            <Input
              id="regua-nome"
              autoFocus
              placeholder="Órgão público"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="regua-motivo" className="etiqueta">
              Motivo
            </Label>
            <Textarea
              id="regua-motivo"
              rows={3}
              placeholder="Paga por empenho e liquidação, com prazo que não é o vencimento da nota."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
            <p className="text-muted-foreground text-xs">
              Por que estes clientes não seguem a padrão.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={nome.trim() === "" || salvar.isPending} onClick={() => salvar.mutate()}>
            {salvar.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {criando ? "Criar régua" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
