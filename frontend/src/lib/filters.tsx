import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { toISODate } from "./format";

export type Granularidade = "dia" | "semana" | "mes";

export interface GlobalFilters {
  de: string; // ISO date
  ate: string;
  aplicacao: string; // "" = todas
  modelo: string; // "" = todos
  ator: string;
  granularidade: Granularidade;
}

interface FiltersContextValue {
  filters: GlobalFilters;
  setFilters: (f: Partial<GlobalFilters>) => void;
  resetRange: (preset: "hoje" | "7d" | "30d" | "mes") => void;
}

const FiltersContext = createContext<FiltersContextValue | null>(null);

function defaultFilters(): GlobalFilters {
  const today = new Date();
  const from = new Date();
  from.setDate(today.getDate() - 29);
  return {
    de: toISODate(from),
    ate: toISODate(today),
    aplicacao: "",
    modelo: "",
    ator: "",
    granularidade: "dia",
  };
}

export function FiltersProvider({ children }: { children: ReactNode }) {
  const [filters, setFiltersState] = useState<GlobalFilters>(defaultFilters);

  const setFilters = (patch: Partial<GlobalFilters>) =>
    setFiltersState((f) => ({ ...f, ...patch }));

  const resetRange = (preset: "hoje" | "7d" | "30d" | "mes") => {
    const today = new Date();
    let from = new Date();
    if (preset === "hoje") {
      from = today;
    } else if (preset === "7d") {
      from.setDate(today.getDate() - 6);
    } else if (preset === "30d") {
      from.setDate(today.getDate() - 29);
    } else if (preset === "mes") {
      from = new Date(today.getFullYear(), today.getMonth(), 1);
    }
    setFiltersState((f) => ({ ...f, de: toISODate(from), ate: toISODate(today) }));
  };

  const value = useMemo(
    () => ({ filters, setFilters, resetRange }),
    [filters],
  );

  return <FiltersContext.Provider value={value}>{children}</FiltersContext.Provider>;
}

export function useFilters() {
  const ctx = useContext(FiltersContext);
  if (!ctx) throw new Error("useFilters must be inside FiltersProvider");
  return ctx;
}

/**
 * O que as três telas têm em comum — e só isso.
 *
 * `modelo` ficou de fora de propósito: ele não existe no consolidado nem no WhatsApp, e mandar
 * `modelo=` para um endpoint que o ignora é um controle que parece filtrar e não filtra. Quem o
 * manda é só o painel de LLM, somando-o a esta base.
 *
 * No estado do contexto ele continua, porque é conveniente que a escolha sobreviva à ida ao
 * consolidado e à volta.
 */
export function filtersToParams(f: GlobalFilters) {
  return {
    de: f.de || undefined,
    ate: f.ate || undefined,
    aplicacao: f.aplicacao || undefined,
    ator: f.ator || undefined,
  };
}
