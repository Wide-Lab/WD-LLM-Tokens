/**
 * A janela de envio e o calendário — o que transforma `D-3` numa data.
 *
 * Constante neste arquivo, e não cadastro de tela, porque no serviço real janela, feriados e
 * frequência são **registro único** da operação, não tabela: valem para todas as réguas de uma
 * vez. Enquanto essa tela não existe, a régua ainda precisa saber em que dia cai um `D-3 em dias
 * úteis` — sem isso `contagem` vira campo que não muda nada visível, e campo assim ninguém
 * preenche direito.
 *
 * Tudo em `AAAA-MM-DD` e a aritmética em UTC, de propósito: a régua raciocina em dia, não em
 * instante, e `new Date("2026-09-10")` lido no fuso local já nasce um dia atrás em Florianópolis —
 * o mesmo motivo pelo qual `formatDateOnly` (`lib/format.ts`) fatia a string em vez de parseá-la.
 */

import type { Contagem } from "@/lib/reguas";

const DIA_EM_MS = 86_400_000;

export const DIAS_DA_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"] as const;

/** Segunda a sexta. Fim de semana não é dia de cobrança, e o dia 0 é domingo. */
const DIAS_DE_ENVIO = [1, 2, 3, 4, 5];

/**
 * Feriados de 2026, nacionais mais Florianópolis.
 *
 * O 7 de setembro está aqui de propósito: é o que faz o preventivo em dias úteis de um vencimento
 * do dia 10 andar para trás e mostrar, no cadastro, por que `contagem` existe. Facultativo também
 * conta — quem põe a data no calendário está dizendo que a régua não fala naquele dia.
 */
const FERIADOS: Record<string, string> = {
  "2026-01-01": "Confraternização Universal",
  "2026-02-16": "Carnaval",
  "2026-02-17": "Carnaval",
  "2026-03-23": "Aniversário de Florianópolis",
  "2026-04-03": "Sexta-feira Santa",
  "2026-04-21": "Tiradentes",
  "2026-05-01": "Dia do Trabalho",
  "2026-06-04": "Corpus Christi",
  "2026-08-11": "Dia de Santa Catarina",
  "2026-09-07": "Independência",
  "2026-10-12": "Nossa Senhora Aparecida",
  "2026-11-02": "Finados",
  "2026-11-15": "Proclamação da República",
  "2026-11-20": "Consciência Negra",
  "2026-12-08": "Nossa Senhora da Conceição",
  "2026-12-25": "Natal",
};

/**
 * Os dois vencimentos com que a tela demonstra a etapa.
 *
 * Dois, e não um: um vencimento só faria a coluna "cai em" parecer um dado da etapa, quando ela é
 * o resultado de uma conta. O do dia 10 cai perto do feriado de 7 de setembro e o do dia 25 não —
 * é o par que mostra dias úteis e corridos divergindo sem precisar de explicação escrita.
 */
export const VENCIMENTOS_DE_EXEMPLO = ["2026-09-10", "2026-09-25"];

function paraData(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

/** Anda `dias` no calendário. Exportado porque o log de disparos monta a janela dele com isto. */
export function somarDias(iso: string, dias: number): string {
  return new Date(paraData(iso).getTime() + dias * DIA_EM_MS).toISOString().slice(0, 10);
}

export function diaDaSemana(iso: string): number {
  return paraData(iso).getUTCDay();
}

export function feriadoEm(iso: string): string | undefined {
  return FERIADOS[iso];
}

/** O dia aceita envio? Fim de semana não, feriado do calendário nunca — inclusive o facultativo. */
export function ehDiaDeEnvio(iso: string): boolean {
  return DIAS_DE_ENVIO.includes(diaDaSemana(iso)) && feriadoEm(iso) === undefined;
}

/**
 * A data em que uma etapa cai: âncora + deslocamento + contagem.
 *
 * Em dias corridos é soma simples, e o resultado **pode** cair fora da janela — a tela mostra isso
 * em vez de corrigir, porque depois do vencimento a data importa juridicamente e empurrar o
 * disparo é decisão de quem opera, não desta função. Em dias úteis anda `n` dias de envio a partir
 * da âncora, que é o que faz o preventivo de setembro sair numa data diferente da de todo mês.
 */
export function resolverData(ancora: string, deslocamento: number, contagem: Contagem): string {
  if (contagem === "corridos") return somarDias(ancora, deslocamento);

  const passo = deslocamento < 0 ? -1 : 1;
  let restantes = Math.abs(deslocamento);
  let data = ancora;
  // Guarda contra calendário mal preenchido: um ano inteiro de feriado não trava o laço.
  let voltas = 0;
  while (restantes > 0 && voltas < 400) {
    data = somarDias(data, passo);
    if (ehDiaDeEnvio(data)) restantes--;
    voltas++;
  }
  return data;
}
