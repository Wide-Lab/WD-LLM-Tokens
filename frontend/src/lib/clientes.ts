/**
 * Clientes de disparo — o cadastro que decide **para quem** o template vai.
 *
 * A seção de WhatsApp deste painel lê fato: a mensagem saiu, a Meta cobrou, o preço vigente diz
 * quanto. `Templates` já é a exceção — o texto que existe antes do fato. Aqui está a outra metade
 * do mesmo antes: o texto aprovado não dispara sozinho, ele precisa de um destinatário verificado
 * e de um ritmo. Mexer nesta tela muda o gasto de amanhã pelo lado do volume, como mexer no
 * template muda pelo lado da tarifa.
 *
 * **Cliente não é cadastro nosso.** Razão social, documento, títulos em aberto e as flags que
 * suprimem o disparo vêm da API do portal, que é a única fronteira com o cliente — nada disso se
 * digita aqui, e por isso `Cliente` é constante lida, não registro editado. O que é nosso é o
 * `Vinculo`: a régua atribuída, o número verificado no WhatsApp, o gerente da conta e o opt-out.
 * É exatamente o que o portal não tem onde guardar, e a tela desenha essa costura.
 *
 * `reguaId: null` é o caso comum e não é ausência de configuração — é a régua padrão. O fallback
 * inteiro cabe num campo porque a unidade de substituição é a régua, não a etapa. A régua em si
 * é a outra metade de Disparos e mora em `lib/reguas.ts`: aqui só se aponta para ela.
 */

import { reguaDoCliente, type Regua } from "@/lib/reguas";

/** Flags do portal que suprimem o disparo. A régua lê; quem trata é humano. */
export type FlagPortal = "negociacao" | "juridico" | "protesto";

export const FLAGS: Record<FlagPortal, string> = {
  negociacao: "Em negociação",
  juridico: "Jurídico",
  protesto: "Protestado",
};

export interface Cliente {
  /** A chave do portal. É por ela que o vínculo se amarra, e ela não é nossa. */
  id: string;
  razaoSocial: string;
  documento: string;
  cidade: string;
  titulosAbertos: number;
  /** Em reais: é dívida do cliente no portal, não gasto do painel. Ver `tela` para a cor. */
  valorAberto: number;
  flags: FlagPortal[];
  /** O telefone do cadastro do portal. Ter telefone não é ter vínculo verificado. */
  telefone: string | null;
}

export interface Vinculo {
  clienteId: string;
  /** Nulo cai na régua padrão. Não é falta de configuração: é a configuração. */
  reguaId: string | null;
  /** Número verificado no WhatsApp. Sem ele a mensagem não sai. */
  numeroVinculado: string | null;
  gerenteDaConta: string | null;
  optOut: boolean;
}

export function vinculoVazio(clienteId: string): Vinculo {
  return { clienteId, reguaId: null, numeroVinculado: null, gerenteDaConta: null, optOut: false };
}

/**
 * Por que este cliente não recebe nada, se for o caso. `null` quer dizer que a régua roda.
 *
 * A ordem é a do custo de errar: opt-out é exigência do WhatsApp e vence tudo, flag do portal é
 * decisão de gente que já está tratando o caso, e só então a falta técnica de número. Uma tela que
 * mostrasse "sem número" para quem pediu para sair esconderia o motivo que importa.
 */
export function bloqueio(cliente: Cliente, vinculo: Vinculo): string | null {
  if (vinculo.optOut) return "Pediu para sair";
  if (cliente.flags.length > 0) return cliente.flags.map((f) => FLAGS[f]).join(" · ");
  if (!vinculo.numeroVinculado) return "Sem número vinculado";
  return null;
}

/** Busca por razão social, documento ou cidade. No app real quem filtra é o portal. */
export function buscar(clientes: Cliente[], termo: string): Cliente[] {
  const t = termo.trim().toLowerCase();
  if (!t) return clientes;
  return clientes.filter(
    (c) =>
      c.razaoSocial.toLowerCase().includes(t) ||
      c.documento.includes(t) ||
      c.cidade.toLowerCase().includes(t),
  );
}

/** Quantos clientes cada régua tem hoje. É o número que justifica a régua existir. */
export function clientesPorRegua(
  clientes: Cliente[],
  vinculos: Record<string, Vinculo>,
  reguas: Regua[],
): Record<string, number> {
  const contagem: Record<string, number> = Object.fromEntries(reguas.map((r) => [r.id, 0]));
  for (const cliente of clientes) {
    const vinculo = vinculos[cliente.id] ?? vinculoVazio(cliente.id);
    const regua = reguaDoCliente(reguas, vinculo.reguaId);
    contagem[regua.id] = (contagem[regua.id] ?? 0) + 1;
  }
  return contagem;
}
