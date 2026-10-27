import type { RefObject } from "react";
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

/**
 * Onde o foco volta quando o diálogo fecha.
 *
 * Diálogo controlado e aberto sem `DialogTrigger` — por um botão do cabeçalho, pelo "+" de uma
 * linha, pelo alerta de modelos sem preço — não tem a quem o Radix devolver o foco, e ele cai no
 * `<body>`: quem usa teclado volta ao topo da página a cada cadastro. Quem abre guarda o elemento
 * focado num `ref`, e isto, passado ao `onCloseAutoFocus`, o devolve a ele. Se ele saiu da página
 * nesse meio-tempo (o botão do modelo que acabou de ganhar preço), fica o padrão do Radix.
 */
export function devolverFocoA(origem?: RefObject<HTMLElement | null>) {
  return (e: Event) => {
    const el = origem?.current;
    if (!el || !el.isConnected) return;
    e.preventDefault();
    el.focus();
  };
}
