import { StatusPill, type TomDeStatus } from "@/components/status-pill";
import { STATUS, type Status } from "@/lib/mensagens-disparo";

/**
 * O status da mensagem do log de Disparos, em pílula de status do wide-ui.
 *
 * É o que aconteceu com a mensagem que **nós** mandamos, e o tom segue o que cada estado pede de
 * quem olha: Lida é o fim bom do caminho (`done`); Enviada e Entregue estão a caminho, sem nada a
 * fazer (`progress`); Adiada é espera — a régua montou e o motor ainda vai soltar (`pending`);
 * Suprimida é decisão, não problema: a carteira barrou e o motivo fica ao lado (`neutral`); Falhou é
 * o único em que algo quebrou (`danger`). O significado está no texto, a cor só reforça. O mapeamento
 * está em `docs/ui-patterns.md`, e quem usa passa o status, não o tom.
 */
const TOM: Record<Status, TomDeStatus> = {
  suprimida: "neutral",
  adiada: "pending",
  enviada: "progress",
  entregue: "progress",
  lida: "done",
  falhou: "danger",
};

export function SeloStatusDisparo({ status, className }: { status: Status; className?: string }) {
  return (
    <StatusPill tom={TOM[status]} className={className}>
      {STATUS[status]}
    </StatusPill>
  );
}
