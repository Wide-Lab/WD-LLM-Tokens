import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/format";

/**
 * O rodapé de uma lista paginada por `offset`: o intervalo à esquerda, "Anterior · Página x de y ·
 * Próxima" à direita. Quem usa só o mostra quando há linhas — carregando, com erro ou vazio ele
 * diria "Página 1 de 1" embaixo de um cartão que diz outra coisa.
 */
export function Paginacao({
  offset,
  total,
  tamanho,
  ocupado,
  onOffset,
}: {
  offset: number;
  total: number;
  /** Linhas por página — o `limite` da consulta. */
  tamanho: number;
  ocupado: boolean;
  onOffset: (o: number) => void;
}) {
  const pagina = Math.floor(offset / tamanho) + 1;
  const paginas = Math.max(1, Math.ceil(total / tamanho));

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="text-muted-foreground text-[13px]">
        {total > 0
          ? `${formatNumber(offset + 1)}–${formatNumber(
              Math.min(offset + tamanho, total),
            )} de ${formatNumber(total)}`
          : "Nenhum resultado"}
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onOffset(Math.max(0, offset - tamanho))}
          disabled={offset === 0 || ocupado}
        >
          <ChevronLeft className="h-4 w-4" />
          Anterior
        </Button>
        <div className="text-muted-foreground px-1 text-[13px]">
          Página {formatNumber(pagina)} de {formatNumber(paginas)}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onOffset(offset + tamanho)}
          disabled={offset + tamanho >= total || ocupado}
        >
          Próxima
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
