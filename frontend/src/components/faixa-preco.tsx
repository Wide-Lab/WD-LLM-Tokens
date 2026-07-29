import { useState, type ReactNode } from "react";
import { ChevronRight, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { formatDateOnly } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Uma vigência já formatada para a tela: a data em que passou a valer e as tarifas dela. */
export interface Vigencia {
  id: string;
  /** ISO sem hora, como vem do backend. */
  desde: string;
  leituras: { rotulo: string; valor: string }[];
}

/** Dias desde a época, a partir da string ISO — sem `new Date(iso)`, que desloca o fuso. */
function emDias(iso: string): number {
  const [ano, mes, dia] = iso.split("-").map(Number);
  return Date.UTC(ano, mes - 1, dia) / 86_400_000;
}

function hojeEmDias(): number {
  const hoje = new Date();
  return Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()) / 86_400_000;
}

/**
 * A régua de vigência: a assinatura desta tela.
 *
 * Ela existe porque `preco_modelo` é a única tabela do painel em que uma linha não é um fato, é um
 * **trecho de tempo** — e é o trecho, não o valor, que decide qual evento sai por quanto. Ver as
 * vigências como faixas proporcionais responde de relance o que uma tabela responde lendo linha
 * por linha: há quanto tempo o preço atual vale, e se o anterior valeu uma semana ou dois anos.
 *
 * Só aparece com duas vigências ou mais. Com uma só, uma faixa cheia não compara nada.
 */
function ReguaDeVigencia({ vigencias }: { vigencias: Vigencia[] }) {
  const fim = hojeEmDias();

  return (
    <div className="px-5 pb-4">
      <div className="flex h-1.5 w-full gap-px" aria-hidden="true">
        {vigencias.map((v, i) => {
          const proxima = i + 1 < vigencias.length ? emDias(vigencias[i + 1].desde) : fim;
          const duracao = Math.max(proxima - emDias(v.desde), 1);
          const atual = i === vigencias.length - 1;

          return (
            <span
              key={v.id}
              // `flexBasis: 0` com `flexGrow` proporcional: a largura sai da duração, não do
              // conteúdo. O mínimo em pixel evita que uma vigência de um dia suma da régua.
              style={{ flexGrow: duracao, flexBasis: 0, minWidth: "0.375rem" }}
              className={cn("rounded-[1px]", atual ? "bg-custo" : "bg-custo-suave")}
            />
          );
        })}
      </div>
      <div className="text-muted-foreground mt-1.5 flex justify-between font-mono text-[0.6875rem]">
        <span>{formatDateOnly(vigencias[0].desde)}</span>
        <span>hoje</span>
      </div>
      <span className="sr-only">
        {vigencias.length} vigências, da mais antiga em {formatDateOnly(vigencias[0].desde)} até a
        atual, que vale desde {formatDateOnly(vigencias[vigencias.length - 1].desde)}.
      </span>
    </div>
  );
}

/**
 * Um preço na tela: o que vale hoje em leitura grande, e o resto como história.
 *
 * A unidade da tela não é a linha da tabela, é **o que está sendo precificado** — um modelo, um par
 * categoria/país. Listar as linhas cruas repetiria o mesmo modelo cinco vezes e enterraria a
 * pergunta que se faz aqui ("quanto custa hoje?") no meio do histórico, que é a pergunta rara.
 */
export function FaixaDePreco({
  titulo,
  distintivo,
  subtitulo,
  unidade,
  vigencias,
  onNovoPreco,
}: {
  titulo: string;
  /** Marca de categoria ou provedor que precisa de cor própria. */
  distintivo?: ReactNode;
  subtitulo?: string | null;
  /** O que os números querem dizer: "por milhão de tokens", "por mensagem". */
  unidade: string;
  /** Todas as vigências deste item, da mais nova para a mais antiga (a ordem do backend). */
  vigencias: Vigencia[];
  onNovoPreco: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const hoje = hojeEmDias();

  // "Vigente" é a de maior `desde` que já começou — a mesma regra do `LEFT JOIN LATERAL` que
  // calcula o custo. Pegar simplesmente a mais recente mostraria um preço agendado para o mês que
  // vem como se ele já estivesse valendo.
  const futuras = vigencias.filter((v) => emDias(v.desde) > hoje);
  const valendo = vigencias.filter((v) => emDias(v.desde) <= hoje);
  const atual = valendo[0];
  const anteriores = valendo.slice(1);

  return (
    <section className="bg-card flex flex-col rounded-xl border shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b px-5 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {distintivo}
          <div className="min-w-0">
            <div className="truncate font-mono text-sm font-medium">{titulo}</div>
            {subtitulo && <div className="etiqueta mt-1 truncate">{subtitulo}</div>}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onNovoPreco} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Novo preço
        </Button>
      </header>

      <div className="px-5 py-4">
        {atual ? (
          <>
            <div className="etiqueta">Vigente desde {formatDateOnly(atual.desde)}</div>
            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
              {atual.leituras.map((l) => (
                <div key={l.rotulo}>
                  <dt className="etiqueta">{l.rotulo}</dt>
                  <dd className="leitura text-custo mt-1.5 text-lg leading-none">{l.valor}</dd>
                </div>
              ))}
            </dl>
            <div className="text-muted-foreground mt-3 text-xs">{unidade}</div>
          </>
        ) : (
          // Só preço agendado: nada aqui tem custo ainda, e é melhor a tela dizer isso do que
          // exibir a tarifa futura como se ela já valesse.
          <div className="border-border rounded-sm border border-dashed px-4 py-3">
            <div className="etiqueta">Sem preço vigente</div>
            <p className="text-muted-foreground mt-1.5 text-sm">
              O primeiro preço só começa em {formatDateOnly(futuras[futuras.length - 1].desde)}. Até
              lá, o custo destes eventos fica em branco no painel.
            </p>
          </div>
        )}

        {futuras.length > 0 && atual && (
          <div className="border-custo-suave mt-4 border-l-2 pl-3">
            <div className="etiqueta">Agendado</div>
            <ul className="mt-1.5 space-y-1">
              {futuras.map((v) => (
                <li key={v.id} className="font-mono text-xs">
                  <span className="text-muted-foreground">
                    a partir de {formatDateOnly(v.desde)} ·{" "}
                  </span>
                  {v.leituras.map((l) => `${l.rotulo} ${l.valor}`).join("  ")}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {anteriores.length > 0 && (
        <Collapsible open={aberto} onOpenChange={setAberto}>
          <ReguaDeVigencia vigencias={[...valendo].reverse()} />
          <CollapsibleTrigger className="text-muted-foreground hover:text-foreground flex w-full items-center gap-1.5 border-t px-5 py-2.5 text-left text-xs transition-colors">
            <ChevronRight
              className={cn("h-3.5 w-3.5 transition-transform", aberto && "rotate-90")}
            />
            {anteriores.length === 1
              ? "1 vigência anterior"
              : `${anteriores.length} vigências anteriores`}
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="border-t">
              {anteriores.map((v) => (
                <div
                  key={v.id}
                  className="flex flex-wrap items-baseline gap-x-5 gap-y-1 border-b px-5 py-2.5 last:border-b-0"
                >
                  <span className="text-muted-foreground w-24 shrink-0 font-mono text-xs">
                    {formatDateOnly(v.desde)}
                  </span>
                  {v.leituras.map((l) => (
                    <span key={l.rotulo} className="flex items-baseline gap-1.5">
                      <span className="etiqueta">{l.rotulo}</span>
                      <span className="leitura text-sm">{l.valor}</span>
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </section>
  );
}
