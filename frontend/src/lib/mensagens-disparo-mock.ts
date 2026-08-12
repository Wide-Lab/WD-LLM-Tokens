/**
 * O log falso — o quarto módulo do painel que inventa dado, e pelo mesmo motivo dos outros três.
 *
 * A aba existe antes do backend dela: não há tabela nem rota, e não há motor que monte lote nenhum.
 * Como em `lib/templates-mock.ts`, `lib/clientes-mock.ts` e `lib/reguas-mock.ts`, o mock imita a
 * **forma** da API — função assíncrona que resolve depois de um tempo — para a tela ter os mesmos
 * três estados de carga das outras e para a troca, quando a rota existir, ser de uma linha:
 * `listarMensagens` vira `apiGet`.
 *
 * Duas coisas separam este mock dos outros.
 *
 * **Ele não inventa a decisão, só o acaso.** O log sai do mesmo caminho que o serviço real
 * percorreria — cliente → vínculo → régua → etapa ativa → template —, lendo as três abas por
 * `carteiraAtual`, `reguasAtuais` e `templatesAtuais`. É isso que faz o Hospital Santa Isabel cair
 * em D+2 e a Construtora Fontana em D+1 sem que nada disso esteja escrito aqui: está nas réguas. E
 * as supressões não são sorteadas para quem tem motivo — quem está com flag do portal, com opt-out
 * ou sem número vinculado é suprimido sempre, com o mesmo motivo que a aba de clientes mostra. É o
 * par que torna o bloqueio auditável: sem ele, a tela de clientes promete uma coisa e o log conta
 * outra.
 *
 * **Ele é gerado uma vez, na carga do módulo, e não relê nada depois.** Log é foto: editar uma
 * régua hoje não muda o que saiu ontem, e um mock que se regerasse a cada leitura reescreveria o
 * passado toda vez que alguém mexesse numa etapa — que é justamente o erro que o campo `etapaId`
 * existe para tornar impossível.
 *
 * O sorteio é determinístico, com semente fixa: a lista é sempre a mesma, para que a demonstração
 * não mude a cada F5 e para que "aquela mensagem suprimida" continue lá quando alguém pedir para
 * ver de novo.
 */

import { resolverData, somarDias } from "@/lib/calendario";
import { bloqueio, vinculoVazio } from "@/lib/clientes";
import { carteiraAtual } from "@/lib/clientes-mock";
import { formatCurrency, formatDateOnly, toISODate } from "@/lib/format";
import { reguaDoCliente } from "@/lib/reguas";
import { reguasAtuais } from "@/lib/reguas-mock";
import { renderizar, VARIAVEIS } from "@/lib/templates";
import { templatesAtuais } from "@/lib/templates-mock";
import type { Mensagem, Resposta, Status, TituloCobrado } from "@/lib/mensagens-disparo";

/** A latência fingida: curta para não irritar, longa o bastante para o skeleton aparecer. */
const ATRASO = 320;

function esperar<T>(valor: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(valor), ATRASO));
}

const AGORA = new Date();
const HOJE = toISODate(AGORA);

/** A janela do log, contando hoje. Duas semanas cobrem a régua inteira de um vencimento. */
const DIAS_DE_LOG = 14;

/**
 * A semente é escolhida, não arbitrária: é a que faz os seis `STATUS` e as seis `RESPOSTAS`
 * aparecerem todos pelo menos uma vez. Uma maquete em que "Pediu para sair" nunca chega a ser
 * desenhado esconde justamente o caso que a tela existe para discutir.
 */
let semente = 20260901;

/** Congruencial linear: o mesmo sorteio em toda carga, e a mesma lista em toda demonstração. */
function sorteio(): number {
  semente = (semente * 1103515245 + 12345) % 2147483648;
  return semente / 2147483648;
}

function escolher<T>(itens: T[]): T {
  return itens[Math.floor(sorteio() * itens.length)];
}

/**
 * Os motivos de supressão que **não** vêm da carteira.
 *
 * Nenhum deles é configuração: são fatos que apareceram entre montar o lote e mandar. É por isso
 * que a régua reconsulta antes de disparar, e é o que a coluna de motivo existe para mostrar.
 */
const MOTIVOS_SUPRESSAO = [
  "Título baixado na reconsulta, 4 min antes do envio",
  "Comprovante recebido há 2 dias",
  "Já recebeu mensagem ativa hoje — limite de 1 por dia",
  "Conversa com analista em aberto",
];

function titulos(quantos: number, vencimento: string, base: number): TituloCobrado[] {
  return Array.from({ length: quantos }, (_, i) => ({
    numero: String(104000 + base * 7 + i * 13),
    vencimento,
    valor: Math.round((900 + sorteio() * 14000) / 50) * 50,
  }));
}

function statusSorteado(): { status: Status; motivo: string | null } {
  const p = sorteio();
  if (p < 0.05) return { status: "suprimida", motivo: escolher(MOTIVOS_SUPRESSAO) };
  if (p < 0.12) return { status: "adiada", motivo: "Teto diário de 250 atingido — reprogramada" };
  if (p < 0.16) return { status: "falhou", motivo: "Número não existe no WhatsApp" };
  if (p < 0.33) return { status: "enviada", motivo: null };
  if (p < 0.62) return { status: "entregue", motivo: null };
  return { status: "lida", motivo: null };
}

/**
 * Só quem leu responde. É o que torna a resposta um eixo à parte, e não um status a mais.
 *
 * As cinco respostas aparecem mais do que apareceriam num log de verdade, onde o silêncio é a
 * regra larga. É de propósito, e é a mesma escolha dos outros mocks: uma maquete em que metade do
 * vocabulário da tela nunca chega a ser desenhada esconde justamente o que se quer discutir — que
 * comprovante, contestação e pedido de saída tiram o título da automação.
 */
function respostaSorteada(status: Status): Resposta {
  if (status !== "lida") return "nenhuma";
  const p = sorteio();
  if (p < 0.34) return "nenhuma";
  if (p < 0.53) return "comprovante";
  if (p < 0.68) return "pediu_segunda_via";
  if (p < 0.81) return "promessa";
  if (p < 0.92) return "divergencia";
  return "opt_out";
}

function carimbo(dia: string, hora: number, minuto: number): string {
  return `${dia}T${String(hora).padStart(2, "0")}:${String(minuto).padStart(2, "0")}:00`;
}

/**
 * Percorre o caminho do serviço real e devolve o que ele teria produzido nos últimos dias.
 *
 * A data não é sorteada: sorteia-se o **vencimento**, e quem diz em que dia a mensagem saiu é
 * `resolverData` — a mesma função que a aba de réguas usa na coluna "cai em". Fica no log só o que
 * cai dentro da janela, e é por isso que uma etapa em dias úteis rende um log diferente da mesma
 * etapa em dias corridos, sem nada aqui saber o que é um feriado.
 */
function gerar(): Mensagem[] {
  const { clientes, vinculos } = carteiraAtual();
  const reguas = reguasAtuais();
  const templates = templatesAtuais();

  const inicio = somarDias(HOJE, -(DIAS_DE_LOG - 1));
  const mensagens: Mensagem[] = [];

  clientes.forEach((cliente, indice) => {
    const vinculo = vinculos[cliente.id] ?? vinculoVazio(cliente.id);
    const regua = reguaDoCliente(reguas, vinculo.reguaId);
    const barrado = bloqueio(cliente, vinculo);

    for (const etapa of regua.etapas) {
      // Etapa desligada ou sem template não monta nada — nem para ser suprimida depois.
      if (!etapa.ativa || !etapa.template) continue;
      const template = templates.find((t) => t.nome === etapa.template);
      if (!template) continue;

      // Quatro vencimentos por etapa; sobrevive o que cai dentro da janela do log.
      for (let tentativa = 0; tentativa < 4; tentativa++) {
        const vencimento = somarDias(HOJE, -20 + Math.floor(sorteio() * 28));
        const dia = resolverData(vencimento, etapa.deslocamento, etapa.contagem);
        if (dia < inicio || dia > HOJE) continue;

        const hora = 9 + Math.floor(sorteio() * 9);
        const minuto = Math.floor(sorteio() * 60);
        // Hoje ainda está enchendo: mensagem com hora no futuro é glitch visível num log.
        if (dia === HOJE && hora > AGORA.getHours()) continue;

        const { status, motivo } = barrado
          ? { status: "suprimida" as Status, motivo: barrado }
          : statusSorteado();
        const resposta = respostaSorteada(status);

        const quantos = sorteio() < 0.35 ? 1 + Math.floor(sorteio() * 4) : 1;
        const lista = titulos(quantos, vencimento, indice + mensagens.length);
        const total = lista.reduce((soma, t) => soma + t.valor, 0);

        mensagens.push({
          id: `msg-${String(mensagens.length + 1).padStart(3, "0")}`,
          // O lote monta cedo, uma vez por dia, antes da janela de envio.
          montadaEm: carimbo(dia, 7, 0),
          enviadaEm:
            status === "suprimida" || status === "adiada" ? null : carimbo(dia, hora, minuto),
          clienteId: cliente.id,
          cliente: cliente.razaoSocial,
          telefone: vinculo.numeroVinculado ?? cliente.telefone ?? "—",
          reguaId: regua.id,
          reguaNome: regua.nome,
          etapaId: etapa.id,
          etapaNome: etapa.nome,
          template: template.nome,
          templateVersao: template.versao,
          status,
          motivo,
          resposta,
          respondidaEm:
            resposta === "nenhuma" ? null : carimbo(dia, Math.min(hora + 1, 19), minuto),
          titulos: lista,
          texto: renderizar(template.corpo, {
            // Os exemplos do catálogo cobrem o que a régua não sabe preencher; o que ela sabe
            // vem por cima. Variável fora do catálogo fica em pé no texto, e é para ficar.
            ...Object.fromEntries(VARIAVEIS.map((v) => [v.chave, v.exemplo])),
            cliente: cliente.razaoSocial,
            valor: formatCurrency(total, "BRL"),
            vencimento: formatDateOnly(vencimento),
          }),
        });
      }
    }
  });

  // Do mais recente para o mais antigo: um log se lê de cima. A string ISO ordena como texto.
  return mensagens.sort((a, b) =>
    (b.enviadaEm ?? b.montadaEm).localeCompare(a.enviadaEm ?? a.montadaEm),
  );
}

const LOG: Mensagem[] = gerar();

export function listarMensagens(): Promise<Mensagem[]> {
  return esperar(LOG.map((m) => ({ ...m })));
}

/** A janela que o log cobre, para a tela dizer de quando ela está falando. */
export const PERIODO_DO_LOG = {
  de: somarDias(HOJE, -(DIAS_DE_LOG - 1)),
  ate: HOJE,
};
