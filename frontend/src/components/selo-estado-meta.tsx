import { Check, Clock, PencilLine, TriangleAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { ESTADOS, type EstadoMeta } from "@/lib/templates";
import { cn } from "@/lib/utils";

/**
 * O estado do template na Meta, dito por ícone antes de por cor.
 *
 * A paleta do painel não tem verde de "ok" nem âmbar de "espere": violeta é dinheiro e petróleo é
 * token, e gastar um desses dois num selo de aprovação faria a cor mentir na tela em que ela é o
 * dado (`styles.css`). Sobra a escala neutra mais o `destructive` — e é o suficiente, porque a
 * hierarquia aqui é de duas casas, não de quatro: **dá para enviar** ou **não dá**.
 *
 * Rejeitado é o único em `destructive`: é o estado que impede o disparo. Aprovado é o mais quieto de
 * todos porque é o normal — quase todo template está aprovado, e um selo forte em quase toda linha
 * deixa de marcar coisa nenhuma. Cada um leva ícone próprio: o selo aparece em cartão pequeno, onde
 * dois cinzas parecidos a um metro de distância são o mesmo cinza.
 */
const VISUAL: Record<EstadoMeta, { icone: typeof Check; classe: string }> = {
  aprovado: { icone: Check, classe: "text-muted-foreground border-border" },
  em_analise: { icone: Clock, classe: "bg-secondary text-secondary-foreground border-transparent" },
  rejeitado: {
    icone: TriangleAlert,
    classe: "bg-destructive text-destructive-foreground border-transparent",
  },
  rascunho: { icone: PencilLine, classe: "text-muted-foreground border-dashed border-border" },
};

export function SeloEstadoMeta({ estado }: { estado: EstadoMeta }) {
  const { icone: Icone, classe } = VISUAL[estado];

  return (
    <Badge variant="outline" className={cn("gap-1.5 font-medium", classe)}>
      <Icone className="h-3 w-3 shrink-0" aria-hidden />
      {ESTADOS[estado]}
    </Badge>
  );
}
