import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Se há texto selecionado na página. Linha clicável consulta isto antes de agir: o clique que
 * termina uma seleção (copiar um número, um nome de ator) é cópia, não pedido de abrir.
 */
export function haTextoSelecionado(): boolean {
  return (window.getSelection()?.toString() ?? "") !== "";
}
