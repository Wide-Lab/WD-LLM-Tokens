import { useQuery } from "@tanstack/react-query";
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
import { useFilters } from "@/lib/filters";
import { cn } from "@/lib/utils";

const ALL = "__all__";

const ATALHOS = [
  { chave: "hoje", rotulo: "Hoje" },
  { chave: "7d", rotulo: "7 dias" },
  { chave: "30d", rotulo: "30 dias" },
  { chave: "mes", rotulo: "Mês" },
] as const;

/**
 * Cada controle vem com sua etiqueta em cima, no mesmo alfabeto do resto do painel.
 *
 * A etiqueta é `<label for>` e não um `<label>` envolvendo o controle: o gatilho do Select
 * do Radix é um `<button>`, e botão dentro de label dispara o clique duas vezes.
 */
function Campo({
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
      <Label htmlFor={para} className="etiqueta">
        {rotulo}
      </Label>
      {children}
    </div>
  );
}

export function GlobalFilters() {
  const { filters, setFilters, resetRange } = useFilters();

  const aplicacoes = useQuery({
    queryKey: ["aplicacoes"],
    queryFn: () => apiGet<string[]>("/v1/aplicacoes"),
    staleTime: 60_000,
  });

  const modelos = useQuery({
    queryKey: ["modelos"],
    queryFn: () => apiGet<string[]>("/v1/modelos"),
    staleTime: 60_000,
  });

  return (
    <section
      aria-label="Filtros do painel"
      className="bg-card flex flex-wrap items-end gap-x-4 gap-y-3 rounded-xl border p-4 shadow-sm"
    >
      <Campo rotulo="De" para="filtro-de">
        <Input
          id="filtro-de"
          type="date"
          value={filters.de}
          onChange={(e) => setFilters({ de: e.target.value })}
          className="h-9 w-[9.5rem] font-mono text-xs"
        />
      </Campo>
      <Campo rotulo="Até" para="filtro-ate">
        <Input
          id="filtro-ate"
          type="date"
          value={filters.ate}
          onChange={(e) => setFilters({ ate: e.target.value })}
          className="h-9 w-[9.5rem] font-mono text-xs"
        />
      </Campo>

      {/* Atalhos de período: um grupo só, emendado, para ler como um seletor e não como
          quatro botões avulsos. */}
      <div className="border-input flex h-9 items-stretch overflow-hidden rounded-md border">
        {ATALHOS.map((a, i) => (
          <Button
            key={a.chave}
            variant="ghost"
            size="sm"
            onClick={() => resetRange(a.chave)}
            className={cn(
              "h-full rounded-none px-3 text-xs font-medium",
              i > 0 && "border-input border-l",
            )}
          >
            {a.rotulo}
          </Button>
        ))}
      </div>

      <div className="ml-auto flex flex-wrap items-end gap-x-4 gap-y-3">
        <Campo rotulo="Aplicação" para="filtro-aplicacao">
          <Select
            value={filters.aplicacao || ALL}
            onValueChange={(v) => setFilters({ aplicacao: v === ALL ? "" : v })}
          >
            <SelectTrigger id="filtro-aplicacao" className="h-9 w-[11rem]">
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

        <Campo rotulo="Modelo" para="filtro-modelo">
          <Select
            value={filters.modelo || ALL}
            onValueChange={(v) => setFilters({ modelo: v === ALL ? "" : v })}
          >
            <SelectTrigger id="filtro-modelo" className="h-9 w-[12rem]">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos</SelectItem>
              {modelos.data?.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
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
            placeholder="Buscar ator"
            className="h-9 w-[11rem]"
          />
        </Campo>

        <Campo rotulo="Granularidade" para="filtro-granularidade">
          <Select
            value={filters.granularidade}
            onValueChange={(v) => setFilters({ granularidade: v as "dia" | "semana" | "mes" })}
          >
            <SelectTrigger id="filtro-granularidade" className="h-9 w-[8rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dia">Dia</SelectItem>
              <SelectItem value="semana">Semana</SelectItem>
              <SelectItem value="mes">Mês</SelectItem>
            </SelectContent>
          </Select>
        </Campo>
      </div>
    </section>
  );
}
