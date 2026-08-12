import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Check, Loader2, Send, TriangleAlert, X } from "lucide-react";
import { toast } from "sonner";

import { SeloEstadoMeta } from "@/components/selo-estado-meta";
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
import { formatCurrency, formatNumber } from "@/lib/format";
import { visualDaCategoria } from "@/lib/grafico";
import { previa, variaveisDesconhecidas, VARIAVEIS, type Template } from "@/lib/templates";
import {
  enviarParaMeta,
  renomearTemplate,
  responderMeta,
  salvarRascunho,
} from "@/lib/templates-mock";
import { cn } from "@/lib/utils";

/** A chave que a lista usa — o diálogo derruba a mesma leitura depois de cada escrita. */
const CHAVE = ["templates-whatsapp"];

/**
 * O editor de template: a tela em que se escreve o texto e **não** se publica nada.
 *
 * É a diferença que ele existe para carregar. Nas outras escritas do painel, salvar é o fim: o preço
 * cadastrado passa a valer na data escolhida e o custo já sai por ele. Aqui salvar produz um
 * rascunho, e o que continua saindo é a versão anterior até a Meta aprovar — então o corpo em
 * produção, a versão e o estado da análise aparecem juntos no cabeçalho, e o rascunho é rotulado
 * como o que ainda não está valendo. Um formulário que dissesse só "salvo" faria alguém trocar a
 * mensagem na segunda e descobrir na terça, pelo custo, que ela não trocou.
 *
 * As escritas ainda são do mock (`lib/templates-mock.ts`): a aba é frontend, sem rota no backend.
 */
export function DialogoTemplate({
  template,
  aberto,
  onOpenChange,
}: {
  /** `null` fecha o diálogo. A tela mantém um só montado e troca o template dele. */
  template: Template | null;
  aberto: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [nome, setNome] = useState("");
  const [texto, setTexto] = useState("");

  // Reinicia a cada abertura e a cada troca de template: o diálogo é reaproveitado por todos os
  // cartões, e sem isso o segundo abriria com o texto do primeiro.
  useEffect(() => {
    if (!aberto || !template) return;
    setNome(template.nome);
    setTexto(template.rascunho ?? template.corpo);
  }, [aberto, template]);

  const invalidar = () => queryClient.invalidateQueries({ queryKey: CHAVE });

  const salvar = useMutation({
    mutationFn: async ({ enviar }: { enviar: boolean }) => {
      if (!template) return;
      if (nome.trim() && nome.trim() !== template.nome) {
        await renomearTemplate(template.id, nome.trim());
      }
      if (texto !== (template.rascunho ?? template.corpo)) {
        await salvarRascunho(template.id, texto);
      }
      if (enviar) await enviarParaMeta(template.id);
    },
    onSuccess: (_dados, { enviar }) => {
      void invalidar();
      if (enviar) {
        toast.success("Enviado para análise da Meta", {
          description: "O corpo atual continua saindo até a aprovação chegar.",
        });
      } else {
        toast("Rascunho salvo", { description: "Ainda não vale em produção — envie para a Meta." });
      }
      onOpenChange(false);
    },
  });

  const responder = useMutation({
    mutationFn: ({ aprovado }: { aprovado: boolean }) => responderMeta(template!.id, aprovado),
    onSuccess: (_dados, { aprovado }) => {
      void invalidar();
      if (aprovado) {
        toast.success("Meta aprovou", { description: "A versão nova entrou em vigor." });
      } else {
        toast("Meta recusou", { description: "Segue valendo a versão anterior." });
      }
      onOpenChange(false);
    },
  });

  if (!template) return null;

  const categoria = visualDaCategoria(template.categoria);
  const emAnalise = template.estado === "em_analise";
  const desconhecidas = variaveisDesconhecidas(texto);
  const mudou = texto !== (template.rascunho ?? template.corpo);
  const renomeou = nome.trim() !== "" && nome.trim() !== template.nome;
  const escrevendo = salvar.isPending || responder.isPending;

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2.5 font-mono text-base">
            {template.nome}
            {template.versao > 0 && (
              <span className="leitura text-muted-foreground text-sm">v{template.versao}</span>
            )}
            <SeloEstadoMeta estado={template.estado} />
            {categoria && (
              <span
                className="etiqueta rounded-sm px-2 py-1 text-[0.625rem] text-white"
                style={{ background: categoria.cor }}
              >
                {categoria.nome}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="template-nome" className="etiqueta">
              Nome
            </Label>
            <Input
              id="template-nome"
              value={nome}
              // Minúsculas com `_` já na digitação: é o formato do `name` da Meta, e é por ele que a
              // aplicação pede o envio — nome fora do formato é template que a API não encontra.
              onChange={(e) => setNome(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
              className="font-mono"
              readOnly={emAnalise}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="template-corpo" className="etiqueta">
              {template.rascunho !== null ? "Rascunho — não está em produção" : "Corpo"}
            </Label>
            <Textarea
              id="template-corpo"
              rows={8}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              className="font-mono text-xs leading-relaxed"
              // Em análise o corpo é da Meta, não nosso: editar aqui daria a impressão de que a
              // versão em avaliação mudou junto.
              readOnly={emAnalise}
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {VARIAVEIS.map((v) => (
              <button
                key={v.chave}
                type="button"
                disabled={emAnalise}
                title={`${v.descricao} — ex.: ${v.exemplo}`}
                onClick={() => setTexto((t) => `${t}{{${v.chave}}}`)}
                className={cn(
                  "text-muted-foreground rounded-sm border px-2 py-1 font-mono text-xs",
                  "hover:bg-secondary hover:text-foreground disabled:opacity-50",
                )}
              >
                {`{{${v.chave}}}`}
              </button>
            ))}
          </div>

          {desconhecidas.length > 0 && (
            <div className="border-destructive/50 flex gap-2.5 rounded-sm border-l-2 py-1.5 pl-3">
              <TriangleAlert className="text-destructive mt-0.5 h-4 w-4 shrink-0" />
              <p className="text-muted-foreground text-xs">
                Fora do catálogo: {desconhecidas.map((d) => `{{${d}}}`).join(", ")}. A aplicação não
                manda esse dado — a Meta aprova o corpo e o envio falha depois, uma mensagem por
                vez.
              </p>
            </div>
          )}

          <div className="bg-muted/50 rounded-sm border px-4 py-3">
            <div className="etiqueta">Prévia com os exemplos do catálogo</div>
            <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap">
              {texto.trim() === "" ? "—" : previa(texto)}
            </p>
          </div>

          {/* O corpo que está saindo, ao lado do que ainda não saiu: é a única forma de ver que as
              duas coisas são diferentes sem sair da tela. */}
          {template.rascunho !== null && template.aprovadoEmProducao && (
            <div className="rounded-sm border px-4 py-3">
              <div className="etiqueta">Em produção agora — v{template.versao}</div>
              <p className="text-muted-foreground mt-2 text-xs leading-relaxed whitespace-pre-wrap">
                {template.corpo}
              </p>
            </div>
          )}

          <Uso template={template} />
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {/* No serviço real quem responde é a Meta, por webhook. Aqui é botão, e está dito. */}
          <div className="flex flex-wrap gap-2">
            {emAnalise && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={escrevendo}
                  onClick={() => responder.mutate({ aprovado: true })}
                >
                  {responder.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  Simular aprovação
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={escrevendo}
                  onClick={() => responder.mutate({ aprovado: false })}
                >
                  <X className="h-4 w-4" />
                  Simular recusa
                </Button>
              </>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
            {!emAnalise && (
              <>
                <Button
                  variant="outline"
                  disabled={escrevendo || (!mudou && !renomeou)}
                  onClick={() => salvar.mutate({ enviar: false })}
                >
                  Salvar rascunho
                </Button>
                <Button
                  // Sem corpo não há o que analisar, e variável fora do catálogo passa pela Meta
                  // para falhar no envio: os dois são recusa daqui, antes de custar uma análise.
                  disabled={
                    escrevendo ||
                    texto.trim() === "" ||
                    desconhecidas.length > 0 ||
                    (!mudou && template.rascunho === null)
                  }
                  onClick={() => salvar.mutate({ enviar: true })}
                >
                  {salvar.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Enviar para a Meta
                </Button>
              </>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * O que este texto custou — o motivo de o catálogo morar neste painel e não no console da Meta.
 *
 * Lá dá para ver o template; aqui dá para ver quanto ele gastou, e é essa leitura que decide se vale
 * reescrever o corpo ou trocar a categoria. O período é fixo em trinta dias porque a aba não tem
 * filtro de data: catálogo é cadastro, como `/precos`.
 */
function Uso({ template }: { template: Template }) {
  const semCusto = template.cobraveis > 0 && template.custo === null;

  return (
    <div className="rounded-sm border px-4 py-3">
      <div className="etiqueta">Uso nos últimos 30 dias</div>
      <dl className="mt-3 grid grid-cols-3 gap-x-6">
        <div>
          <dt className="etiqueta">Enviadas</dt>
          <dd className="leitura mt-1.5 text-lg leading-none">{formatNumber(template.enviadas)}</dd>
        </div>
        <div>
          <dt className="etiqueta">Cobráveis</dt>
          <dd className="leitura mt-1.5 text-lg leading-none">
            {formatNumber(template.cobraveis)}
          </dd>
        </div>
        <div>
          <dt className="etiqueta">Custo</dt>
          <dd className="leitura text-custo mt-1.5 text-lg leading-none">
            {formatCurrency(template.custo, template.moeda)}
          </dd>
        </div>
      </dl>
      {semCusto && (
        <p className="text-muted-foreground mt-3 text-xs">
          {formatNumber(template.cobraveis)} mensagens cobráveis e nenhum custo apurado: falta preço
          vigente para {template.categoria} no período. Elas ficam fora da soma do painel até o
          preço existir.
        </p>
      )}
    </div>
  );
}
