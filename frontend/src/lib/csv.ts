/**
 * O leitor de CSV da importação de preços.
 *
 * Escrito à mão, e não trazido de uma biblioteca, porque o que se importa aqui é uma tabela de
 * preços: dezenas de linhas, coladas de uma planilha, uma vez a cada reajuste. O que precisa
 * funcionar é o que a planilha de fato cospe — aspas em volta do campo que tem separador dentro,
 * `;` de Excel em português, BOM do UTF-8 do Windows — e nada além disso.
 */

/**
 * A marca de ordem de bytes que o Excel põe na frente do arquivo UTF-8.
 *
 * Escrita por código e não como caractere no fonte porque ela é invisível — no editor, um literal
 * aqui pareceria uma string vazia. Se ficar, gruda no nome da primeira coluna e o cabeçalho
 * `modelo` deixa de casar com `modelo`.
 */
const BOM = String.fromCharCode(0xfeff);

/** Uma linha já casada com o cabeçalho: nome da coluna normalizado, valor cru. */
export type LinhaCsv = Record<string, string>;

export interface TabelaCsv {
  /** Os nomes de coluna como ficaram depois de normalizados — o que a tela pode conferir. */
  colunas: string[];
  linhas: LinhaCsv[];
}

/**
 * O separador, deduzido do cabeçalho.
 *
 * Excel em pt-BR salva com `;` e usa a vírgula como decimal; o resto do mundo salva com `,`.
 * Adivinhar pelo que aparece mais na primeira linha erra menos do que fixar um dos dois e recusar
 * metade das planilhas — e `paraNumero` cobre o decimal com vírgula que vem junto.
 */
function detectarSeparador(primeiraLinha: string): string {
  let melhor = ",";
  let maior = 0;
  for (const c of [";", ",", "\t"]) {
    const quantos = primeiraLinha.split(c).length - 1;
    if (quantos > maior) {
      maior = quantos;
      melhor = c;
    }
  }
  return melhor;
}

/** Os acentos que o `NFD` desgruda da letra (U+0300 a U+036F) — invisíveis no fonte, como o BOM. */
const ACENTOS = new RegExp(`[${String.fromCharCode(0x300)}-${String.fromCharCode(0x36f)}]`, "g");

/** Nome de coluna sem acento, espaço nem caixa — `Vigência Início` e `vigencia_inicio` viram o mesmo. */
function normalizarColuna(nome: string): string {
  return nome
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(ACENTOS, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

/** Quebra o texto em registros, respeitando aspas — dentro delas, separador e quebra de linha são texto. */
function dividirRegistros(texto: string, separador: string): string[][] {
  const registros: string[][] = [];
  let registro: string[] = [];
  let campo = "";
  let entreAspas = false;

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];

    if (entreAspas) {
      if (c === '"') {
        // Aspas dobradas são uma aspa literal; sozinha, fecha o campo.
        if (texto[i + 1] === '"') {
          campo += '"';
          i++;
        } else {
          entreAspas = false;
        }
      } else {
        campo += c;
      }
      continue;
    }

    if (c === '"') {
      entreAspas = true;
    } else if (c === separador) {
      registro.push(campo);
      campo = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && texto[i + 1] === "\n") i++;
      registro.push(campo);
      campo = "";
      registros.push(registro);
      registro = [];
    } else {
      campo += c;
    }
  }

  registro.push(campo);
  registros.push(registro);

  // Linha em branco no fim do arquivo é o caso comum, e uma linha vazia no meio não é um preço.
  return registros.filter((r) => r.some((c) => c.trim() !== ""));
}

/**
 * O texto colado ou o arquivo escolhido, virado em linhas com nome de coluna.
 *
 * A primeira linha é sempre cabeçalho: sem ele não dá para saber qual número é entrada e qual é
 * saída, e trocar os dois cadastraria o preço invertido sem nenhum erro aparecer.
 */
export function lerCsv(texto: string): TabelaCsv {
  const limpo = (texto.startsWith(BOM) ? texto.slice(1) : texto).trim();
  if (!limpo) return { colunas: [], linhas: [] };

  const separador = detectarSeparador(limpo.split(/\r?\n/, 1)[0] ?? "");
  const registros = dividirRegistros(limpo, separador);
  if (registros.length === 0) return { colunas: [], linhas: [] };

  const colunas = registros[0].map(normalizarColuna);

  const linhas = registros.slice(1).map((registro) => {
    const linha: LinhaCsv = {};
    colunas.forEach((nome, i) => {
      if (nome) linha[nome] = (registro[i] ?? "").trim();
    });
    return linha;
  });

  return { colunas, linhas };
}

/** O primeiro dos nomes aceitos que veio preenchido — é o que permite sinônimo de coluna. */
export function coluna(linha: LinhaCsv, ...nomes: string[]): string {
  for (const nome of nomes) {
    const valor = linha[nome];
    if (valor) return valor;
  }
  return "";
}

/**
 * O que uma vírgula sozinha não consegue dizer: `1,500` é mil e quinhentos ou um e meio?
 *
 * Grupo de exatamente três dígitos, sem ponto decimal em lugar nenhum e sem zero na frente — a
 * forma em que o milhar americano e o decimal brasileiro são o mesmo texto e diferem por mil
 * vezes. `0,075` não entra aqui (ninguém agrupa milhar depois do zero) e `1,50` nem `1,5`
 * tampouco. Adivinhar erraria calado; recusar manda a linha de volta para quem sabe qual é.
 */
const MILHAR_AMBIGUO = /^[1-9]\d{0,2}(,\d{3})+$/;

/** Tira o que a planilha põe em volta do número: cifrão e espaço. */
function semEnfeite(valor: string): string {
  return valor
    .trim()
    .replace(/^(us\$|r\$|\$)\s*/i, "")
    .replace(/\s/g, "");
}

/** Se o valor é dos que `paraNumero` recusa por não dar para saber onde está o decimal. */
export function ambiguoPorMilhar(valor: string): boolean {
  return MILHAR_AMBIGUO.test(semEnfeite(valor));
}

/**
 * Um valor de dinheiro, mantido como **texto** até o backend.
 *
 * Passar por `Number` e voltar para string é o caminho curto para uma tarifa de cache virar
 * `0.0000009999999999` no `Decimal` do banco. Aqui só se tira o que a planilha põe em volta
 * (cifrão, espaço) e se troca a vírgula decimal por ponto.
 */
export function paraNumero(valor: string): string | null {
  let t = semEnfeite(valor);
  if (!t) return null;
  if (MILHAR_AMBIGUO.test(t)) return null;
  if (t.includes(",") && !t.includes(".")) t = t.replace(",", ".");
  return /^\d+(\.\d+)?$/.test(t) ? t : null;
}

/** A data em ISO. Aceita `31/12/2026` porque é assim que a planilha em pt-BR exibe e exporta. */
export function paraDataISO(valor: string): string | null {
  const t = valor.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;

  const br = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;

  return null;
}
