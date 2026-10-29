/**
 * O log de mensagens da régua — o que os dois cadastros de Disparos causaram.
 *
 * O nome do arquivo carrega o `-disparo` de propósito: já existe uma lista de mensagens no painel,
 * em `/whatsapp/mensagens`, e as duas **não** são a mesma coisa. Lá a linha é o que a Meta cobrou:
 * existe porque houve `wamid`, e é por isso que ela soma no custo. Aqui a linha é o que a régua
 * decidiu, **inclusive quando decidiu não mandar** — uma mensagem suprimida ou adiada nunca chegou
 * à Meta, não tem `wamid`, não custa nada, e mesmo assim é o registro mais importante da tela: é a
 * única prova de que o bloqueio da carteira funcionou. Uma aba só com o que saiu seria a aba do
 * WhatsApp de novo, com outro título.
 *
 * Por isso este log é leitura de Disparos e não uma quarta aba do WhatsApp: o WhatsApp é o canal, e
 * este arquivo fala do que foi decidido antes de o canal ser usado.
 *
 * Dois eixos, separados de propósito — e é a decisão que este módulo existe para segurar:
 *
 * - **`status`** é o que aconteceu com a mensagem que *nós* mandamos: os estados da Meta
 *   (`enviada → entregue → lida`, mais `falhou`), e antes deles `adiada` e `suprimida`, que são
 *   anteriores a existir `wamid` — a régua montou e a mensagem não saiu.
 * - **`resposta`** é o que o *cliente* fez depois. Não é um estado da mensagem que saiu: se
 *   "recebida" virasse status, o log ficaria errado justamente no dia em que alguém responder "já
 *   paguei" — e é esse dia que interessa.
 *
 * Uma linha por mensagem, e a resposta é coluna da mesma linha, não linha nova.
 *
 * A linha guarda a régua e a etapa que a geraram. Sem isso não há como responder "por que este
 * cliente recebeu em D+1 e aquele em D+2", que é a primeira pergunta que atribuir régua por cliente
 * cria — e a rastreabilidade se completa com a versão do template vigente no disparo, porque o
 * texto que saiu é o daquela versão e não o que está no catálogo hoje.
 */

/** O `wamid` só existe a partir de `enviada`. Os dois primeiros são decisão nossa, não da Meta. */
export type Status = "suprimida" | "adiada" | "enviada" | "entregue" | "lida" | "falhou";

/** O que o cliente fez. `nenhuma` é o caso comum: silêncio segue a régua. */
export type Resposta =
  "nenhuma" | "comprovante" | "promessa" | "divergencia" | "pediu_segunda_via" | "opt_out";

export const STATUS: Record<Status, string> = {
  suprimida: "Suprimida",
  adiada: "Adiada",
  enviada: "Enviada",
  entregue: "Entregue",
  lida: "Lida",
  falhou: "Falhou",
};

export const RESPOSTAS: Record<Resposta, string> = {
  nenhuma: "—",
  comprovante: "Mandou comprovante",
  promessa: "Prometeu pagar",
  divergencia: "Contestou valor",
  pediu_segunda_via: "Pediu 2ª via",
  opt_out: "Pediu para sair",
};

/**
 * A cor do status, e ela é só tinta — nem violeta, nem petróleo.
 *
 * A paleta do painel não tem verde de "ok" nem âmbar de "espere", pelo motivo que `styles.css`
 * declara e `selo-estado-meta.tsx` já enfrentou: violeta é dinheiro e petróleo é token, e gastar um
 * dos dois num status faria a cor mentir na tela em que ela é o dado. Sobra a escala neutra mais o
 * `destructive`, e aqui isso basta porque o status **é uma rampa**: quanto mais longe a mensagem
 * chegou, mais escura a tinta. `suprimida` e `adiada` são as mais apagadas porque não saíram —
 * não é erro, é decisão da régua, e o motivo ao lado é que diz qual. `falhou` é o único em
 * `destructive`: é o único em que algo quebrou.
 */
export const COR_STATUS: Record<Status, string> = {
  suprimida: "text-muted-foreground",
  adiada: "text-muted-foreground",
  enviada: "text-foreground/60",
  entregue: "text-foreground/80",
  lida: "text-foreground",
  falhou: "text-destructive",
};

/** Um título consolidado na mensagem. É foto do portal no dia, não consulta. */
export interface TituloCobrado {
  numero: string;
  /** `AAAA-MM-DD`. É a âncora de que a etapa se pendurou para cair no dia em que caiu. */
  vencimento: string;
  valor: number;
}

export interface Mensagem {
  id: string;
  /** Quando a régua montou o lote. Em `adiada` e `suprimida` é o único carimbo que existe. */
  montadaEm: string;
  /** `null` enquanto não saiu — e em `suprimida`/`adiada` nunca sai. */
  enviadaEm: string | null;
  /** A chave do portal. O nome vem copiado junto porque o log é foto, não consulta. */
  clienteId: string;
  cliente: string;
  telefone: string;
  /** Qual régua decidiu por este cliente: a padrão ou a atribuída no vínculo. */
  reguaId: string;
  reguaNome: string;
  etapaId: string;
  etapaNome: string;
  /** O `name` da Meta e a versão vigente no disparo — não a que está no catálogo hoje. */
  template: string;
  templateVersao: number;
  status: Status;
  /** Por que foi suprimida, adiada ou falhou. Nulo quando não há o que explicar. */
  motivo: string | null;
  resposta: Resposta;
  respondidaEm: string | null;
  /** Consolidados: uma mensagem por cliente e data de vencimento, não uma por boleto. */
  titulos: TituloCobrado[];
  /** O texto como saiu, com as variáveis já trocadas. */
  texto: string;
}

/** A mensagem chegou a existir para a Meta? É o que separa custo de decisão. */
export function saiu(m: Mensagem): boolean {
  return m.status !== "suprimida" && m.status !== "adiada";
}

/**
 * A soma dos títulos da mensagem.
 *
 * É dívida do cliente no portal, não gasto do painel — e por isso sai em mono **sem** o violeta de
 * custo, pelo mesmo motivo do valor em aberto da carteira.
 */
export function valorTotal(m: Mensagem): number {
  return m.titulos.reduce((soma, t) => soma + t.valor, 0);
}

/**
 * A resposta tira o título da automação e chama gente?
 *
 * Comprovante, contestação e pedido de saída, sim — os três mudam o que a régua deveria fazer em
 * seguida, e continuar disparando depois de qualquer um deles é o erro caro desta seção. Promessa
 * e pedido de segunda via não: a régua segue, e é para isso que ela existe.
 */
export function escala(resposta: Resposta): boolean {
  return resposta === "comprovante" || resposta === "divergencia" || resposta === "opt_out";
}
