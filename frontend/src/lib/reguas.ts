/**
 * Réguas de cobrança — o cadastro que decide **quando** o disparo sai.
 *
 * Disparos tem duas metades e esta é a primeira. A régua diz o ritmo; a carteira (`lib/clientes.ts`)
 * diz quem segue esse ritmo. As duas mexem no gasto de amanhã pelo lado do volume, como o template
 * mexe pelo lado da tarifa — mudar um `D+9` para `D+2` não muda o preço de nenhuma mensagem e muda
 * quantas mensagens existem.
 *
 * Um cadastro só, em dois níveis. A **régua** é um conjunto nomeado de etapas; a **etapa** é o
 * registro com âncora, deslocamento e contagem. Exatamente uma régua é a padrão, e ela vale para
 * todo cliente sem atribuição — o fallback inteiro cabe num campo do vínculo porque **a unidade de
 * substituição é a régua, não a etapa**. A alternativa (etapa global, régua escolhendo quais usar)
 * obriga o deslocamento a morar na associação no primeiro dia em que alguém quiser D+4 onde a
 * padrão tem D+2, e daí vira override campo a campo.
 *
 * Perfil de cliente não existe como conceito à parte: uma régua com muitos clientes atribuídos *é*
 * o perfil, e o critério que ninguém sabe escrever vira a lista de quem está nela.
 *
 * `template` é o `name` da Meta, do catálogo de `/whatsapp/templates`, por **referência** e não com
 * o texto embutido: template é recurso escasso, porque cada versão passa por uma análise. Mudar o
 * ritmo de uma régua não pode custar uma aprovação nova.
 */

import type { Template } from "@/lib/templates";

/** De que data a etapa se pendura. Vencimento é o caso comum; emissão serve a prazo longo. */
export type Ancora = "vencimento" | "emissao";

/** Como o deslocamento conta. É o campo que a coluna "cai em" existe para tornar visível. */
export type Contagem = "uteis" | "corridos";

/** O que vai junto da mensagem. Em carteira não há boleto: o cliente paga por depósito. */
export type Anexo = "boleto+nf" | "nf" | "nenhum";

export const ANCORAS: Record<Ancora, string> = {
  vencimento: "Vencimento",
  emissao: "Emissão",
};

export const CONTAGENS: Record<Contagem, string> = {
  uteis: "dias úteis",
  corridos: "dias corridos",
};

export const ANEXOS: Record<Anexo, string> = {
  "boleto+nf": "Boleto + NF",
  nf: "Só a NF",
  nenhum: "Nenhum",
};

export interface Etapa {
  id: string;
  /**
   * A etapa da padrão de que esta veio.
   *
   * É o que permite dizer *em que* a régua difere, em vez de mostrar duas listas soltas lado a
   * lado. Uma régua nasce como cópia da padrão, e cada etapa copiada guarda de onde veio; etapa
   * criada depois não tem origem, e por isso conta como nova.
   */
  origemId: string | null;
  nome: string;
  ancora: Ancora;
  /** Dias em relação à âncora, com sinal. Negativo é preventivo, positivo é pós-vencimento. */
  deslocamento: number;
  contagem: Contagem;
  anexo: Anexo;
  ativa: boolean;
  /** Depois dela o título sai da automação e vai para a carteira de quem cobra na mão. */
  etapaFinal: boolean;
  /** O `name` do template na Meta. `null` é etapa sem o que enviar. */
  template: string | null;
}

export interface Regua {
  id: string;
  nome: string;
  /** A régua de quem não tem atribuição. Exatamente uma, e não se apaga. */
  padrao: boolean;
  /** Por que ela existe. Régua sem motivo escrito é régua que ninguém revoga depois. */
  motivo: string;
  etapas: Etapa[];
}

/** `D-3` / `D0` / `D+2`. O rótulo que a equipe usa para falar da etapa. */
export function rotuloDe(etapa: Etapa): string {
  if (etapa.deslocamento === 0) return "D0";
  return etapa.deslocamento < 0 ? `D${etapa.deslocamento}` : `D+${etapa.deslocamento}`;
}

/** Do preventivo para o mais tarde. É a ordem em que a operação lê a régua, e a única que serve. */
export function ordenar(etapas: Etapa[]): Etapa[] {
  return [...etapas].sort((a, b) => a.deslocamento - b.deslocamento);
}

export function reguaPadrao(reguas: Regua[]): Regua {
  return reguas.find((r) => r.padrao) ?? reguas[0];
}

/**
 * A régua que vale para o cliente. `null` no vínculo é o fallback, e é o caso comum.
 *
 * Cai na padrão também quando o id não existe mais — é o que faz excluir uma régua devolver os
 * clientes dela para a padrão sem precisar varrer vínculo nenhum.
 */
export function reguaDoCliente(reguas: Regua[], reguaId: string | null): Regua {
  return (reguaId && reguas.find((r) => r.id === reguaId)) || reguaPadrao(reguas);
}

/**
 * A etapa está pronta para disparar?
 *
 * O que se exige é aprovação **em produção**, não ausência de rascunho: uma v1 aprovada rodando com
 * v2 em análise está pronta, porque quem sai é a v1. Etapa inativa não devolve motivo nenhum — ela
 * não dispara, então não há o que faltar.
 *
 * No serviço real isto bloqueia o salvamento; aqui é aviso, porque não há motor que dispare.
 */
export function motivoSemDisparo(etapa: Etapa, templates: Template[]): string | null {
  if (!etapa.ativa) return null;
  if (!etapa.template) return "sem template";
  const t = templates.find((x) => x.nome === etapa.template);
  if (!t) return "template fora do catálogo";
  return t.aprovadoEmProducao ? null : "template sem versão aprovada";
}

/**
 * Em que esta régua difere da padrão. É o número que justifica a régua existir.
 *
 * Comparar a padrão com ela mesma não é desvio nenhum, e por isso ela devolve zeros: as etapas
 * dela não têm origem, e sem isso toda etapa da padrão contaria como nova.
 */
export function desviosDaPadrao(
  regua: Regua,
  padrao: Regua,
): { movidas: number; desligadas: number; novas: number } {
  if (regua.id === padrao.id) return { movidas: 0, desligadas: 0, novas: 0 };

  let movidas = 0;
  let desligadas = 0;
  let novas = 0;
  for (const etapa of regua.etapas) {
    const origem = padrao.etapas.find((p) => p.id === etapa.origemId);
    if (!origem) {
      novas += 1;
      continue;
    }
    if (origem.ativa && !etapa.ativa) desligadas += 1;
    else if (etapa.deslocamento !== origem.deslocamento || etapa.contagem !== origem.contagem) {
      movidas += 1;
    }
  }
  return { movidas, desligadas, novas };
}

/** `+2` / `−1`. O sinal é o dado: é o quanto a etapa andou em relação à padrão. */
export function comSinal(valor: number): string {
  if (valor === 0) return "0";
  return valor > 0 ? `+${valor}` : `−${Math.abs(valor)}`;
}
