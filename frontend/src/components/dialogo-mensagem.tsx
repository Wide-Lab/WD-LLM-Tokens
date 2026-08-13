import { ArrowRight } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency, formatDateOnly, formatDateTime } from "@/lib/format";
import {
  escala,
  valorTotal,
  COR_STATUS,
  RESPOSTAS,
  STATUS,
  type Mensagem,
} from "@/lib/mensagens-disparo";
import { cn } from "@/lib/utils";

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
}: {
  /** `null` fecha. A tela mantém um só montado e troca a mensagem dele. */
  mensagem: Mensagem | null;
  aberto: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  if (!mensagem) return null;

  const total = valorTotal(mensagem);

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            {mensagem.cliente}
            <span className={cn("text-sm font-medium", COR_STATUS[mensagem.status])}>
              {STATUS[mensagem.status]}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Campo rotulo="Telefone" mono>
              {mensagem.telefone}
            </Campo>
            <Campo rotulo="Régua aplicada">{mensagem.reguaNome}</Campo>
            <Campo rotulo="Lote montado" mono>
              {formatDateTime(mensagem.montadaEm)}
            </Campo>
            <Campo rotulo="Enviada" mono>
              {mensagem.enviadaEm ? formatDateTime(mensagem.enviadaEm) : "—"}
            </Campo>
          </div>

          {/* A cadeia inteira numa linha: é a frase que explica a mensagem. */}
          <div className="bg-muted/50 flex flex-wrap items-center gap-2 rounded-sm border px-3 py-2 text-sm">
            <span className="font-medium">{mensagem.reguaNome}</span>
            <ArrowRight className="text-muted-foreground h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>{mensagem.etapaNome}</span>
            <ArrowRight className="text-muted-foreground h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="font-mono text-xs">{mensagem.template}</span>
            <span className="etiqueta">v{mensagem.templateVersao}</span>
          </div>

          {mensagem.motivo && (
            <div className="rounded-sm border border-dashed px-3 py-2">
              <div className="etiqueta">Motivo</div>
              <p className="mt-1.5 text-sm">{mensagem.motivo}</p>
            </div>
          )}

          <div>
            <div className="etiqueta mb-2">
              Títulos consolidados — {mensagem.titulos.length}, {formatCurrency(total, "BRL")}
            </div>
            <div className="overflow-hidden rounded-sm border">
              <table className="w-full text-sm">
                <tbody>
                  {mensagem.titulos.map((t) => (
                    <tr key={t.numero} className="border-b last:border-0">
                      <td className="leitura px-3 py-1.5 text-xs">{t.numero}</td>
                      <td className="text-muted-foreground px-3 py-1.5 text-xs">
                        venc. {formatDateOnly(t.vencimento)}
                      </td>
                      <td className="leitura px-3 py-1.5 text-right text-xs">
                        {formatCurrency(t.valor, "BRL")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <div className="etiqueta mb-2">Texto enviado</div>
            <div className="bg-card rounded-sm border px-3 py-2.5">
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{mensagem.texto}</p>
            </div>
          </div>

          {mensagem.resposta !== "nenhuma" && (
            <div>
              <div className="etiqueta mb-2">
                Resposta do cliente
                {mensagem.respondidaEm && ` · ${formatDateTime(mensagem.respondidaEm)}`}
              </div>
              <p className="text-sm">
                {RESPOSTAS[mensagem.resposta]}
                {escala(mensagem.resposta) && (
                  <span className="text-muted-foreground">
                    {" "}
                  </span>
                )}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Campo({
  rotulo,
  mono,
  children,
}: {
  rotulo: string;
  mono?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="etiqueta">{rotulo}</div>
      <div className={cn("mt-1 text-sm", mono && "leitura text-xs")}>{children}</div>
    </div>
  );
}
