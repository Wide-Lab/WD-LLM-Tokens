import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiGet } from "@/lib/api";
import { useFilters, type GlobalFilters as Filtros } from "@/lib/filters";
import { CATEGORIAS, DIRECOES } from "@/lib/grafico";
import { cn } from "@/lib/utils";

const ALL = "__all__";

const ATALHOS = [
  { chave: "hoje", rotulo: "Hoje" },
  { chave: "7d", rotulo: "7 dias" },
  { chave: "30d", rotulo: "30 dias" },
  { chave: "mes", rotulo: "Mês" },
] as const;

/**
 * Cada controle vem com o rótulo em cima (13/500, como os campos do wide-ui).
 *
 * A etiqueta é `<label for>` e não um `<label>` envolvendo o controle: o gatilho do Select
 * do Radix é um `<button>`, e botão dentro de label dispara o clique duas vezes.
 *
 * Exportado porque os controles que cada painel pendura em `children` — o Modelo no LLM, a
 * Categoria e a Direção no WhatsApp — precisam nascer com a mesma moldura, ou a barra passa a ter
 * duas gramáticas de campo lado a lado.
 */
export function Campo({
  rotulo,
  para,
  children,
  className,
}: {
  rotulo: string;
  para: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <Label htmlFor={para} className="text-muted-foreground text-[13px]">
        {rotulo}
      </Label>
      {children}
    </div>
  );
}

/** Os filtros que viram chip removível quando têm valor, com o rótulo que o chip mostra. */
type Recorte = "aplicacao" | "ator" | "modelo" | "categoria" | "direcao";

const ROTULOS: Record<Recorte, string> = {
  aplicacao: "Aplicação",
  ator: "Ator",
  modelo: "Modelo",
  categoria: "Categoria",
  direcao: "Direção",
};

function valorLegivel(chave: Recorte, valor: string): string {
  if (chave === "categoria") return CATEGORIAS.find((c) => c.chave === valor)?.nome ?? valor;
  if (chave === "direcao") return DIRECOES.find((d) => d.chave === valor)?.nome ?? valor;
  return valor;
}

/**
 * Os filtros que as três seções do painel têm em comum, como barra de ferramentas do wide-ui:
 * campos de 36px com 8px entre eles e, embaixo, os recortes ativos como chips removíveis.
 *
 * O que é de uma seção só entra por `children` e é renderizado no fim do grupo da direita — é
 * como o Modelo continua existindo no `/llm` sem passar a existir no consolidado, onde ele não
 * filtraria nada. Pelo mesmo motivo os chips desses filtros só aparecem quando a tela diz, em
 * `recortesDaSecao`, que os honra: o valor sobrevive no contexto ao trocar de seção, e um chip
 * de Modelo no consolidado prometeria um recorte que não acontece.
 */
export function GlobalFilters({
  children,
  recortesDaSecao = [],
}: {
  children?: ReactNode;
  recortesDaSecao?: Array<"modelo" | "categoria" | "direcao">;
}) {
  const { filters, setFilters, resetRange } = useFilters();

  const aplicacoes = useQuery({
    queryKey: ["aplicacoes"],
    queryFn: () => apiGet<string[]>("/v1/aplicacoes"),
    staleTime: 60_000,
  });

  const ativos = (["aplicacao", "ator", ...recortesDaSecao] as Recorte[]).filter(
    (k) => (filters[k as keyof Filtros] as string) !== "",
  );

  return (
    <section aria-label="Filtros do painel" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-2">
        <Campo rotulo="De" para="filtro-de">
          <Input
            id="filtro-de"
            type="date"
            value={filters.de}
            onChange={(e) => setFilters({ de: e.target.value })}
            className="w-[9.5rem]"
          />
        </Campo>
        <Campo rotulo="Até" para="filtro-ate">
          <Input
            id="filtro-ate"
            type="date"
            value={filters.ate}
            onChange={(e) => setFilters({ ate: e.target.value })}
            className="w-[9.5rem]"
          />
        </Campo>

        {/* Atalhos de período: um grupo só, emendado, para ler como um seletor e não como
          quatro botões avulsos. */}
        <div className="border-input bg-surface flex h-9 items-stretch overflow-hidden rounded-[var(--wu-radius)] border">
          {ATALHOS.map((a, i) => (
            <Button
              key={a.chave}
              variant="ghost"
              onClick={() => resetRange(a.chave)}
              className={cn(
                "h-full rounded-none px-3 text-[13px]",
                i > 0 && "border-input border-l",
              )}
            >
              {a.rotulo}
            </Button>
          ))}
        </div>

        <div className="contents">
          <Campo rotulo="Aplicação" para="filtro-aplicacao">
            <Select
              value={filters.aplicacao || ALL}
              onValueChange={(v) => setFilters({ aplicacao: v === ALL ? "" : v })}
            >
              <SelectTrigger id="filtro-aplicacao" className="w-[11rem]">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todas</SelectItem>
                {aplicacoes.data?.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Campo>

          <Campo rotulo="Ator" para="filtro-ator">
            <Input
              id="filtro-ator"
              value={filters.ator}
              onChange={(e) => setFilters({ ator: e.target.value })}
              placeholder="Nome ou número"
              className="w-[11rem]"
            />
          </Campo>

          <Campo rotulo="Granularidade" para="filtro-granularidade">
            <Select
              value={filters.granularidade}
              onValueChange={(v) => setFilters({ granularidade: v as "dia" | "semana" | "mes" })}
            >
              <SelectTrigger id="filtro-granularidade" className="w-[8rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dia">Dia</SelectItem>
                <SelectItem value="semana">Semana</SelectItem>
                <SelectItem value="mes">Mês</SelectItem>
              </SelectContent>
            </Select>
          </Campo>

          {children}
        </div>
      </div>

      {ativos.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {ativos.map((k) => (
            <span
              key={k}
              className="border-line-strong bg-surface inline-flex h-7 items-center gap-1 rounded-[var(--wu-radius-sm)] border pr-1 pl-2.5 text-[12.5px]"
            >
              <span className="text-muted-foreground">{ROTULOS[k]}:</span>
              <span className="text-foreground max-w-[14rem] truncate font-semibold">
                {valorLegivel(k, filters[k as keyof Filtros] as string)}
              </span>
              <button
                type="button"
                onClick={() => setFilters({ [k]: "" })}
                className="text-subtle hover:bg-hover hover:text-foreground grid h-5 w-5 place-items-center rounded"
                aria-label={`Remover filtro ${ROTULOS[k]}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
          <Button
            variant="link"
            className="h-7 px-1"
            onClick={() => setFilters(Object.fromEntries(ativos.map((k) => [k, ""])))}
          >
            Limpar filtros
          </Button>
        </div>
      )}
    </section>
  );
}
