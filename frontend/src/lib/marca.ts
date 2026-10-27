import type { CSSProperties } from "react";

import { SURFACE_DARK, SURFACE_LIGHT, ink, textOn } from "@/styles/wide-ui/accent";

/**
 * O accent do painel: o magenta do logo da Widelab.
 *
 * Marca lugar e ação — botão primário, item ativo da barra, aba ativa, link, foco — e nada mais.
 * Nunca pinta dado, gráfico ou status: dado tem as séries (`src/lib/grafico.ts`), status tem os
 * tons da `StatusPill`.
 */
export const COR_DA_MARCA = "#E30D4D";

/**
 * As mesmas quatro variáveis que `applyAccent` grava, calculadas sem `document`.
 *
 * Saem no `style` do `<html>` já no SSR para a primeira pintura vir com o magenta; sem isso a
 * página nasce com o accent neutro do `tokens.css` e troca de cor quando o React hidrata. O
 * `applyAccent` do boot continua sendo quem manda no cliente — aqui é só a primeira pintura.
 */
export function variaveisDaMarca(cor: string): CSSProperties {
  return {
    "--wu-brand": cor,
    "--wu-on-brand": textOn(cor),
    "--wu-brand-ink-light": ink(cor, SURFACE_LIGHT, false),
    "--wu-brand-ink-dark": ink(cor, SURFACE_DARK, true),
  } as CSSProperties;
}
