/**
 * Templates de mensagem do WhatsApp — o cadastro que existe antes da mensagem.
 *
 * O painel inteiro lê fatos: a mensagem saiu, a Meta cobrou, o preço vigente diz quanto. O template
 * é o único registro desta seção que vive **antes** do fato, e é por isso que ele é catálogo e não
 * coluna da mensagem: uma linha aqui é o texto que ainda vai virar milhares de mensagens cobráveis,
 * e mexer nele é a única coisa nesta seção que muda o gasto de amanhã.
 *
 * O que manda no comportamento da tela é que **o estado do template não é nosso**. Editar o corpo
 * não altera o que está rodando: gera versão, que vai para análise da Meta e só entra em vigor
 * quando ela aprova. Um campo de texto que salvasse direto faria alguém mudar a mensagem na segunda
 * e achar que rodou na terça — e o painel só mostraria a diferença no custo, semanas depois.
 */

import { CATEGORIAS } from "@/lib/grafico";

export type EstadoMeta = "aprovado" | "em_analise" | "rejeitado" | "rascunho";

export interface Template {
  id: string;
  /** O `name` da Meta: minúsculo com `_`, e é por ele que a aplicação pede o envio. */
  nome: string;
  /** Uma das três que a Meta aprova — a mesma categoria que decide a tarifa da mensagem. */
  categoria: string;
  /** Quem envia. O catálogo é por WABA, e o painel serve várias aplicações. */
  aplicacao: string;
  idioma: string;
  /** O corpo que roda em produção agora. Editar na tela **não** mexe aqui. */
  corpo: string;
  versao: number;
  /** Corpo novo esperando a Meta. Enquanto existir, quem roda em produção é o `corpo`. */
  rascunho: string | null;
  estado: EstadoMeta;
  /** O `corpo` em produção tem aprovação. Diferente de ter rascunho pendente. */
  aprovadoEmProducao: boolean;
  /** Mensagens enviadas com este template no período do painel. */
  enviadas: number;
  cobraveis: number;
  /** `null` é mensagem cobrável sem preço vigente — o mesmo branco da lista de mensagens. */
  custo: number | null;
  moeda: string;
}

export const ESTADOS: Record<EstadoMeta, string> = {
  aprovado: "Aprovado",
  em_analise: "Em análise",
  rejeitado: "Rejeitado",
  rascunho: "Rascunho",
};

/**
 * As três categorias que têm template, na ordem e nas cores de `CATEGORIAS`.
 *
 * `service` sai da lista pelo mesmo motivo pelo qual sai da tela de preços, mas não pela mesma
 * regra: lá é porque a Meta não cobra, aqui é porque não existe template de serviço — serviço é a
 * resposta livre dentro da janela de atendimento, escrita na hora e sem aprovação nenhuma. Herdar
 * `CATEGORIAS_COBRAVEIS` amarraria duas decisões que hoje coincidem por acidente.
 */
export const CATEGORIAS_DE_TEMPLATE = CATEGORIAS.filter((c) => c.chave !== "service");

/**
 * Catálogo de variáveis.
 *
 * Fixo e exibido na tela porque o que a Meta aprova é o corpo com os marcadores, não o texto final:
 * inventar variável que a aplicação não manda é o jeito mais fácil de aprovar um template que falha
 * no envio — e falha depois, em produção, uma mensagem por vez.
 */
export const VARIAVEIS: { chave: string; descricao: string; exemplo: string }[] = [
  { chave: "cliente", descricao: "Nome de quem recebe", exemplo: "Agência Contraponto" },
  { chave: "protocolo", descricao: "Identificador do atendimento", exemplo: "AT-48221" },
  { chave: "valor", descricao: "Quantia em reais", exemplo: "R$ 1.240,00" },
  { chave: "vencimento", descricao: "Data limite", exemplo: "10/09/2026" },
  { chave: "codigo", descricao: "Código de verificação", exemplo: "417 902" },
  { chave: "atendente", descricao: "Quem assina a mensagem", exemplo: "Marina" },
];

const CHAVES = new Set(VARIAVEIS.map((v) => v.chave));

const MARCADOR = /\{\{(\w+)\}\}/g;

/** Troca `{{cliente}}` pelo valor. O que não conhece fica em pé — some no texto, não em silêncio. */
export function renderizar(texto: string, valores: Record<string, string>): string {
  return texto.replace(MARCADOR, (bruto, chave) => valores[chave] ?? bruto);
}

/** O corpo como o destinatário leria, com os exemplos do catálogo. */
export function previa(texto: string): string {
  return renderizar(texto, Object.fromEntries(VARIAVEIS.map((v) => [v.chave, v.exemplo])));
}

/** Variáveis citadas no corpo que não existem no catálogo. Bloqueiam o envio à Meta. */
export function variaveisDesconhecidas(texto: string): string[] {
  const usadas = [...texto.matchAll(MARCADOR)].map((m) => m[1]);
  return [...new Set(usadas.filter((c) => !CHAVES.has(c)))];
}

/** O custo médio de uma mensagem cobrável deste template. `null` quando não há o que dividir. */
export function custoPorCobravel(t: Template): number | null {
  return t.custo !== null && t.cobraveis > 0 ? t.custo / t.cobraveis : null;
}
