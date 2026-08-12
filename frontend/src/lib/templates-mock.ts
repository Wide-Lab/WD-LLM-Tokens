/**
 * O catálogo falso, e o único módulo do painel que inventa dado.
 *
 * A aba de templates existe antes do backend dela: não há tabela, rota nem aplicação reportando
 * template nenhum. Em vez de espalhar literais pela tela, o mock imita a **forma** da API — funções
 * assíncronas que resolvem depois de um tempo — para a tela ter os mesmos três estados de carga das
 * outras e para a troca, quando a rota existir, ser linha por linha: `listarTemplates` vira
 * `apiGet`, cada escrita vira `apiPost`, e o resto da tela não muda.
 *
 * O estado vive em memória e volta ao início a cada F5. É de propósito: um `localStorage` faria a
 * demonstração parecer que grava, e "gravou" é justamente o que esta aba ainda não sabe fazer.
 */

import type { EstadoMeta, Template } from "@/lib/templates";

/** A latência fingida: curta para não irritar, longa o bastante para o skeleton aparecer. */
const ATRASO = 320;

function esperar<T>(valor: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(valor), ATRASO));
}

/**
 * Seis templates, três categorias, e cada um carregando um caso que a tela precisa saber mostrar.
 *
 * Os números de uso são de um período fixo — trinta dias — porque esta aba não tem filtro de data:
 * o catálogo é cadastro, não leitura de período, e o mesmo vale para `/precos`. O que o uso responde
 * aqui é outra pergunta: qual texto está puxando o gasto da seção.
 */
const INICIAIS: Template[] = [
  {
    id: "tpl-cobranca-vencimento",
    nome: "cobranca_vencimento",
    categoria: "utility",
    aplicacao: "cobranca-nsc",
    idioma: "pt_BR",
    corpo:
      "Olá, {{cliente}}. Sua fatura de {{valor}} vence em {{vencimento}}.\n\n" +
      "Se já pagou, mande o comprovante por aqui que damos baixa.",
    versao: 3,
    rascunho: null,
    estado: "aprovado",
    aprovadoEmProducao: true,
    enviadas: 8420,
    cobraveis: 8420,
    custo: 66.52,
    moeda: "USD",
  },
  {
    id: "tpl-cobranca-atraso",
    nome: "cobranca_atraso",
    categoria: "utility",
    aplicacao: "cobranca-nsc",
    idioma: "pt_BR",
    corpo:
      "{{cliente}}, a fatura de {{valor}} venceu em {{vencimento}} e continua em aberto.\n\n" +
      "Precisa de segunda via? Responda por aqui.",
    versao: 2,
    // Uma v2 aprovada rodando e uma v3 em análise: o texto novo existe e não é o que sai.
    rascunho:
      "{{cliente}}, a fatura de {{valor}} venceu em {{vencimento}} e continua em aberto.\n\n" +
      "Responda SEGUNDA VIA que eu envio na hora, ou mande o comprovante se já pagou.",
    estado: "em_analise",
    aprovadoEmProducao: true,
    enviadas: 3110,
    cobraveis: 3110,
    custo: 24.57,
    moeda: "USD",
  },
  {
    id: "tpl-codigo-acesso",
    nome: "codigo_acesso",
    categoria: "authentication",
    aplicacao: "portal-cliente",
    idioma: "pt_BR",
    corpo:
      "Seu código de acesso é {{codigo}}. Ele vale por 10 minutos e não deve ser compartilhado.",
    versao: 1,
    rascunho: null,
    estado: "aprovado",
    aprovadoEmProducao: true,
    enviadas: 15980,
    cobraveis: 15980,
    // Cobrável e sem custo apurado: é o mesmo buraco que a lista de mensagens mostra em branco —
    // falta preço vigente para (authentication, país, data), e o volume sai da soma sem erro nenhum.
    custo: null,
    moeda: "USD",
  },
  {
    id: "tpl-pesquisa-satisfacao",
    nome: "pesquisa_satisfacao",
    categoria: "marketing",
    aplicacao: "atendimento",
    idioma: "pt_BR",
    corpo:
      "{{cliente}}, o atendimento {{protocolo}} foi encerrado. De 1 a 5, como foi para você?\n\n" +
      "Responda com o número. Quem atendeu foi {{atendente}}.",
    versao: 4,
    rascunho: null,
    estado: "aprovado",
    aprovadoEmProducao: true,
    enviadas: 2240,
    cobraveis: 2240,
    // Marketing é a tarifa mais alta das três: menos de um sexto do volume do código de acesso e
    // mais que o dobro do custo dele. É o par de números que justifica mostrar custo por template.
    custo: 141.12,
    moeda: "USD",
  },
  {
    id: "tpl-novidades-plano",
    nome: "novidades_plano",
    categoria: "marketing",
    aplicacao: "atendimento",
    idioma: "pt_BR",
    corpo:
      "{{cliente}}, seu plano tem novidades a partir de {{vencimento}}.\n\n" +
      "Quer ver o que muda? Responda QUERO e eu te mando o resumo.",
    versao: 1,
    rascunho: null,
    // Rejeitado pela Meta: estado que a tela tem de mostrar sem inventar desculpa, e que impede o
    // envio até alguém reescrever o corpo.
    estado: "rejeitado",
    aprovadoEmProducao: false,
    enviadas: 0,
    cobraveis: 0,
    custo: 0,
    moeda: "USD",
  },
  {
    id: "tpl-agendamento-confirmado",
    nome: "agendamento_confirmado",
    categoria: "utility",
    aplicacao: "atendimento",
    idioma: "pt_BR",
    corpo:
      "Agendamento confirmado, {{cliente}}: {{vencimento}}.\n\n" +
      "Protocolo {{protocolo}}. Para remarcar, responda por aqui.",
    versao: 1,
    rascunho: null,
    estado: "aprovado",
    aprovadoEmProducao: true,
    enviadas: 640,
    // Menos cobráveis que enviadas: parte saiu dentro de uma janela de atendimento já aberta, e a
    // Meta não cobra duas vezes pela mesma conversa.
    cobraveis: 512,
    custo: 4.04,
    moeda: "USD",
  },
];

let catalogo: Template[] = INICIAIS.map((t) => ({ ...t }));

function atualizar(id: string, mudanca: (t: Template) => Template) {
  catalogo = catalogo.map((t) => (t.id === id ? mudanca(t) : t));
}

export function listarTemplates(): Promise<Template[]> {
  return esperar(catalogo.map((t) => ({ ...t })));
}

/**
 * Um template novo nasce sem aprovação e sem uso.
 *
 * Nasce com rascunho vazio e `corpo` vazio porque as duas coisas não são a mesma: ele nunca teve
 * versão aprovada, então não há o que rodar — e nenhuma mensagem sai por ele até a Meta responder.
 */
export function criarTemplate(categoria: string): Promise<Template> {
  const template: Template = {
    id: `tpl-novo-${Date.now()}`,
    nome: "novo_template",
    categoria,
    aplicacao: "atendimento",
    idioma: "pt_BR",
    corpo: "",
    versao: 0,
    rascunho: "",
    estado: "rascunho",
    aprovadoEmProducao: false,
    enviadas: 0,
    cobraveis: 0,
    custo: 0,
    moeda: "USD",
  };
  catalogo = [...catalogo, template];
  return esperar({ ...template });
}

/** Renomear é rótulo nosso, não corpo aprovado: não passa pela Meta. */
export function renomearTemplate(id: string, nome: string): Promise<void> {
  atualizar(id, (t) => ({ ...t, nome }));
  return esperar(undefined);
}

/** Salvar o corpo cria rascunho. O que roda continua sendo o `corpo` até a Meta aprovar. */
export function salvarRascunho(id: string, rascunho: string): Promise<void> {
  atualizar(id, (t) => ({
    ...t,
    rascunho,
    // Um template aprovado que ganha rascunho continua aprovado: o que espera a Meta é a versão
    // nova, e ela ainda nem foi enviada.
    estado: t.aprovadoEmProducao ? t.estado : "rascunho",
  }));
  return esperar(undefined);
}

export function enviarParaMeta(id: string): Promise<void> {
  atualizar(id, (t) => ({ ...t, estado: "em_analise" }));
  return esperar(undefined);
}

/**
 * A resposta da Meta, que no serviço real chega por webhook e aqui é um botão.
 *
 * Aprovou: o rascunho vira produção e a versão anda. Recusou: segue valendo o que já rodava, e quem
 * nunca teve versão aprovada continua sem poder enviar.
 */
export function responderMeta(id: string, aprovado: boolean): Promise<void> {
  atualizar(id, (t) => {
    if (!aprovado) return { ...t, estado: "rejeitado" as EstadoMeta };
    return {
      ...t,
      corpo: t.rascunho ?? t.corpo,
      versao: t.versao + 1,
      rascunho: null,
      estado: "aprovado" as EstadoMeta,
      aprovadoEmProducao: true,
    };
  });
  return esperar(undefined);
}
