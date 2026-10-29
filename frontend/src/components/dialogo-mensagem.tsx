import type { RefObject } from "react";
import { ArrowRight } from "lucide-react";

import { SeloStatusDisparo } from "@/components/selo-status-disparo";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatCurrency, formatDateOnly, formatDateTime } from "@/lib/format";
import { RESPOSTAS, valorTotal, type Mensagem } from "@/lib/mensagens-disparo";
import { devolverFocoA } from "@/lib/utils";

/**
 * Uma mensagem por dentro — e a resposta a "por que esta saiu assim".
 *
 * A tabela responde o que aconteceu; o diálogo responde por quê, e a resposta é sempre a mesma
 * cadeia: régua → etapa → template, na versão que era a vigente naquele dia. Ela aparece desenhada
 * numa faixa só porque é uma frase, não quatro campos: trocar a régua do cliente muda a etapa, que
 * muda o texto, que muda a tarifa — e quem abre esta janela está seguindo exatamente esse fio.
 *
 * A versão do template é o dado que não se pode reconstruir depois. O catálogo de
 * `/whatsapp/templates` mostra o corpo de hoje; o que saiu foi o corpo de então, e sem o número
 * gravado na linha não há como saber qual dos dois o cliente leu.
 *
 * Nada aqui se edita. O log é append-only por natureza — é foto do que já aconteceu —, e o único
 * lugar em que se muda o que vai acontecer é a régua.
 */
export function DialogoMensagem({
  mensagem,
  aberto,
  onOpenChange,
  origemDoFoco,
}: {
  /** `null` fecha. A tela mantém um só montado e troca a mensagem dele. */
  mensagem: Mensagem | null;
  aberto: boolean;
  onOpenChange: (v: boolean) => void;
  /** Quem abriu o diálogo, para o foco voltar a ele ao fechar. */
  origemDoFoco?: RefObject<HTMLElement | null>;
}) {
  if (!mensagem) return null;

  const total = valorTotal(mensagem);

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-xl"
        onCloseAutoFocus={devolverFocoA(origemDoFoco)}
      >
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className="[overflow-wrap:anywhere]">{mensagem.cliente}</span>
            <SeloStatusDisparo status={mensagem.status} />
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
            <Campo rotulo="Telefone">{mensagem.telefone}</Campo>
            <Campo rotulo="Régua aplicada">{mensagem.reguaNome}</Campo>
            <Campo rotulo="Lote montado">{formatDateTime(mensagem.montadaEm)}</Campo>
            <Campo rotulo="Enviada">
              {mensagem.enviadaEm ? formatDateTime(mensagem.enviadaEm) : "—"}
            </Campo>
          </dl>

          {/* A cadeia inteira numa linha: é a frase que explica a mensagem. O `name` do template é o
              id técnico literal da Meta, e por isso o único texto em mono. */}
          <div className="bg-raised flex flex-wrap items-center gap-2 rounded-[var(--wu-radius)] px-4 py-3 text-[13.5px]">
            <span className="text-foreground font-medium">{mensagem.reguaNome}</span>
            <ArrowRight className="text-subtle h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="text-foreground">{mensagem.etapaNome}</span>
            <ArrowRight className="text-subtle h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="text-foreground font-mono text-xs">{mensagem.template}</span>
            <span className="text-subtle text-xs tabular-nums">v{mensagem.templateVersao}</span>
          </div>

          {mensagem.motivo && (
            <div className="border-line-strong rounded-[var(--wu-radius)] border border-dashed px-4 py-3">
              <div className="text-subtle text-[12.5px]">Motivo</div>
              <p className="text-foreground mt-1 text-[13.5px]">{mensagem.motivo}</p>
            </div>
          )}

          <div>
            <div className="text-subtle mb-2 text-[12.5px]">
              Títulos consolidados — {mensagem.titulos.length}, {formatCurrency(total, "BRL")}
            </div>
            <table className="border-line divide-line w-full divide-y overflow-hidden rounded-[var(--wu-radius)] border text-[13px]">
              <tbody className="divide-line divide-y">
                {mensagem.titulos.map((t) => (
                  <tr key={t.numero}>
                    <td className="text-foreground px-3 py-2 tabular-nums">{t.numero}</td>
                    <td className="text-muted-foreground px-3 py-2">
                      venc. {formatDateOnly(t.vencimento)}
                    </td>
                    <td className="text-foreground px-3 py-2 text-right tabular-nums">
                      {formatCurrency(t.valor, "BRL")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <div className="text-subtle mb-2 text-[12.5px]">Texto enviado</div>
            <div className="border-line bg-card rounded-[var(--wu-radius-sm)] border p-3">
              <p className="text-foreground text-[13.5px] leading-relaxed whitespace-pre-wrap">
                {mensagem.texto}
              </p>
            </div>
          </div>

          {mensagem.resposta !== "nenhuma" && (
            <div>
              <div className="text-subtle mb-1 text-[12.5px]">
                Resposta do cliente
                {mensagem.respondidaEm && ` · ${formatDateTime(mensagem.respondidaEm)}`}
              </div>
              <p className="text-foreground text-[13.5px]">{RESPOSTAS[mensagem.resposta]}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-subtle text-[12.5px]">{rotulo}</dt>
      <dd className="text-foreground mt-1 text-[13.5px] tabular-nums">{children}</dd>
    </div>
  );
}
