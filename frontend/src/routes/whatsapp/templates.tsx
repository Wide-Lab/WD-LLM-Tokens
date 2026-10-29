import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Plus, TriangleAlert } from "lucide-react";

import { CabecalhoDaPagina } from "@/components/cabecalho-da-pagina";
import { DialogoTemplate } from "@/components/dialogo-template";
import { ErrorBox } from "@/components/empty-states";
import { PainelCard } from "@/components/painel-card";
import { SeloEstadoMeta } from "@/components/selo-estado-meta";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatNumber } from "@/lib/format";
import { CATEGORIAS_DE_TEMPLATE, type Template } from "@/lib/templates";
import { criarTemplate, listarTemplates } from "@/lib/templates-mock";
import { haTextoSelecionado } from "@/lib/utils";

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
 * O uso que aparece na linha é de uma janela fixa, e está rotulado como tal. Um quadro por categoria,
 * porque a categoria é o que decide a tarifa de cada mensagem do template.
 */
function Templates() {
  const [editando, setEditando] = useState<Template | null>(null);
  const queryClient = useQueryClient();

  // Quem abriu o diálogo — a linha, o botão da categoria —, para o foco voltar a ele ao fechar. O
  // diálogo não tem `DialogTrigger`, e sem isto o foco cairia no `<body>`.
  const origemDoFoco = useRef<HTMLElement | null>(null);
  const guardarOrigem = () => {
    origemDoFoco.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
  };

  const q = useQuery({ queryKey: CHAVE, queryFn: listarTemplates });

  const criar = useMutation({
    mutationFn: (categoria: string) => criarTemplate(categoria),
    onSuccess: (template) => {
      void queryClient.invalidateQueries({ queryKey: CHAVE });
      // Abre já no editor: um template vazio no fim da lista deixaria o clique seguinte por conta de
      // quem criou, e o que falta é justamente o corpo.
      setEditando(template);
    },
  });

  // O template aberto vem sempre da lista, e não do estado: depois de salvar, o objeto guardado no
  // clique é a versão anterior, e o diálogo seguiria mostrando o corpo de antes da escrita.
  const aberto = editando ? (q.data?.find((t) => t.id === editando.id) ?? editando) : null;

  const abrir = (t: Template) => {
    guardarOrigem();
    setEditando(t);
  };

  return (
    <div className="flex flex-col gap-4">
      <CabecalhoDaPagina
        titulo="Templates"
        subtitulo="O texto que a Meta aprova antes de virar mensagem, e quanto cada um gastou nos últimos 30 dias"
      />

      {q.error ? (
        <ErrorBox error={q.error} onRetry={() => void q.refetch()} />
      ) : (
        CATEGORIAS_DE_TEMPLATE.map((categoria) => {
          // Ordenado por custo, do maior para o menor: num painel de custos a primeira pergunta
          // sobre um catálogo é qual texto está puxando a conta. Quem não gastou nada desce.
          const daCategoria = (q.data ?? [])
            .filter((t) => t.categoria === categoria.chave)
            .sort((a, b) => (b.custo ?? 0) - (a.custo ?? 0));

          return (
            <PainelCard
              key={categoria.chave}
              title={categoria.nome}
              hint={
                q.isLoading
                  ? undefined
                  : `${daCategoria.length} ${daCategoria.length === 1 ? "template" : "templates"}`
              }
              action={
                <Button
                  variant="outline"
                  size="sm"
                  disabled={criar.isPending}
                  onClick={() => {
                    guardarOrigem();
                    criar.mutate(categoria.chave);
                  }}
                >
                  <Plus />
                  Novo template
                </Button>
              }
              bleed
              loading={q.isLoading}
              empty={daCategoria.length === 0}
              emptyMessage={`Nenhum template de ${categoria.nome.toLowerCase()}. Sem ele, a aplicação não tem o que enviar nesta categoria fora da janela de atendimento.`}
            >
              {/* Abaixo de 700px a tabela vira lista de cartões: os mesmos fatos, sem rolagem lateral. */}
              <ul className="divide-line divide-y min-[700px]:hidden">
                {daCategoria.map((t) => (
                  <TemplateCartao key={t.id} template={t} onAbrir={abrir} />
                ))}
              </ul>
              <div className="hidden min-[700px]:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-4">Template</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Enviadas</TableHead>
                      <TableHead className="text-right">Cobráveis</TableHead>
                      <TableHead className="pr-4 text-right">Custo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {daCategoria.map((t) => (
                      <TemplateLinha key={t.id} template={t} onAbrir={abrir} />
                    ))}
                  </TableBody>
                </Table>
              </div>
            </PainelCard>
          );
        })
      )}

      <DialogoTemplate
        template={aberto}
        aberto={aberto !== null}
        onOpenChange={(v) => !v && setEditando(null)}
        origemDoFoco={origemDoFoco}
      />
    </div>
  );
}

/** O corpo que a linha mostra: o que o autor está escrevendo, se ainda não há nada em produção. */
function corpoDaLinha(t: Template): string {
  return t.rascunho !== null && !t.aprovadoEmProducao ? t.rascunho : t.corpo;
}

/** Quebras e espaços viram um espaço só: a prévia é uma linha, e o corte fica por conta do CSS. */
function umaLinha(texto: string): string {
  return texto.replace(/\s+/g, " ").trim();
}

/**
 * O custo do template. `null` com cobráveis só acontece quando falta o preço vigente da categoria:
 * as mensagens saem da soma do painel em silêncio, então a falta sai como pílula "Sem preço" (o
 * mesmo tom do `/whatsapp/mensagens`), e não como um traço mudo. O diálogo repete a frase, porque
 * `title` não existe no toque nem no teclado.
 */
function CelulaCusto({ template }: { template: Template }) {
  if (template.cobraveis > 0 && template.custo === null) {
    return (
      <StatusPill
        tom="pending"
        className="cursor-help"
        title={`Sem preço vigente para ${template.categoria} no período: as ${formatNumber(template.cobraveis)} mensagens cobráveis ficam fora da soma do painel.`}
      >
        Sem preço
      </StatusPill>
    );
  }
  return <>{formatCurrency(template.custo, template.moeda)}</>;
}

/**
 * Os dois avisos não se somam: quem tem rascunho pendente já está aprovado em produção, e quem não
 * está aprovado não tem versão anterior para continuar rodando. O segundo é condição que bloqueia, e
 * por isso sai em `danger`; o primeiro só informa.
 */
function Avisos({ template }: { template: Template }) {
  if (template.rascunho !== null && template.aprovadoEmProducao) {
    return (
      <p className="text-muted-foreground mt-1 text-xs">
        Tem rascunho pendente — o que sai continua sendo a v{template.versao}.
      </p>
    );
  }
  if (!template.aprovadoEmProducao) {
    return (
      <p className="text-danger mt-1 flex items-start gap-1.5 text-xs">
        <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        Sem versão aprovada: nenhuma mensagem sai por este template.
      </p>
    );
  }
  return null;
}

/**
 * O que identifica o template numa linha: nome, versão, de quem é e o começo do corpo.
 *
 * O corpo vem numa linha só porque a pergunta do relance é "qual dos seis é este", não "qual é o
 * texto inteiro" — para isso serve o clique. O nome é o `name` da Meta, o id técnico literal, e por
 * isso é a única coisa em mono. É também o botão que abre o editor: a linha inteira abre, mas uma
 * `<tr>` com `onClick` não é focável, e este é o caminho do teclado e do leitor de tela.
 */
function Identificacao({
  template,
  onAbrir,
}: {
  template: Template;
  onAbrir: (t: Template) => void;
}) {
  const corpo = umaLinha(corpoDaLinha(template));

  return (
    <div className="min-w-0">
      <div className="flex min-w-0 items-baseline gap-2">
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={(e) => {
            // Para aqui: o resto da linha também abre, e sem isto o clique abriria duas vezes.
            e.stopPropagation();
            onAbrir(template);
          }}
          className="text-foreground min-w-0 cursor-pointer truncate rounded-[var(--wu-radius-sm)] text-left font-mono text-[13px] font-medium hover:underline"
        >
          {template.nome}
        </button>
        {template.versao > 0 && (
          <span className="text-subtle shrink-0 text-xs">v{template.versao}</span>
        )}
      </div>
      <div className="text-subtle truncate text-xs">
        {template.aplicacao} · {template.idioma}
      </div>
      <p className="text-muted-foreground mt-1 truncate text-xs">
        {corpo === "" ? "Sem corpo ainda." : corpo}
      </p>
      <Avisos template={template} />
    </div>
  );
}

function TemplateLinha({
  template,
  onAbrir,
}: {
  template: Template;
  onAbrir: (t: Template) => void;
}) {
  return (
    // A linha inteira abre o editor, como no wide-ui. Clique que terminou uma seleção de texto é
    // cópia, não pedido de abrir.
    <TableRow
      onClick={() => {
        if (haTextoSelecionado()) return;
        onAbrir(template);
      }}
      className="cursor-pointer"
    >
      {/* `w-full max-w-0`: a coluna absorve a sobra e o `truncate` corta dentro dela, em vez de
          empurrar os números para fora da tabela quando o corpo é longo. */}
      <TableCell className="w-full max-w-0 pl-4">
        <Identificacao template={template} onAbrir={onAbrir} />
      </TableCell>
      <TableCell>
        <SeloEstadoMeta estado={template.estado} />
      </TableCell>
      <TableCell className="text-muted-foreground text-right whitespace-nowrap">
        {formatNumber(template.enviadas)}
      </TableCell>
      <TableCell className="text-muted-foreground text-right whitespace-nowrap">
        {formatNumber(template.cobraveis)}
      </TableCell>
      <TableCell className="text-foreground pr-4 text-right font-medium whitespace-nowrap">
        <CelulaCusto template={template} />
      </TableCell>
    </TableRow>
  );
}

/** A mesma linha abaixo de 700px: identificação e estado em cima, os números numa linha meta. */
function TemplateCartao({
  template,
  onAbrir,
}: {
  template: Template;
  onAbrir: (t: Template) => void;
}) {
  return (
    // O cartão inteiro abre, como a linha da tabela; o botão do nome continua sendo o caminho do
    // teclado.
    <li
      onClick={() => {
        if (haTextoSelecionado()) return;
        onAbrir(template);
      }}
      className="flex cursor-pointer flex-col gap-2 px-4 py-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Identificacao template={template} onAbrir={onAbrir} />
        </div>
        <SeloEstadoMeta estado={template.estado} />
      </div>
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span className="text-subtle">
          {formatNumber(template.enviadas)} enviadas · {formatNumber(template.cobraveis)} cobráveis
        </span>
        <span className="text-foreground shrink-0 text-[13px] font-medium">
          <CelulaCusto template={template} />
        </span>
      </div>
    </li>
  );
}
