import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { ChevronRight, FileUp, Info, Loader2, TriangleAlert, Upload } from "lucide-react";
import { toast } from "sonner";

import { StatusPill, type TomDeStatus } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { apiPost } from "@/lib/api";
import {
  ambiguoPorMilhar,
  coluna,
  lerCsv,
  paraDataISO,
  paraNumero,
  type LinhaCsv,
} from "@/lib/csv";
import { formatDateOnly, formatTarifa } from "@/lib/format";
import { devolverFocoA } from "@/lib/utils";
import {
  CATEGORIAS_COBRAVEIS,
  invalidarCusto,
  mensagemDoErro,
  type OrigemDeCusto,
} from "@/lib/precos";

/**
 * A importação da tabela de preços.
 *
 * O formulário de uma linha só resolve o reajuste do mês; ele não resolve o dia em que o painel
 * estreia, nem o dia em que um provedor mexe no preço de doze modelos de uma vez — aí são dezenas de
 * diálogos abertos e fechados na mão, com o custo do painel inteiro em branco até o último. A tabela
 * de preços já existe em algum lugar antes de existir aqui: é uma planilha, ou a página de preços do
 * provedor colada numa. Esta tela é a porta para ela entrar inteira.
 *
 * Não há `POST` em lote no backend, e não se inventou um: são N chamadas às mesmas rotas de sempre,
 * uma de cada vez. A consequência é que a importação **não é atômica** — pode gravar metade —, e o
 * jeito de não mentir sobre isso é a tela dizer linha a linha o que entrou e o que não entrou.
 */

/** Uma linha do CSV já traduzida para o corpo que a rota espera. */
interface Preparada {
  /** Como a linha se chama na tela: o que ela precifica. */
  rotulo: string;
  /** As tarifas como a tabela vai mostrá-las, para conferir antes de mandar. */
  detalhe: string;
  /** A vigência lida, em ISO — a coluna de data da prévia. */
  desde: string;
  corpo: Record<string, string | null>;
}

/** O resultado do preparo de uma linha: ou ela virou um preço, ou tem um defeito com nome. */
interface Preparo {
  /** A linha no arquivo, contando o cabeçalho — é o número que o usuário vê na planilha. */
  numero: number;
  item: Preparada | null;
  erro: string | null;
}

/** A recusa do número, dita pelo motivo — o ambíguo não é "não é um número", é "qual dos dois?". */
function erroDeNumero(rotulo: string, cru: string): { erro: string } {
  return ambiguoPorMilhar(cru)
    ? { erro: `${rotulo}: "${cru}" tanto pode ser milhar quanto decimal — use ponto no decimal` }
    : { erro: `${rotulo}: "${cru}" não é um número` };
}

function numeroObrigatorio(
  linha: LinhaCsv,
  rotulo: string,
  ...nomes: string[]
): string | { erro: string } {
  const cru = coluna(linha, ...nomes);
  if (!cru) return { erro: `falta ${rotulo}` };
  return paraNumero(cru) ?? erroDeNumero(rotulo, cru);
}

function numeroOpcional(
  linha: LinhaCsv,
  rotulo: string,
  padrao: string,
  ...nomes: string[]
): string | { erro: string } {
  const cru = coluna(linha, ...nomes);
  if (!cru) return padrao;
  return paraNumero(cru) ?? erroDeNumero(rotulo, cru);
}

function ehErro(v: string | { erro: string }): v is { erro: string } {
  return typeof v !== "string";
}

/** A tarifa já lida (texto com ponto decimal) no formato da tabela de preços. */
function tarifa(valor: string, moeda: string): string {
  return formatTarifa(Number(valor), moeda);
}

function prepararModelo(linha: LinhaCsv): Preparada | { erro: string } {
  const modelo = coluna(linha, "modelo", "model");
  if (!modelo) return { erro: "falta o modelo" };

  const dataCrua = coluna(linha, "vigencia_inicio", "vigencia", "inicio", "data");
  if (!dataCrua) return { erro: "falta a vigência de início" };
  const vigencia = paraDataISO(dataCrua);
  if (!vigencia) return { erro: `vigência "${dataCrua}": use 2026-01-31 ou 31/01/2026` };

  const entrada = numeroObrigatorio(linha, "entrada", "entrada_por_milhao", "entrada", "input");
  if (ehErro(entrada)) return entrada;

  const saida = numeroObrigatorio(linha, "saída", "saida_por_milhao", "saida", "output");
  if (ehErro(saida)) return saida;

  // Cache ausente vira zero, e não erro: modelo sem cache é a maioria, e a planilha do provedor
  // simplesmente não traz a coluna. Zero aqui é o que o formulário de uma linha já preenche sozinho.
  const cacheLeitura = numeroOpcional(
    linha,
    "cache de leitura",
    "0",
    "cache_leitura_por_milhao",
    "cache_leitura",
    "cache_read",
  );
  if (ehErro(cacheLeitura)) return cacheLeitura;

  const cacheEscrita = numeroOpcional(
    linha,
    "cache de escrita",
    "0",
    "cache_escrita_por_milhao",
    "cache_escrita",
    "cache_write",
  );
  if (ehErro(cacheEscrita)) return cacheEscrita;

  const provedor = coluna(linha, "provedor", "provider") || null;
  const moeda = coluna(linha, "moeda", "currency") || "USD";

  return {
    rotulo: modelo,
    detalhe: [
      provedor,
      `entrada ${tarifa(entrada, moeda)}`,
      `saída ${tarifa(saida, moeda)}`,
      `cache ${tarifa(cacheLeitura, moeda)} / ${tarifa(cacheEscrita, moeda)}`,
    ]
      .filter(Boolean)
      .join(" · "),
    desde: vigencia,
    corpo: {
      modelo,
      provedor,
      vigencia_inicio: vigencia,
      entrada_por_milhao: entrada,
      saida_por_milhao: saida,
      cache_leitura_por_milhao: cacheLeitura,
      cache_escrita_por_milhao: cacheEscrita,
      moeda,
    },
  };
}

function prepararMensagem(linha: LinhaCsv): Preparada | { erro: string } {
  const categoria = coluna(linha, "categoria", "category").toLowerCase();
  if (!categoria) return { erro: "falta a categoria" };
  if (categoria === "service") {
    return { erro: "service não tem tarifa: a Meta não cobra mensagem de serviço" };
  }
  const cobravel = CATEGORIAS_COBRAVEIS.find((c) => c.chave === categoria);
  if (!cobravel) {
    return {
      erro: `categoria "${categoria}": use ${CATEGORIAS_COBRAVEIS.map((c) => c.chave).join(", ")}`,
    };
  }

  // Maiúsculas na entrada, como no formulário: o preço casa com a mensagem por igualdade de texto,
  // e `br` importado com `BR` recebido não dá erro nenhum — dá custo em branco para sempre.
  const pais = coluna(linha, "pais", "country").toUpperCase();
  if (!/^[A-Z]{2}$/.test(pais)) return { erro: `país "${pais || "—"}": use a sigla de 2 letras` };

  const dataCrua = coluna(linha, "vigencia_inicio", "vigencia", "inicio", "data");
  if (!dataCrua) return { erro: "falta a vigência de início" };
  const vigencia = paraDataISO(dataCrua);
  if (!vigencia) return { erro: `vigência "${dataCrua}": use 2026-01-31 ou 31/01/2026` };

  const porMensagem = numeroObrigatorio(linha, "por mensagem", "por_mensagem", "preco", "price");
  if (ehErro(porMensagem)) return porMensagem;

  const moeda = coluna(linha, "moeda", "currency") || "USD";

  return {
    rotulo: `${cobravel.nome} · ${pais}`,
    detalhe: `${tarifa(porMensagem, moeda)} por mensagem`,
    desde: vigencia,
    corpo: {
      categoria,
      pais,
      vigencia_inicio: vigencia,
      por_mensagem: porMensagem,
      moeda,
    },
  };
}

interface Formato {
  titulo: string;
  descricao: string;
  rota: string;
  /** A `queryKey` da lista que esta importação enche. */
  chave: string;
  origem: OrigemDeCusto;
  exemplo: string;
  opcionais: string;
  /** O que cada linha vira, no singular e no plural: "preço" no modelo, "tarifa" na mensagem. */
  unidade: [string, string];
  /** O nome da coluna do item na prévia e no resultado. */
  rotuloDoItem: string;
  preparar: (linha: LinhaCsv) => Preparada | { erro: string };
}

const FORMATOS = {
  modelo: {
    titulo: "Importar preços de modelo",
    descricao:
      "Uma linha por vigência, com cabeçalho. Cada linha vira um cadastro novo — preço não se edita.",
    rota: "/v1/precos",
    chave: "precos-modelo",
    origem: "llm",
    exemplo:
      "modelo,provedor,vigencia_inicio,entrada_por_milhao,saida_por_milhao,cache_leitura_por_milhao,cache_escrita_por_milhao\n" +
      "gpt-5.6-terra,openai,2026-01-01,1.25,10,0.125,1.5625",
    opcionais:
      "Provedor, as duas colunas de cache e moeda são opcionais: cache em branco vira zero, e moeda em branco vira USD.",
    unidade: ["preço", "preços"],
    rotuloDoItem: "Preço",
    preparar: prepararModelo,
  },
  mensagem: {
    titulo: "Importar tarifas de mensagem",
    descricao:
      "Uma linha por vigência de categoria e país, com cabeçalho. Cada linha vira um cadastro novo.",
    rota: "/v1/precos/mensagem",
    chave: "precos-mensagem",
    origem: "whatsapp",
    exemplo:
      "categoria,pais,vigencia_inicio,por_mensagem\nutility,BR,2026-01-01,0.008\nmarketing,BR,2026-01-01,0.0625",
    opcionais:
      "Moeda é opcional e em branco vira USD. A categoria service não entra: a Meta não cobra mensagem de serviço.",
    unidade: ["tarifa", "tarifas"],
    rotuloDoItem: "Tarifa",
    preparar: prepararMensagem,
  },
} satisfies Record<string, Formato>;

export type TipoDeImportacao = keyof typeof FORMATOS;

/** O que aconteceu com uma linha depois de mandada. */
interface Resultado {
  numero: number;
  rotulo: string;
  erro: string | null;
}

/**
 * O título do resultado. Mora fora do relatório porque o toast diz a mesma frase: os dois aparecem
 * juntos, e contas diferentes nos dois (enviadas num, linhas do arquivo no outro) confundiriam
 * justamente quando é preciso entender o que ficou de fora. O denominador é o de linhas do arquivo,
 * contando as ignoradas: é o que a pessoa vê na planilha, e linha ignorada também não entrou.
 */
function tituloDoResultado(gravadas: number, total: number): string {
  if (gravadas === total) {
    return total === 1 ? "A linha foi gravada" : `Todas as ${total} linhas foram gravadas`;
  }
  if (gravadas === 0) return "Nenhuma linha foi gravada";
  return `Importação parcial: ${gravadas} de ${total} linhas gravadas`;
}

export function DialogoImportarPrecos({
  tipo,
  aberto,
  onOpenChange,
  origemDoFoco,
}: {
  tipo: TipoDeImportacao;
  aberto: boolean;
  onOpenChange: (v: boolean) => void;
  /** Quem abriu o diálogo, para o foco voltar a ele ao fechar. */
  origemDoFoco?: RefObject<HTMLElement | null>;
}) {
  const formato: Formato = FORMATOS[tipo];
  const queryClient = useQueryClient();
  const arquivoRef = useRef<HTMLInputElement>(null);
  const idDoTexto = `importar-${tipo}-csv`;

  const [texto, setTexto] = useState("");
  const [progresso, setProgresso] = useState(0);
  const [resultados, setResultados] = useState<Resultado[] | null>(null);

  useEffect(() => {
    if (!aberto) return;
    setTexto("");
    setProgresso(0);
    setResultados(null);
  }, [aberto]);

  // O CSV é lido a cada tecla: o erro de formato aparece enquanto ainda dá para consertar no
  // arquivo, e não depois de meia tabela já ter entrado no banco.
  const preparos = useMemo<Preparo[]>(() => {
    const { linhas, numeros } = lerCsv(texto);
    return linhas.map((linha, i) => {
      const r = formato.preparar(linha);
      // O número vem do leitor, e não do índice na lista: é a linha do arquivo, que é a que a
      // planilha aberta ao lado mostra.
      const numero = numeros[i];
      return "erro" in r ? { numero, item: null, erro: r.erro } : { numero, item: r, erro: null };
    });
  }, [texto, formato]);

  const prontos = preparos.filter((p): p is Preparo & { item: Preparada } => p.item !== null);

  const importar = useMutation({
    mutationFn: async () => {
      const feitos: Resultado[] = [];
      // Em série, e não em paralelo: são as mesmas rotas de cadastro de uma linha, e disparar
      // cinquenta `POST` de uma vez só troca uma espera de segundos por um erro difícil de atribuir.
      for (const p of prontos) {
        try {
          await apiPost(formato.rota, p.item.corpo);
          feitos.push({ numero: p.numero, rotulo: p.item.rotulo, erro: null });
        } catch (e) {
          feitos.push({ numero: p.numero, rotulo: p.item.rotulo, erro: mensagemDoErro(e) });
        }
        setProgresso(feitos.length);
      }
      return feitos;
    },
    onSuccess: (feitos) => {
      const entraram = feitos.filter((f) => !f.erro).length;
      setResultados(feitos);

      if (entraram > 0) {
        void queryClient.invalidateQueries({ queryKey: [formato.chave] });
        invalidarCusto(queryClient, formato.origem);
      }

      // A mesma frase e a mesma conta do título do resultado, que aparece junto.
      const total = preparos.length;
      const aviso = `${tituloDoResultado(entraram, total)}.`;
      if (entraram === total) toast.success(aviso);
      else if (entraram === 0) toast.error(aviso);
      else toast.warning(aviso);
    },
  });

  const escolherArquivo = async (arquivo: File | undefined) => {
    if (!arquivo) return;
    setTexto(await arquivo.text());
    setResultados(null);
  };

  // Fechar no meio não cancela o `for` que já está rodando — não fecha, então, enquanto ele roda.
  const trocarAbertura = (v: boolean) => {
    if (importar.isPending) return;
    onOpenChange(v);
  };

  return (
    <Dialog open={aberto} onOpenChange={trocarAbertura}>
      <DialogContent className="max-w-2xl" onCloseAutoFocus={devolverFocoA(origemDoFoco)}>
        <DialogHeader>
          <DialogTitle>{resultados ? "Resultado da importação" : formato.titulo}</DialogTitle>
          <DialogDescription>
            {resultados
              ? "Linha a linha, o que foi gravado e o que ficou de fora."
              : formato.descricao}
          </DialogDescription>
        </DialogHeader>

        {resultados ? (
          <Relatorio
            preparos={preparos}
            resultados={resultados}
            rotuloDoItem={formato.rotuloDoItem}
          />
        ) : (
          <div className="flex min-w-0 flex-col gap-4">
            <div className="space-y-1.5">
              <Label htmlFor={idDoTexto}>Tabela em CSV</Label>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pb-1">
                <input
                  ref={arquivoRef}
                  type="file"
                  accept=".csv,.txt,text/csv,text/plain"
                  className="hidden"
                  onChange={(e) => {
                    void escolherArquivo(e.target.files?.[0]);
                    // Zerado para o mesmo arquivo, corrigido e escolhido de novo, disparar `change`.
                    e.target.value = "";
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => arquivoRef.current?.click()}
                  disabled={importar.isPending}
                >
                  <FileUp />
                  Escolher arquivo .csv
                </Button>
                <span className="text-subtle text-[12.5px]">ou cole o conteúdo abaixo</span>
              </div>
              {/* Mono só aqui e no exemplo: é o conteúdo literal do arquivo, coluna por coluna. */}
              <Textarea
                id={idDoTexto}
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder={formato.exemplo}
                spellCheck={false}
                readOnly={importar.isPending}
                className="h-32 font-mono"
              />
            </div>

            <details className="group text-[12.5px]">
              <summary className="text-muted-foreground hover:text-foreground flex cursor-pointer list-none items-center gap-1.5 select-none [&::-webkit-details-marker]:hidden">
                <ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" />
                Colunas esperadas
              </summary>
              <div className="text-muted-foreground mt-2 space-y-1.5">
                <pre className="border-line bg-raised text-foreground overflow-x-auto rounded-[var(--wu-radius-sm)] border p-3 font-mono text-[11px] leading-relaxed">
                  {formato.exemplo}
                </pre>
                <p>{formato.opcionais}</p>
                <p>
                  A primeira linha é o cabeçalho e dá nome às colunas, em qualquer ordem. Separador
                  vírgula ou ponto e vírgula; data em 2026-01-31 ou 31/01/2026.
                </p>
              </div>
            </details>

            {preparos.length > 0 ? (
              <Previa
                preparos={preparos}
                importando={importar.isPending}
                progresso={progresso}
                rotuloDoItem={formato.rotuloDoItem}
              />
            ) : (
              // Só o cabeçalho (ou só linhas em branco): sem isto, "Importar" ficaria desabilitado
              // sem dizer por quê.
              texto.trim() && (
                <p className="text-subtle text-[12.5px]">
                  Nenhuma linha abaixo do cabeçalho. Cole as linhas de {formato.unidade[1]} depois
                  dele.
                </p>
              )
            )}
          </div>
        )}

        <DialogFooter>
          {resultados ? (
            <Button type="button" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={importar.isPending}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={prontos.length === 0 || importar.isPending}
                onClick={() => importar.mutate()}
              >
                {importar.isPending ? <Loader2 className="animate-spin" /> : <Upload />}
                {importar.isPending
                  ? `Importando ${progresso} de ${prontos.length}…`
                  : prontos.length === 0
                    ? "Importar"
                    : `Importar ${plural(prontos.length, ...formato.unidade)}`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** A primeira letra em maiúscula: os motivos de recusa nascem no meio de frase. */
function frase(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Uma linha da prévia ou do resultado, já com o estado decidido. */
interface LinhaDoLote {
  numero: number;
  titulo: string;
  /** O detalhe (as tarifas) ou o motivo da recusa — a linha meta. */
  meta: string | null;
  /** A vigência em ISO, quando a linha foi lida. */
  desde: string | null;
  tom: TomDeStatus;
  situacao: string;
}

/**
 * As linhas do lote, uma por linha do arquivo, na ordem do arquivo: o número à esquerda é o da
 * planilha aberta ao lado. Tabela com cabeçalho fixo e rolagem dentro dela a partir de 700px;
 * abaixo disso, cartões com as mesmas informações.
 */
function TabelaDoLote({ linhas, rotuloDoItem }: { linhas: LinhaDoLote[]; rotuloDoItem: string }) {
  return (
    <div className="border-line max-h-72 overflow-auto rounded-[var(--wu-radius)] border">
      <ul className="divide-line divide-y min-[700px]:hidden">
        {linhas.map((l) => (
          <li key={l.numero} className="flex flex-col gap-1 px-3 py-2.5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-subtle text-xs">
                Linha {l.numero}
                {l.desde && ` · desde ${formatDateOnly(l.desde)}`}
              </span>
              <StatusPill tom={l.tom}>{l.situacao}</StatusPill>
            </div>
            <div className="text-foreground text-[13.5px] font-medium [overflow-wrap:anywhere]">
              {l.titulo}
            </div>
            {l.meta && <div className="text-subtle text-xs [overflow-wrap:anywhere]">{l.meta}</div>}
          </li>
        ))}
      </ul>
      {/* `<table>` direto, sem o embrulho de `ui/table` (que tem rolagem própria): a rolagem é a
          deste quadro, e é contra ela que o cabeçalho fica preso. */}
      <table className="hidden w-full text-[13.5px] min-[700px]:table">
        <TableHeader>
          <TableRow>
            <TableHead className="w-16 pl-3 text-right">Linha</TableHead>
            <TableHead>{rotuloDoItem}</TableHead>
            <TableHead className="text-right">Desde</TableHead>
            <TableHead className="pr-3">Situação</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {linhas.map((l) => (
            <TableRow key={l.numero} className="hover:bg-transparent">
              <TableCell className="text-subtle pl-3 text-right">{l.numero}</TableCell>
              <TableCell className="w-full max-w-0">
                <div className="text-foreground truncate font-medium" title={l.titulo}>
                  {l.titulo}
                </div>
                {l.meta && (
                  <div className="text-subtle text-xs [overflow-wrap:anywhere]">{l.meta}</div>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground text-right whitespace-nowrap">
                {l.desde ? formatDateOnly(l.desde) : "—"}
              </TableCell>
              <TableCell className="pr-3">
                <StatusPill tom={l.tom}>{l.situacao}</StatusPill>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </table>
    </div>
  );
}

/** Contagens do lote em uma linha, cada número com o nome do estado que ele conta. */
function Resumo({ partes }: { partes: (string | null)[] }) {
  return <p className="text-muted-foreground text-[13px]">{partes.filter(Boolean).join(" · ")}</p>;
}

function plural(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`;
}

/** Uma nota curta com ícone, no tom de informação ou de alerta. */
function Nota({
  children,
  alerta,
  status,
}: {
  children: ReactNode;
  alerta?: boolean;
  /**
   * Região viva (`role="status"`, que já é `aria-live="polite"`): o leitor de tela anuncia quando o
   * texto muda. Precisa existir antes da mudança, então a nota é a mesma antes e durante o envio.
   */
  status?: boolean;
}) {
  return (
    <div
      role={status ? "status" : undefined}
      className={
        alerta
          ? "bg-danger-bg flex gap-2.5 rounded-[var(--wu-radius)] px-3 py-2"
          : "bg-raised flex gap-2.5 rounded-[var(--wu-radius)] px-3 py-2"
      }
    >
      {alerta ? (
        <TriangleAlert className="text-danger mt-0.5 h-4 w-4 shrink-0" />
      ) : (
        <Info className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
      )}
      <p className="text-foreground text-[12.5px]">{children}</p>
    </div>
  );
}

/**
 * O que vai ser mandado, antes de mandar.
 *
 * Uma vigência entra e não sai pela tela: se a data estiver errada, o conserto é no banco. Ver as
 * linhas já traduzidas — a data como o painel a lê, a tarifa como ela ficou — é a última chance
 * barata de notar que a planilha tinha entrada e saída trocadas. As com defeito ficam na mesma
 * lista, no lugar delas no arquivo, com o motivo.
 *
 * Status: "Pronta" é `neutral` (nada aconteceu ainda); "Com erro" é `danger`, porque é defeito que
 * só se resolve no arquivo.
 */
function Previa({
  preparos,
  importando,
  progresso,
  rotuloDoItem,
}: {
  preparos: Preparo[];
  importando: boolean;
  progresso: number;
  rotuloDoItem: string;
}) {
  const prontas = preparos.filter((p) => p.item).length;
  const comErro = preparos.length - prontas;

  const linhas: LinhaDoLote[] = preparos.map((p) =>
    p.item
      ? {
          numero: p.numero,
          titulo: p.item.rotulo,
          meta: p.item.detalhe,
          desde: p.item.desde,
          tom: "neutral",
          situacao: "Pronta",
        }
      : {
          numero: p.numero,
          titulo: frase(p.erro ?? ""),
          meta: "Corrija no arquivo e cole de novo; esta linha não será enviada.",
          desde: null,
          tom: "danger",
          situacao: "Com erro",
        },
  );

  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-foreground text-sm font-semibold">Prévia</h3>
        <Resumo
          partes={[
            plural(preparos.length, "linha lida", "linhas lidas"),
            plural(prontas, "pronta", "prontas"),
            comErro > 0 ? plural(comErro, "com erro", "com erro") : null,
          ]}
        />
      </div>
      <TabelaDoLote linhas={linhas} rotuloDoItem={rotuloDoItem} />
      <Nota status>
        {importando
          ? `Gravando ${progresso} de ${prontas}. As linhas vão uma de cada vez; não feche esta janela.`
          : "As linhas vão uma de cada vez e nada é desfeito: se uma falhar, as que já entraram continuam gravadas. Depois do envio, o resultado mostra linha a linha o que entrou."}
      </Nota>
    </section>
  );
}

/**
 * O que entrou e o que não entrou, depois de mandado.
 *
 * As linhas vão uma a uma e nada é desfeito, então a importação pode parar no meio — com metade da
 * tabela gravada. Um toast de "deu erro" esconderia justamente o que importa saber: quais. A lista
 * é a mesma da prévia, na ordem do arquivo, com o estado final de cada linha:
 * "Gravada" (`done`), "Falhou" (`danger`, com o motivo do servidor) e "Ignorada" (`neutral`: tinha
 * defeito na prévia e não foi enviada — nada aconteceu com ela, como a "Pronta" da prévia).
 */
function Relatorio({
  preparos,
  resultados,
  rotuloDoItem,
}: {
  preparos: Preparo[];
  resultados: Resultado[];
  rotuloDoItem: string;
}) {
  // O botão que estava focado ("Importando…") some quando o resultado entra; sem isto o foco cai no
  // diálogo inteiro e o leitor de tela lê só o título genérico. No título, ele lê o desfecho.
  const tituloRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    tituloRef.current?.focus();
  }, []);

  const porNumero = new Map(resultados.map((r) => [r.numero, r]));
  const gravadas = resultados.filter((r) => !r.erro).length;
  const falharam = resultados.length - gravadas;
  const ignoradas = preparos.filter((p) => !p.item).length;
  const total = preparos.length;

  const linhas: LinhaDoLote[] = preparos.map((p) => {
    const r = porNumero.get(p.numero);
    if (p.item && r && !r.erro) {
      return {
        numero: p.numero,
        titulo: r.rotulo,
        meta: p.item.detalhe,
        desde: p.item.desde,
        tom: "done",
        situacao: "Gravada",
      };
    }
    if (p.item && r) {
      return {
        numero: p.numero,
        titulo: r.rotulo,
        meta: r.erro,
        desde: p.item.desde,
        tom: "danger",
        situacao: "Falhou",
      };
    }
    return {
      numero: p.numero,
      titulo: frase(p.erro ?? ""),
      meta: "Tinha erro na prévia e não foi enviada.",
      desde: null,
      tom: "neutral",
      situacao: "Ignorada",
    };
  });

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div>
        <h3
          ref={tituloRef}
          tabIndex={-1}
          className="text-foreground text-sm font-semibold outline-none"
        >
          {tituloDoResultado(gravadas, total)}
        </h3>
        <Resumo
          partes={[
            plural(gravadas, "gravada", "gravadas"),
            falharam > 0 ? plural(falharam, "falhou", "falharam") : null,
            ignoradas > 0 ? plural(ignoradas, "ignorada", "ignoradas") : null,
          ]}
        />
      </div>
      {gravadas < total && (
        <Nota alerta={gravadas > 0}>
          {gravadas > 0
            ? "As gravadas já valem e não são desfeitas. Corrija no arquivo só as que falharam ou foram ignoradas e importe essas de novo — reenviar as gravadas daria conflito de vigência."
            : "Nada mudou na tabela de preços. Corrija as linhas no arquivo e importe de novo."}
        </Nota>
      )}
      <TabelaDoLote linhas={linhas} rotuloDoItem={rotuloDoItem} />
    </div>
  );
}
