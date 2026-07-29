import { createFileRoute } from "@tanstack/react-router";

import { PainelCard } from "@/components/painel-card";

/**
 * Esqueleto: as métricas de WhatsApp são a etapa 6.
 *
 * A tela nasce vazia em vez de o item nascer fora da barra lateral porque o painel já tem três
 * seções — quem chegar aqui pelo menu precisa entender que a seção existe e ainda não foi
 * preenchida, e não bater num 404 que parece defeito. O backend já responde
 * `GET /v1/whatsapp/metricas`; falta só o que desenha.
 */
export const Route = createFileRoute("/whatsapp/")({
  head: () => ({
    meta: [
      { title: "WhatsApp — Painel de custos" },
      {
        name: "description",
        content: "Mensagens cobráveis e custo da WhatsApp Business Platform por período.",
      },
    ],
  }),
  component: WhatsappEmBreve,
});

function WhatsappEmBreve() {
  return (
    <PainelCard
      title="Painel de WhatsApp"
      hint="em construção"
      empty
      emptyMessage="Os dados de mensagem já são contabilizados e entram no custo total da visão geral. Os gráficos desta seção ainda serão construídos."
    >
      {null}
    </PainelCard>
  );
}
