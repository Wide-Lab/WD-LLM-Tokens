import { useQuery } from "@tanstack/react-query";

import { Campo } from "@/components/global-filters";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiGet } from "@/lib/api";
import { useFilters } from "@/lib/filters";

const TODOS = "__all__";

/**
 * O filtro de modelo — o controle que é só do painel de LLM.
 *
 * Saiu da barra global quando o painel ganhou três seções: modelo não existe no consolidado nem no
 * WhatsApp, e um controle visível numa tela que o ignora é pior do que controle nenhum — ele
 * promete um recorte que não acontece. Aqui ele entra por `children` do `<GlobalFilters>`, nas
 * três telas de `/llm`, e é lá que o valor é somado aos parâmetros da chamada.
 */
export function FiltroModelo() {
  const { filters, setFilters } = useFilters();

  const modelos = useQuery({
    queryKey: ["modelos"],
    queryFn: () => apiGet<string[]>("/v1/llm/modelos"),
    staleTime: 60_000,
  });

  return (
    <Campo rotulo="Modelo" para="filtro-modelo">
      <Select
        value={filters.modelo || TODOS}
        onValueChange={(v) => setFilters({ modelo: v === TODOS ? "" : v })}
      >
        <SelectTrigger id="filtro-modelo" className="h-9 w-[12rem]">
          <SelectValue placeholder="Todos" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TODOS}>Todos</SelectItem>
          {modelos.data?.map((m) => (
            <SelectItem key={m} value={m}>
              {m}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Campo>
  );
}
