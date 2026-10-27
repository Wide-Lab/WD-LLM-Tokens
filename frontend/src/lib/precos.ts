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

/** `2026-01-31` dentro da frase do backend, para virar `31/01/2026` como no resto da tela. */
const DATA_ISO = /\b(\d{4})-(\d{2})-(\d{2})\b/g;

/**
 * A recusa do backend em palavras que dizem o que fazer.
 *
 * O texto do `409` e do `422` de regra (categoria desconhecida, `service`) já é escrito para gente
 * e passa adiante, só com a data no formato da tela; o `409` ganha o conserto, porque a frase do
 * backend diz o que houve e não o que fazer. O resto — rede, sessão, `5xx`, o "Payload inválido."
 * genérico — não diz nada a quem está na tela, e é trocado por uma frase que diz.
 */
export function mensagemDoErro(e: unknown): string {
  if (!(e instanceof ApiError)) return "Não foi possível salvar. Tente de novo.";
  if (e.status === 0) return "Sem conexão com o servidor. Confira a rede e tente de novo.";
  if (e.status === 401) return "A sessão expirou. Entre de novo e repita o cadastro.";
  if (e.status === 403)
    return "Esta sessão não pode cadastrar preço. Peça acesso a um administrador.";
  if (e.status >= 500) return "O servidor não conseguiu salvar agora. Tente de novo em instantes.";
  if (e.message === "Payload inválido." || /^Erro \d+$/.test(e.message)) {
    return "O servidor recusou algum valor. Confira os campos e tente de novo.";
  }
  const texto = e.message.replace(DATA_ISO, "$3/$2/$1");
  return e.status === 409
    ? `${texto} Cada data só aceita um preço: escolha outra data de vigência.`
    : texto;
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
