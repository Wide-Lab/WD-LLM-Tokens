import { useQuery } from "@tanstack/react-query";
import { CalendarDays } from "lucide-react";
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

const ALL = "__all__";

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
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 shadow-sm">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">De</Label>
          <div className="relative">
            <CalendarDays className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="date"
              value={filters.de}
              onChange={(e) => setFilters({ de: e.target.value })}
              className="h-9 w-[150px] pl-7"
            />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Até</Label>
          <div className="relative">
            <CalendarDays className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="date"
              value={filters.ate}
              onChange={(e) => setFilters({ ate: e.target.value })}
              className="h-9 w-[150px] pl-7"
            />
          </div>
        </div>

        <div className="flex items-end gap-1">
          <Button variant="outline" size="sm" onClick={() => resetRange("hoje")}>
            Hoje
          </Button>
          <Button variant="outline" size="sm" onClick={() => resetRange("7d")}>
            7 dias
          </Button>
          <Button variant="outline" size="sm" onClick={() => resetRange("30d")}>
            30 dias
          </Button>
          <Button variant="outline" size="sm" onClick={() => resetRange("mes")}>
            Mês
          </Button>
        </div>

        <div className="ml-auto flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Aplicação</Label>
            <Select
              value={filters.aplicacao || ALL}
              onValueChange={(v) => setFilters({ aplicacao: v === ALL ? "" : v })}
            >
              <SelectTrigger className="h-9 w-[180px]">
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
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Modelo</Label>
            <Select
              value={filters.modelo || ALL}
              onValueChange={(v) => setFilters({ modelo: v === ALL ? "" : v })}
            >
              <SelectTrigger className="h-9 w-[200px]">
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
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Ator</Label>
            <Input
              value={filters.ator}
              onChange={(e) => setFilters({ ator: e.target.value })}
              placeholder="Buscar ator…"
              className="h-9 w-[180px]"
            />
          </div>

          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Granularidade</Label>
            <Select
              value={filters.granularidade}
              onValueChange={(v) =>
                setFilters({ granularidade: v as "dia" | "semana" | "mes" })
              }
            >
              <SelectTrigger className="h-9 w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dia">Dia</SelectItem>
                <SelectItem value="semana">Semana</SelectItem>
                <SelectItem value="mes">Mês</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
}
