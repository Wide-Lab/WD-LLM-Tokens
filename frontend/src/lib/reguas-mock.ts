/**
 * As réguas falsas — o terceiro módulo do painel que inventa dado, e pelo mesmo motivo dos outros.
 *
 * A aba existe antes do backend dela: não há tabela nem rota. Como em `lib/templates-mock.ts` e
 * `lib/clientes-mock.ts`, o mock imita a **forma** da API — funções assíncronas que resolvem depois
 * de um tempo — para a tela ter os mesmos três estados de carga das outras e para a troca, quando
 * as rotas existirem, ser linha por linha: `listarReguas` vira `apiGet` e cada escrita vira
 * `apiPost`, sem mexer no resto da tela.
 *
 * Este arquivo é a **única** fonte das réguas do painel: a carteira lê daqui por `reguasAtuais`, em
 * vez de manter uma cópia. Duas listas com os mesmos ids divergiriam na primeira edição, e a aba de
 * clientes passaria a mostrar um ritmo que a de réguas já não tem.
 *
 * O estado vive em memória e volta ao início a cada F5. É de propósito: um `localStorage` faria a
 * demonstração parecer que grava, e "gravou" é justamente o que esta aba ainda não sabe fazer.
 */

import type { Etapa, Regua } from "@/lib/reguas";

/** A latência fingida: curta para não irritar, longa o bastante para o skeleton aparecer. */
const ATRASO = 320;

function esperar<T>(valor: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(valor), ATRASO));
}

/**
 * Três réguas: a padrão e duas que existem por um motivo escrito.
 *
 * As duas exceções são as únicas segmentações com critério objetivo — órgão público, que paga por
 * empenho, e histórico de atraso. Cada etapa delas guarda `origemId`, e é isso que permite à tela
 * dizer *em que* a régua difere, em vez de mostrar duas listas soltas lado a lado.
 *
 * Os templates são citados pelo `name` do catálogo de `/whatsapp/templates`: é a amarra entre as
 * duas metades do "antes" — o texto aprovado lá é o que sai por uma etapa daqui.
 */
const INICIAIS: Regua[] = [
  {
    id: "padrao",
    nome: "Padrão",
    padrao: true,
    motivo: "Serve a carteira inteira que não tem tratamento combinado.",
    etapas: [
      {
        id: "padrao-preventivo",
        origemId: null,
        nome: "Preventivo",
        ancora: "vencimento",
        deslocamento: -3,
        // Úteis: o preventivo só serve se cair num dia em que o cliente consiga pagar.
        contagem: "uteis",
        anexo: "boleto+nf",
        ativa: true,
        etapaFinal: false,
        template: "cobranca_vencimento",
      },
      {
        id: "padrao-aviso-1",
        origemId: null,
        nome: "Primeiro aviso",
        ancora: "vencimento",
        deslocamento: 2,
        // Corridos: depois do vencimento a data importa juridicamente.
        contagem: "corridos",
        anexo: "nf",
        ativa: true,
        etapaFinal: false,
        template: "cobranca_atraso",
      },
      {
        id: "padrao-aviso-2",
        origemId: null,
        nome: "Segundo aviso",
        ancora: "vencimento",
        deslocamento: 9,
        contagem: "corridos",
        anexo: "nf",
        ativa: true,
        etapaFinal: true,
        template: "cobranca_atraso",
      },
    ],
  },
  {
    id: "publico",
    nome: "Órgão público",
    padrao: false,
    motivo: "Empenho e liquidação têm prazo próprio: cobrar em D+2 é cobrar antes de poder pagar.",
    etapas: [
      {
        id: "publico-preventivo",
        origemId: "padrao-preventivo",
        nome: "Preventivo",
        ancora: "vencimento",
        deslocamento: -5,
        contagem: "uteis",
        anexo: "nf",
        ativa: true,
        etapaFinal: false,
        template: "cobranca_vencimento",
      },
      {
        // Desligada, e é o desvio que justifica a régua existir: o primeiro aviso da padrão não
        // faz sentido antes de o empenho correr. Desligar preserva a configuração; apagar não.
        id: "publico-aviso-1",
        origemId: "padrao-aviso-1",
        nome: "Primeiro aviso",
        ancora: "vencimento",
        deslocamento: 2,
        contagem: "corridos",
        anexo: "nf",
        ativa: false,
        etapaFinal: false,
        template: "cobranca_atraso",
      },
      {
        id: "publico-aviso-2",
        origemId: "padrao-aviso-2",
        nome: "Aviso único",
        ancora: "vencimento",
        deslocamento: 15,
        contagem: "corridos",
        anexo: "nf",
        ativa: true,
        etapaFinal: true,
        template: "cobranca_atraso",
      },
    ],
  },
  {
    id: "atraso",
    nome: "Atraso recorrente",
    padrao: false,
    motivo: "Histórico de atraso: o mesmo texto, mais cedo e mais vezes.",
    etapas: [
      {
        id: "atraso-preventivo",
        origemId: "padrao-preventivo",
        nome: "Preventivo",
        ancora: "vencimento",
        deslocamento: -5,
        contagem: "uteis",
        anexo: "boleto+nf",
        ativa: true,
        etapaFinal: false,
        template: "cobranca_vencimento",
      },
      {
        // Sem origem: etapa que a padrão não tem. É o que a tela conta como "nova".
        id: "atraso-vencimento",
        origemId: null,
        nome: "No vencimento",
        ancora: "vencimento",
        deslocamento: 0,
        contagem: "corridos",
        anexo: "boleto+nf",
        ativa: true,
        etapaFinal: false,
        template: "cobranca_vencimento",
      },
      {
        id: "atraso-aviso-1",
        origemId: "padrao-aviso-1",
        nome: "Primeiro aviso",
        ancora: "vencimento",
        deslocamento: 1,
        contagem: "corridos",
        anexo: "nf",
        ativa: true,
        etapaFinal: false,
        template: "cobranca_atraso",
      },
      {
        id: "atraso-aviso-2",
        origemId: "padrao-aviso-2",
        nome: "Segundo aviso",
        ancora: "vencimento",
        deslocamento: 5,
        contagem: "corridos",
        anexo: "nf",
        ativa: true,
        etapaFinal: false,
        template: "cobranca_atraso",
      },
      {
        // Ativa e sem template: o buraco que a tela existe para mostrar. No serviço real isto
        // bloqueia o salvamento; aqui fica como aviso, porque não há motor que dispare.
        id: "atraso-final",
        origemId: null,
        nome: "Aviso final",
        ancora: "vencimento",
        deslocamento: 12,
        contagem: "corridos",
        anexo: "nenhum",
        ativa: true,
        etapaFinal: true,
        template: null,
      },
    ],
  },
];

function copia(regua: Regua): Regua {
  return { ...regua, etapas: regua.etapas.map((e) => ({ ...e })) };
}

let catalogo: Regua[] = INICIAIS.map(copia);

function alterar(reguaId: string, mudanca: (r: Regua) => Regua) {
  catalogo = catalogo.map((r) => (r.id === reguaId ? mudanca(r) : r));
}

export function listarReguas(): Promise<Regua[]> {
  return esperar(catalogo.map(copia));
}

/**
 * A leitura sem espera, para a carteira montar a linha do cliente.
 *
 * Existe porque `listarCarteira` já é uma chamada só que junta o que no serviço real são origens
 * diferentes; somar outra promessa dentro dela fingiria uma latência que a rota real não terá — lá
 * a régua vem na mesma resposta.
 */
export function reguasAtuais(): Regua[] {
  return catalogo.map(copia);
}

/**
 * Régua nova nasce como cópia da padrão, e cada etapa copiada guarda de onde veio.
 *
 * Cópia, e não vazia, porque personalizar é quase sempre mexer numa etapa de três: uma régua em
 * branco obrigaria a redigitar o que já estava certo, e sem `origemId` a tela não teria como dizer
 * em que ela difere. Nenhum cliente é atribuído aqui — quem atribui é a aba de clientes.
 */
export function criarRegua(nome: string, motivo: string): Promise<Regua> {
  const padrao = catalogo.find((r) => r.padrao) ?? catalogo[0];
  const id = `regua-${Date.now()}`;
  const regua: Regua = {
    id,
    nome,
    padrao: false,
    motivo,
    etapas: padrao.etapas.map((e, i) => ({ ...e, id: `${id}-${i}`, origemId: e.id })),
  };
  catalogo = [...catalogo, regua];
  return esperar(copia(regua));
}

/** Renomear e reescrever o motivo. A etapa não passa por aqui: cada uma se salva sozinha. */
export function salvarRegua(reguaId: string, nome: string, motivo: string): Promise<void> {
  alterar(reguaId, (r) => ({ ...r, nome, motivo }));
  return esperar(undefined);
}

/**
 * Excluir devolve os clientes da régua para a padrão, e sem tocar em vínculo nenhum: o `reguaId`
 * guardado deixa de casar com alguma régua e `reguaDoCliente` já cai no fallback. A padrão não se
 * apaga — é ela o fallback.
 */
export function removerRegua(reguaId: string): Promise<void> {
  catalogo = catalogo.filter((r) => r.id !== reguaId || r.padrao);
  return esperar(undefined);
}

/** Uma etapa que ainda não existe. Não é escrita: é só o rascunho que o diálogo abre. */
export function etapaNova(): Etapa {
  return {
    id: `etapa-${Date.now()}`,
    origemId: null,
    nome: "Nova etapa",
    ancora: "vencimento",
    deslocamento: 0,
    contagem: "corridos",
    anexo: "nf",
    // Desligada: etapa sem template escolhido não tem o que enviar, e ligar é decisão explícita.
    ativa: false,
    etapaFinal: false,
    template: null,
  };
}

/** Salva a etapa na régua — cria se o id ainda não estiver lá, substitui se estiver. */
export function salvarEtapa(reguaId: string, etapa: Etapa): Promise<void> {
  alterar(reguaId, (r) => ({
    ...r,
    etapas: r.etapas.some((e) => e.id === etapa.id)
      ? r.etapas.map((e) => (e.id === etapa.id ? { ...etapa } : e))
      : [...r.etapas, { ...etapa }],
  }));
  return esperar(undefined);
}

export function removerEtapa(reguaId: string, etapaId: string): Promise<void> {
  alterar(reguaId, (r) => ({ ...r, etapas: r.etapas.filter((e) => e.id !== etapaId) }));
  return esperar(undefined);
}
