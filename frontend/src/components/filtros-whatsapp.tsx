import { Campo } from "@/components/global-filters";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFilters } from "@/lib/filters";
import { CATEGORIAS, DIRECOES } from "@/lib/grafico";

const TODAS = "__all__";

/**
 * Os dois controles que são só do WhatsApp, como o Modelo é só do LLM.
 *
 * Nenhum dos dois vai ao banco descobrir as opções: categoria são quatro valores fixos do
 * contrato da Meta e direção são dois — pedir ao servidor a lista do que já se sabe seria uma ida
 * de rede para não aprender nada, e ainda esconderia a categoria que ainda não apareceu no período.
 * (O backend tem `/v1/whatsapp/paises` justamente porque país é o contrário: aberto.)
 *
 * Entram por `children` do `<GlobalFilters>`, e quem os soma aos parâmetros é cada painel de
 * `/whatsapp`, via `whatsappToParams`.
 */
export function FiltrosWhatsapp() {
  const { filters, setFilters } = useFilters();

  return (
    <>
      <Campo rotulo="Categoria" para="filtro-categoria">
        <Select
          value={filters.categoria || TODAS}
          onValueChange={(v) => setFilters({ categoria: v === TODAS ? "" : v })}
        >
          <SelectTrigger id="filtro-categoria" className="h-9 w-[11rem]">
            <SelectValue placeholder="Todas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODAS}>Todas</SelectItem>
            {CATEGORIAS.map((c) => (
              <SelectItem key={c.chave} value={c.chave}>
                {c.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Campo>

      <Campo rotulo="Direção" para="filtro-direcao">
        <Select
          value={filters.direcao || TODAS}
          onValueChange={(v) => setFilters({ direcao: v === TODAS ? "" : v })}
        >
          <SelectTrigger id="filtro-direcao" className="h-9 w-[9rem]">
            <SelectValue placeholder="Todas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODAS}>Todas</SelectItem>
            {DIRECOES.map((d) => (
              <SelectItem key={d.chave} value={d.chave}>
                {d.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Campo>
    </>
  );
}
