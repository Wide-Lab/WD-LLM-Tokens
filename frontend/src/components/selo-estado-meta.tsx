import { StatusPill, type TomDeStatus } from "@/components/status-pill";
import { ESTADOS, type EstadoMeta } from "@/lib/templates";

/**
 * O estado do template na Meta, em pílula de status do wide-ui.
 *
 * A hierarquia é de duas casas — **dá para enviar** ou **não dá** — e o tom segue o que o estado
 * pede de quem olha: Aprovado é o normal (`done`); Em análise é espera, a Meta ainda não respondeu
 * (`pending`); Rascunho é o texto que ainda é nosso, sem ação de ninguém (`neutral`); Rejeitado é o
 * único que impede o disparo e pede conserto (`danger`). O significado está no texto da pílula, a
 * cor só reforça. O mapeamento está em `docs/ui-patterns.md`, e quem usa passa o estado, não o tom.
 */
const TOM: Record<EstadoMeta, TomDeStatus> = {
  aprovado: "done",
  em_analise: "pending",
  rejeitado: "danger",
  rascunho: "neutral",
};

export function SeloEstadoMeta({ estado, className }: { estado: EstadoMeta; className?: string }) {
  return (
    <StatusPill tom={TOM[estado]} className={className}>
      {ESTADOS[estado]}
    </StatusPill>
  );
}
