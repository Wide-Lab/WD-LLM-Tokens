/**
 * O dashboard de disparos — a leitura agregada do log da régua.
 *
 * É a mesma pergunta que a simulação de 30 dias respondia no protótipo, virada para trás: lá o
 * gráfico contava o que a régua **produziria** a partir de hoje, e servia para decidir se dava para
 * mexer numa etapa; aqui ele conta o que ela **já mandou**, e serve para saber o que a decisão de
 * ontem custou em volume. Por isso o teto diário some junto com a simulação: teto é limite de
 * capacidade sobre o futuro, e sobre o passado ele não corta nada — o que estourou o teto já foi
 * adiado pelo próprio motor, e aparece no log como `adiada`.
 *
 * **O que este arquivo conta é só o que saiu.** `saiu` é a fronteira: `suprimida` e `adiada` são
 * decisão nossa e nunca chegaram à Meta, e somá-las aqui faria o dashboard prometer um volume que
 * não existiu. Quem responde "por que o número não é maior" é a aba de mensagens, linha a linha,
 * com o motivo ao lado — este arquivo não repete essa conta.
 *
 * Ele não guarda dado nenhum: recebe o log pronto e agrega. Quando a rota existir e a agregação
 * vier do banco por `GROUP BY`, é este arquivo que sai, e não a tela.
 */

import { somarDias } from "@/lib/calendario";
import { saiu, type Mensagem } from "@/lib/mensagens-disparo";
import { raizDe, reguaPadrao, rotuloDe, type Regua } from "@/lib/reguas";

export interface Periodo {
  /** `AAAA-MM-DD`, os dois inclusivos. */
  de: string;
  ate: string;
}

/**
 * O dia a que a mensagem pertence no eixo.
 *
 * É o dia do envio, não o da montagem do lote: o lote monta de madrugada e a mensagem sai na janela
 * do mesmo dia, então os dois quase sempre coincidem — mas quando não coincidirem, o dashboard fala
 * do que saiu, e `montadaEm` responderia outra pergunta.
 */
export function diaDe(mensagem: Mensagem): string {
  return (mensagem.enviadaEm ?? mensagem.montadaEm).slice(0, 10);
}

/**
 * O recorte da tela: o que saiu, dentro do período.
 *
 * Os dois filtros andam juntos de propósito. Contar cliente sobre o log inteiro e mensagem sobre o
 * período daria dois números que não se somam — e é assim que um cartão passa a contradizer o
 * gráfico embaixo dele sem nenhum erro visível.
 */
export function enviadasNoPeriodo(mensagens: Mensagem[], periodo: Periodo): Mensagem[] {
  return mensagens.filter((m) => {
    if (!saiu(m)) return false;
    const dia = diaDe(m);
    return dia >= periodo.de && dia <= periodo.ate;
  });
}

export interface Resumo {
  mensagens: number;
  /** Distintos: o mesmo cliente em quatro etapas é um cliente, não quatro. */
  clientes: number;
  /** Títulos citados. Uma mensagem consolida vários, então isto é sempre ≥ `mensagens`. */
  titulos: number;
}

export function resumir(enviadas: Mensagem[]): Resumo {
  return {
    mensagens: enviadas.length,
    clientes: new Set(enviadas.map((m) => m.clienteId)).size,
    titulos: enviadas.reduce((soma, m) => soma + m.titulos.length, 0),
  };
}

/**
 * Uma série do gráfico: a etapa como o dashboard a conta.
 *
 * `id` é a **raiz** — a etapa da padrão de que a etapa da régua veio (`raizDe`). O "Preventivo" das
 * três réguas é a mesma etapa com deslocamento diferente em cada uma, e uma barra por régua
 * responderia "quantas réguas existem", que não é a pergunta. É o mesmo agrupamento que o filtro do
 * log usa, para as duas abas recortarem igual.
 *
 * `rotulo` e `ordem` vêm do deslocamento na régua de origem, porque é ele que dá o eixo do tempo da
 * seção. Etapa cuja raiz não existe mais — régua excluída depois do disparo — fica sem rótulo e cai
 * no fim: o log é foto e não se reescreve, então some o `D+n`, não a linha.
 */
export interface SerieDeEtapa {
  id: string;
  nome: string;
  /** `D-3` / `D0` / `D+2`, ou `—` quando a etapa não existe mais em régua nenhuma. */
  rotulo: string;
  ordem: number;
}

/** Etapa apagada ordena depois de qualquer `D+n` plausível, sem virar caso especial na ordenação. */
const SEM_ORIGEM = Number.MAX_SAFE_INTEGER;

interface Indice {
  /** `etapaId` da régua → raiz. Etapa desconhecida vira raiz de si mesma. */
  raizes: Map<string, string>;
  /** Raiz → como ela se chama e onde ela cai no eixo. */
  catalogo: Map<string, { nome: string; rotulo: string; ordem: number }>;
}

/**
 * O de-para de etapa para série, montado uma vez e passado adiante.
 *
 * A padrão entra por último de propósito: quando a mesma raiz aparece em duas réguas com nomes
 * diferentes, quem nomeia a série é a padrão, que é de onde a raiz veio.
 */
function indexar(reguas: Regua[]): Indice {
  const raizes = new Map<string, string>();
  const catalogo = new Map<string, { nome: string; rotulo: string; ordem: number }>();
  if (reguas.length === 0) return { raizes, catalogo };

  const padrao = reguaPadrao(reguas);
  const ordenadas = [...reguas.filter((r) => r.id !== padrao.id), padrao];

  for (const regua of ordenadas) {
    for (const etapa of regua.etapas) {
      const raiz = raizDe(etapa);
      raizes.set(etapa.id, raiz);
      catalogo.set(raiz, { nome: etapa.nome, rotulo: rotuloDe(etapa), ordem: etapa.deslocamento });
    }
  }

  return { raizes, catalogo };
}

/**
 * As séries que o período de fato teve, na ordem da régua.
 *
 * Só entra etapa com mensagem no recorte: desenhar todas sempre encheria a legenda de etapas que
 * não dispararam, e legenda que lista o que não está no gráfico ensina a não ler a legenda. É a
 * mesma regra do empilhado por categoria no painel de WhatsApp.
 */
export function seriesDeEtapa(enviadas: Mensagem[], reguas: Regua[]): SerieDeEtapa[] {
  const { raizes, catalogo } = indexar(reguas);
  const presentes = new Map<string, SerieDeEtapa>();

  for (const mensagem of enviadas) {
    const id = raizes.get(mensagem.etapaId) ?? mensagem.etapaId;
    if (presentes.has(id)) continue;
    const info = catalogo.get(id);
    presentes.set(id, {
      id,
      nome: info?.nome ?? mensagem.etapaNome,
      rotulo: info?.rotulo ?? "—",
      ordem: info?.ordem ?? SEM_ORIGEM,
    });
  }

  return [...presentes.values()].sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome));
}

/** Uma linha do gráfico: o dia, o total e uma coluna por série de etapa. */
export type LinhaDoDia = Record<string, string | number>;

/**
 * Uma linha por dia do período, **inclusive os dias sem envio**.
 *
 * O recharts desenha só o que está na lista, e pular o dia vazio encostaria sexta em segunda como
 * se fossem consecutivas — num eixo de dias, isso apaga exatamente o desenho que a tela existe para
 * mostrar: a régua se pendura em vencimentos, que se concentram, e o vale entre dois picos é dado.
 * Zero aqui é afirmação, não ausência de resposta.
 */
export function porDia(enviadas: Mensagem[], reguas: Regua[], periodo: Periodo): LinhaDoDia[] {
  const { raizes } = indexar(reguas);
  const linhas = new Map<string, LinhaDoDia>();

  for (let dia = periodo.de; dia <= periodo.ate; dia = somarDias(dia, 1)) {
    linhas.set(dia, { dia, rotulo: rotuloDoDia(dia), total: 0 });
  }

  for (const mensagem of enviadas) {
    const linha = linhas.get(diaDe(mensagem));
    if (!linha) continue;
    const serie = raizes.get(mensagem.etapaId) ?? mensagem.etapaId;
    linha[serie] = (Number(linha[serie]) || 0) + 1;
    linha.total = Number(linha.total) + 1;
  }

  return [...linhas.values()];
}

/** O total de cada série no período — o mesmo gráfico somado no outro eixo. */
export function volumePorEtapa(
  enviadas: Mensagem[],
  reguas: Regua[],
): Array<{ etapa: SerieDeEtapa; total: number }> {
  const { raizes } = indexar(reguas);
  const totais = new Map<string, number>();

  for (const mensagem of enviadas) {
    const serie = raizes.get(mensagem.etapaId) ?? mensagem.etapaId;
    totais.set(serie, (totais.get(serie) ?? 0) + 1);
  }

  return seriesDeEtapa(enviadas, reguas).map((etapa) => ({
    etapa,
    total: totais.get(etapa.id) ?? 0,
  }));
}

/** `12/08`. O ano não entra: o eixo tem duas semanas, e repeti-lo em cada tick é ruído. */
export function rotuloDoDia(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

/**
 * O período pedido, cortado pelo que o log tem.
 *
 * Existe porque a janela do mock é fixa e curta: sem o corte, escolher "o mês passado" desenharia
 * trinta barras zeradas e diria, pela forma, que a régua não mandou nada — quando o que houve foi a
 * pergunta cair fora do que existe para responder. Some junto com o mock, no dia em que o corte
 * passar a ser cláusula de `WHERE`.
 */
export function limitar(periodo: Periodo, janela: Periodo): Periodo {
  const de = periodo.de < janela.de ? janela.de : periodo.de;
  const ate = periodo.ate > janela.ate ? janela.ate : periodo.ate;
  return { de, ate: ate < de ? de : ate };
}
