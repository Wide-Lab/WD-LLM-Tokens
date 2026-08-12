import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, TriangleAlert } from "lucide-react";

import { AvisoDeMock } from "@/components/aviso-mock";
import { DialogoTemplate } from "@/components/dialogo-template";
import { EmptyBox, ErrorBox } from "@/components/empty-states";
import { SeloEstadoMeta } from "@/components/selo-estado-meta";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatNumber } from "@/lib/format";
import { CATEGORIAS_DE_TEMPLATE, type Template } from "@/lib/templates";
import { criarTemplate, listarTemplates } from "@/lib/templates-mock";

export const Route = createFileRoute("/whatsapp/templates")({
  head: () => ({
    meta: [
      { title: "Templates — Painel de custos" },
      {
        name: "description",
        content: "Catálogo de templates de WhatsApp, com estado na Meta e custo do período.",
      },
      { property: "og:title", content: "Templates — Painel de custos" },
      {
        property: "og:description",
        content: "O texto aprovado antes da mensagem, e quanto cada um gastou.",
      },
    ],
  }),
  component: Templates,
});

const CHAVE = ["templates-whatsapp"];

/**
 * O catálogo de templates — a terceira aba do WhatsApp, e a única da seção que não lê fato.
 *
 * As outras duas contam o que já aconteceu: o painel agrega, a lista mostra mensagem por mensagem. O
 * template é o registro que vem **antes** do fato — é o texto que ainda vai virar mensagem cobrável,
 * e por isso é a única coisa desta seção em que mexer muda o gasto de amanhã em vez de explicar o de
 * ontem. Fica dentro do WhatsApp, e não junto de `/precos`, porque não é régua de conversão: é
 * cadastro de uma origem só, sem par no LLM.
 *
 * Sem filtro global de propósito, pelo mesmo motivo de `/precos`: catálogo não é leitura de período.
 * O uso que aparece no cartão é de uma janela fixa, e está rotulado como tal.
 */
function Templates() {
  const [editando, setEditando] = useState<Template | null>(null);
  const queryClient = useQueryClient();

  const q = useQuery({ queryKey: CHAVE, queryFn: listarTemplates });

  const criar = useMutation({
    mutationFn: (categoria: string) => criarTemplate(categoria),
    onSuccess: (template) => {
      void queryClient.invalidateQueries({ queryKey: CHAVE });
      // Abre já no editor: um cartão vazio no fim da lista deixaria o clique seguinte por conta de
      // quem criou, e o que falta é justamente o corpo.
      setEditando(template);
    },
  });

  // O template aberto vem sempre da lista, e não do estado: depois de salvar, o objeto guardado no
  // clique é a versão anterior, e o diálogo seguiria mostrando o corpo de antes da escrita.
  const aberto = editando ? (q.data?.find((t) => t.id === editando.id) ?? editando) : null;

  if (q.error) return <ErrorBox error={q.error} />;

  return (
    <div className="flex flex-col gap-4">
      <AvisoDeMock>
        Esta aba ainda não fala com o backend: o catálogo vive em memória e volta ao início a cada
        recarga. Salvar, enviar e a resposta da Meta funcionam na tela e não gravam nada.
      </AvisoDeMock>

      {q.isLoading ? (
        <Carregando />
      ) : (
        CATEGORIAS_DE_TEMPLATE.map((categoria) => {
          // Ordenado por custo, do maior para o menor: num painel de custos a primeira pergunta
          // sobre um catálogo é qual texto está puxando a conta. Quem não gastou nada desce.
          const daCategoria = (q.data ?? [])
            .filter((t) => t.categoria === categoria.chave)
            .sort((a, b) => (b.custo ?? 0) - (a.custo ?? 0));

          return (
            <section key={categoria.chave} className="flex flex-col gap-2.5">
              <header className="flex flex-wrap items-center gap-3">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: categoria.cor }}
                  aria-hidden
                />
                <h2 className="etiqueta">{categoria.nome}</h2>
                <span className="leitura text-muted-foreground text-xs">{daCategoria.length}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground ml-auto gap-1.5"
                  disabled={criar.isPending}
                  onClick={() => criar.mutate(categoria.chave)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Novo template
                </Button>
              </header>

              {daCategoria.length === 0 ? (
                <EmptyBox
                  message={`Nenhum template de ${categoria.nome.toLowerCase()}. Sem ele, a aplicação não tem o que enviar nesta categoria fora da janela de atendimento.`}
                />
              ) : (
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                  {daCategoria.map((t) => (
                    <Cartao key={t.id} template={t} onAbrir={() => setEditando(t)} />
                  ))}
                </div>
              )}
            </section>
          );
        })
      )}

      <DialogoTemplate
        template={aberto}
        aberto={aberto !== null}
        onOpenChange={(v) => !v && setEditando(null)}
      />
    </div>
  );
}

function Carregando() {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <Skeleton className="h-44 w-full rounded-xl" />
      <Skeleton className="h-44 w-full rounded-xl" />
      <Skeleton className="h-44 w-full rounded-xl" />
      <Skeleton className="h-44 w-full rounded-xl" />
    </div>
  );
}

/**
 * Um template na lista: o que ele diz, quem o usa e quanto ele custou.
 *
 * O corpo vem truncado em três linhas porque a pergunta do relance é "qual dos seis é este", não
 * "qual é o texto inteiro" — para isso serve o clique. E o rodapé é de dinheiro, na leitura de
 * custo, porque é o que esta tela tem e o console da Meta não.
 */
function Cartao({ template, onAbrir }: { template: Template; onAbrir: () => void }) {
  const corpo =
    template.rascunho !== null && !template.aprovadoEmProducao ? template.rascunho : template.corpo;

  return (
    <button
      type="button"
      onClick={onAbrir}
      className="bg-card hover:bg-accent/40 flex flex-col rounded-xl border p-5 text-left shadow-sm transition-colors"
    >
      <div className="flex w-full flex-wrap items-center gap-2.5">
        <span className="truncate font-mono text-sm font-medium">{template.nome}</span>
        {template.versao > 0 && (
          <span className="leitura text-muted-foreground text-xs">v{template.versao}</span>
        )}
        <span className="ml-auto">
          <SeloEstadoMeta estado={template.estado} />
        </span>
      </div>

      <div className="etiqueta mt-1.5 truncate">
        {template.aplicacao} · {template.idioma}
      </div>

      <p className="text-muted-foreground mt-3 line-clamp-3 grow text-xs leading-relaxed">
        {corpo.trim() === "" ? "Sem corpo ainda." : corpo}
      </p>

      <dl className="mt-4 grid w-full grid-cols-3 gap-x-4 border-t pt-3">
        <div>
          <dt className="etiqueta">Enviadas</dt>
          <dd className="leitura mt-1 text-sm leading-none">{formatNumber(template.enviadas)}</dd>
        </div>
        <div>
          <dt className="etiqueta">Cobráveis</dt>
          <dd className="leitura mt-1 text-sm leading-none">{formatNumber(template.cobraveis)}</dd>
        </div>
        <div>
          <dt className="etiqueta">Custo</dt>
          <dd className="leitura text-custo mt-1 text-sm leading-none">
            {formatCurrency(template.custo, template.moeda)}
          </dd>
        </div>
      </dl>

      {/* Os dois avisos não se somam: quem tem rascunho pendente já está aprovado em produção, e
          quem não está aprovado não tem versão anterior para continuar rodando. */}
      {template.rascunho !== null && template.aprovadoEmProducao && (
        <p className="text-muted-foreground mt-3 text-xs">
          Tem rascunho pendente — o que sai continua sendo a v{template.versao}.
        </p>
      )}
      {!template.aprovadoEmProducao && (
        <p className="text-destructive mt-3 flex items-start gap-1.5 text-xs">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          Sem versão aprovada: nenhuma mensagem sai por este template.
        </p>
      )}
    </button>
  );
}
