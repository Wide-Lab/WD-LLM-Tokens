import { createFileRoute } from "@tanstack/react-router";

import { PainelCard } from "@/components/painel-card";

/** Esqueleto: a lista de mensagens é a etapa 6. Ver `whatsapp/index.tsx` para o porquê do stub. */
export const Route = createFileRoute("/whatsapp/mensagens")({
  head: () => ({
    meta: [
      { title: "Mensagens — Painel de custos" },
      {
        name: "description",
        content: "Lista de mensagens de WhatsApp com categoria, país, cobrança e custo.",
      },
    ],
  }),
  component: MensagensEmBreve,
});

function MensagensEmBreve() {
  return (
    <PainelCard
      title="Mensagens"
      hint="em construção"
      empty
      emptyMessage="A lista crua de mensagens ainda será construída. Por enquanto, o custo agregado aparece na visão geral."
    >
      {null}
    </PainelCard>
  );
}
