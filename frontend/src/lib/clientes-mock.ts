/**
 * A carteira falsa — o segundo módulo do painel que inventa dado, e pelo mesmo motivo do primeiro.
 *
 * A aba de clientes existe antes do backend dela: não há tabela, rota, nem portal do outro lado.
 * Como em `lib/templates-mock.ts`, o mock imita a **forma** da API — funções assíncronas que
 * resolvem depois de um tempo — para a tela ter os mesmos três estados de carga das outras e para
 * a troca, quando as rotas existirem, ser linha por linha: `listarCarteira` vira `apiGet` e
 * `salvarVinculo` vira `apiPost`, sem mexer no resto da tela.
 *
 * As três partes vêm numa chamada só de propósito. No serviço real são duas origens diferentes —
 * o cliente é do portal, o vínculo e a régua são nossos —, mas uma linha da tabela precisa das
 * três para existir, e separar agora só desenharia uma fronteira que ainda não tem nada dos dois
 * lados. O comentário fica: é aqui que a divisão acontece no dia em que houver backend.
 *
 * O estado vive em memória e volta ao início a cada F5. É de propósito: um `localStorage` faria a
 * demonstração parecer que grava, e "gravou" é justamente o que esta aba ainda não sabe fazer.
 */

import { vinculoVazio, type Cliente, type Regua, type Vinculo } from "@/lib/clientes";

/** A latência fingida: curta para não irritar, longa o bastante para o skeleton aparecer. */
const ATRASO = 320;

function esperar<T>(valor: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(valor), ATRASO));
}

/**
 * Três réguas, e a padrão levando a maioria da carteira.
 *
 * Os templates são citados pelo `name` do catálogo de `/whatsapp/templates` — é a amarra entre as
 * duas abas do "antes": o texto aprovado lá é o que sai por uma etapa daqui. A referência é por
 * nome e não por import porque, com backend, quem resolve isso é a rota, não a tela.
 */
const REGUAS: Regua[] = [
  {
    id: "padrao",
    nome: "Padrão",
    padrao: true,
    motivo: "Serve a carteira inteira que não tem tratamento combinado.",
    etapas: [
      { rotulo: "D-3", nome: "Preventivo", template: "cobranca_vencimento", ativa: true },
      { rotulo: "D+2", nome: "Primeiro aviso", template: "cobranca_atraso", ativa: true },
      { rotulo: "D+9", nome: "Segundo aviso", template: "cobranca_atraso", ativa: true },
    ],
  },
  {
    id: "publico",
    nome: "Órgão público",
    padrao: false,
    motivo: "Empenho e liquidação têm prazo próprio: cobrar em D+2 é cobrar antes de poder pagar.",
    etapas: [
      { rotulo: "D-3", nome: "Preventivo", template: "cobranca_vencimento", ativa: true },
      // Desligada, e é o desvio que justifica a régua existir: o primeiro aviso da padrão não faz
      // sentido antes de o empenho correr.
      { rotulo: "D+2", nome: "Primeiro aviso", template: "cobranca_atraso", ativa: false },
      { rotulo: "D+15", nome: "Aviso único", template: "cobranca_atraso", ativa: true },
    ],
  },
  {
    id: "atraso",
    nome: "Atraso recorrente",
    padrao: false,
    motivo: "Histórico de atraso: o mesmo texto, mais cedo e mais vezes.",
    etapas: [
      { rotulo: "D-5", nome: "Preventivo", template: "cobranca_vencimento", ativa: true },
      { rotulo: "D0", nome: "No vencimento", template: "cobranca_vencimento", ativa: true },
      { rotulo: "D+1", nome: "Primeiro aviso", template: "cobranca_atraso", ativa: true },
      { rotulo: "D+5", nome: "Segundo aviso", template: "cobranca_atraso", ativa: true },
    ],
  },
];

/**
 * Quatorze clientes, como o portal os devolveria.
 *
 * Poucos, e escolhidos pelos casos que a tela precisa saber mostrar: flag de negociação, flag de
 * jurídico, cliente sem telefone no cadastro do portal (não há por onde começar o vínculo), órgão
 * público em régua própria e um opt-out no meio de uma cobrança. **Isto não é estado do app** — é
 * a resposta de uma consulta, e por isso `salvarVinculo` não encosta aqui.
 */
const CLIENTES: Cliente[] = [
  {
    id: "c-0182",
    razaoSocial: "Agência Contraponto Ltda",
    documento: "08.412.556/0001-30",
    cidade: "Florianópolis",
    titulosAbertos: 3,
    valorAberto: 18400,
    flags: [],
    telefone: "+55 48 98812-4471",
  },
  {
    id: "c-0207",
    razaoSocial: "Prefeitura Municipal de São José",
    documento: "82.892.282/0001-43",
    cidade: "São José",
    titulosAbertos: 6,
    valorAberto: 74250,
    flags: [],
    telefone: "+55 48 3381-0022",
  },
  {
    id: "c-0233",
    razaoSocial: "Supermercados Angeloni S.A.",
    documento: "83.646.984/0001-95",
    cidade: "Criciúma",
    titulosAbertos: 9,
    valorAberto: 142800,
    flags: [],
    telefone: "+55 48 99114-8820",
  },
  {
    id: "c-0288",
    razaoSocial: "Governo do Estado de Santa Catarina",
    documento: "82.951.229/0001-76",
    cidade: "Florianópolis",
    titulosAbertos: 4,
    valorAberto: 96300,
    flags: [],
    telefone: "+55 48 3665-1200",
  },
  {
    id: "c-0311",
    razaoSocial: "Publicidade Sul Marketing Ltda",
    documento: "11.204.883/0001-08",
    cidade: "Blumenau",
    titulosAbertos: 2,
    valorAberto: 9600,
    flags: [],
    telefone: "+55 47 99623-1140",
  },
  {
    id: "c-0344",
    razaoSocial: "Construtora Fontana Ltda",
    documento: "04.778.115/0001-62",
    cidade: "Itajaí",
    titulosAbertos: 7,
    valorAberto: 63700,
    flags: [],
    telefone: "+55 47 98844-3390",
  },
  {
    id: "c-0359",
    razaoSocial: "Clínica Vida Plena Ltda",
    documento: "17.556.902/0001-11",
    cidade: "Florianópolis",
    titulosAbertos: 1,
    valorAberto: 4200,
    flags: [],
    telefone: "+55 48 99302-7714",
  },
  {
    id: "c-0402",
    razaoSocial: "Câmara Municipal de Palhoça",
    documento: "78.844.109/0001-20",
    cidade: "Palhoça",
    titulosAbertos: 2,
    valorAberto: 21500,
    flags: [],
    telefone: "+55 48 3242-8800",
  },
  {
    id: "c-0431",
    razaoSocial: "Auto Posto Ilha Norte Ltda",
    documento: "05.331.774/0001-49",
    cidade: "Florianópolis",
    titulosAbertos: 2,
    valorAberto: 7350,
    flags: [],
    // Sem telefone no cadastro do portal: não há por onde começar o vínculo.
    telefone: null,
  },
  {
    id: "c-0458",
    razaoSocial: "Colégio Energia Barreiros",
    documento: "02.918.663/0001-84",
    cidade: "São José",
    titulosAbertos: 3,
    valorAberto: 12900,
    flags: [],
    telefone: "+55 48 99871-2205",
  },
  {
    id: "c-0470",
    razaoSocial: "Móveis Rudnick S.A.",
    documento: "84.684.512/0001-07",
    cidade: "São Bento do Sul",
    titulosAbertos: 5,
    valorAberto: 38200,
    flags: [],
    telefone: "+55 47 99551-6688",
  },
  {
    id: "c-0493",
    razaoSocial: "Digital Praia Comunicação ME",
    documento: "21.007.449/0001-55",
    cidade: "Balneário Camboriú",
    titulosAbertos: 4,
    valorAberto: 16750,
    // Flag do portal: quem trata é humano, e a régua inteira fica suspensa enquanto durar.
    flags: ["negociacao"],
    telefone: "+55 47 98220-9931",
  },
  {
    id: "c-0512",
    razaoSocial: "Hospital Santa Isabel",
    documento: "83.026.518/0001-73",
    cidade: "Blumenau",
    titulosAbertos: 6,
    valorAberto: 88400,
    flags: [],
    telefone: "+55 47 99128-4402",
  },
  {
    id: "c-0538",
    razaoSocial: "Transportes Rota Sul Ltda",
    documento: "09.663.201/0001-18",
    cidade: "Joinville",
    titulosAbertos: 8,
    valorAberto: 51900,
    flags: ["juridico"],
    telefone: "+55 47 99770-3312",
  },
];

/**
 * Os vínculos de partida.
 *
 * A maioria com `reguaId: null` — cai na padrão, e é isso que uma carteira grande tem que
 * parecer: ninguém configura cliente por cliente. Cinco atribuições explícitas, três delas de
 * órgão público.
 */
const VINCULOS: Record<string, Vinculo> = {
  "c-0182": {
    clienteId: "c-0182",
    reguaId: null,
    numeroVinculado: "+55 48 98812-4471",
    gerenteDaConta: "Renata Bittencourt",
    optOut: false,
  },
  "c-0207": {
    clienteId: "c-0207",
    reguaId: "publico",
    numeroVinculado: "+55 48 98140-3327",
    gerenteDaConta: "Marcelo Aguiar",
    optOut: false,
  },
  "c-0233": {
    clienteId: "c-0233",
    reguaId: null,
    numeroVinculado: "+55 48 99114-8820",
    gerenteDaConta: "Renata Bittencourt",
    optOut: false,
  },
  "c-0288": {
    clienteId: "c-0288",
    reguaId: "publico",
    numeroVinculado: "+55 48 99640-1188",
    gerenteDaConta: "Marcelo Aguiar",
    optOut: false,
  },
  "c-0311": {
    clienteId: "c-0311",
    reguaId: null,
    numeroVinculado: "+55 47 99623-1140",
    gerenteDaConta: null,
    optOut: false,
  },
  "c-0344": {
    clienteId: "c-0344",
    reguaId: "atraso",
    numeroVinculado: "+55 47 98844-3390",
    gerenteDaConta: null,
    optOut: false,
  },
  "c-0359": {
    clienteId: "c-0359",
    reguaId: null,
    numeroVinculado: "+55 48 99302-7714",
    gerenteDaConta: null,
    optOut: false,
  },
  "c-0402": {
    clienteId: "c-0402",
    reguaId: "publico",
    numeroVinculado: "+55 48 98833-4120",
    gerenteDaConta: null,
    optOut: false,
  },
  // Sem número: o cliente aparece na lista e não recebe nada. É o buraco que a tela existe para
  // mostrar — no portal ele parece um cliente como qualquer outro.
  "c-0431": vinculoVazio("c-0431"),
  "c-0458": {
    clienteId: "c-0458",
    reguaId: null,
    numeroVinculado: "+55 48 99871-2205",
    gerenteDaConta: null,
    optOut: false,
  },
  "c-0470": {
    clienteId: "c-0470",
    reguaId: "atraso",
    numeroVinculado: "+55 47 99551-6688",
    gerenteDaConta: "Renata Bittencourt",
    optOut: false,
  },
  "c-0493": {
    clienteId: "c-0493",
    reguaId: null,
    numeroVinculado: "+55 47 98220-9931",
    gerenteDaConta: null,
    optOut: false,
  },
  "c-0512": {
    clienteId: "c-0512",
    reguaId: null,
    numeroVinculado: "+55 47 99128-4402",
    gerenteDaConta: "Renata Bittencourt",
    optOut: false,
  },
  "c-0538": {
    clienteId: "c-0538",
    reguaId: null,
    numeroVinculado: "+55 47 99770-3312",
    gerenteDaConta: null,
    // Pediu para sair no meio de uma cobrança. Fica no log, e a régua para para este cliente.
    optOut: true,
  },
};

export interface Carteira {
  clientes: Cliente[];
  reguas: Regua[];
  vinculos: Record<string, Vinculo>;
}

export function listarCarteira(): Promise<Carteira> {
  return esperar({ clientes: CLIENTES, reguas: REGUAS, vinculos: { ...VINCULOS } });
}

/** A única escrita da aba, e ela só toca o que é nosso: o cliente do portal fica como veio. */
export function salvarVinculo(vinculo: Vinculo): Promise<Vinculo> {
  VINCULOS[vinculo.clienteId] = { ...vinculo };
  return esperar(VINCULOS[vinculo.clienteId]);
}
