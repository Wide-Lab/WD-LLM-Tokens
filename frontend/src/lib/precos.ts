/**
 * O que as duas telas de escrita de preço precisam saber igual.
 *
 * Mora aqui, e não no diálogo onde nasceu, porque a importação em lote faz as mesmas três coisas que
 * o cadastro de uma linha: recusa `service`, traduz o erro do backend e derruba as consultas de
 * custo. Duplicar a lista de consultas seria o pior dos casos — ela falha em silêncio.
 */

import type { QueryClient } from "@tanstack/react-query";

import { ApiError } from "@/lib/api";
import { CATEGORIAS } from "@/lib/grafico";

/** As três que se pode cobrar. `service` fica de fora: a Meta não cobra, e o backend recusa. */
export const CATEGORIAS_COBRAVEIS = CATEGORIAS.filter((c) => c.chave !== "service");

export function mensagemDoErro(e: unknown): string {
  return e instanceof ApiError || e instanceof Error ? e.message : "Não foi possível salvar.";
}

/**
 * As consultas que mostram custo, por origem — o que fica velho quando um preço entra.
 *
 * A lista é explícita porque o custo não é gravado em lugar nenhum: ele é recalculado a cada
 * `GET`, então um preço novo muda a resposta de toda tela de dinheiro, e não só a de preços. E
 * precisa ser exata: `invalidateQueries` casa elemento a elemento, então uma chave pela metade
 * (`metricas`, para `["metricas-llm", params]`) não invalida nada e falha em silêncio — a tela
 * seguiria mostrando o total do preço anterior.
 */
const LEITURAS_DE_CUSTO = {
  llm: ["metricas-llm", "eventos-llm", "conversa", "consolidado"],
  whatsapp: ["metricas-whatsapp", "mensagens-whatsapp", "consolidado"],
} as const;

export type OrigemDeCusto = keyof typeof LEITURAS_DE_CUSTO;

export function invalidarCusto(queryClient: QueryClient, origem: OrigemDeCusto) {
  for (const chave of LEITURAS_DE_CUSTO[origem]) {
    void queryClient.invalidateQueries({ queryKey: [chave] });
  }
}
