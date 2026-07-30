import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, FileUp, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { formatDateOnly } from "@/lib/format";
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
  /** O resumo das tarifas, para conferir antes de mandar. */
  detalhe: string;
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

  return {
    rotulo: modelo,
    detalhe: `desde ${formatDateOnly(vigencia)} · entrada ${entrada} · saída ${saida} · cache ${cacheLeitura}/${cacheEscrita}`,
    corpo: {
      modelo,
      provedor: coluna(linha, "provedor", "provider") || null,
      vigencia_inicio: vigencia,
      entrada_por_milhao: entrada,
      saida_por_milhao: saida,
      cache_leitura_por_milhao: cacheLeitura,
      cache_escrita_por_milhao: cacheEscrita,
      moeda: coluna(linha, "moeda", "currency") || "USD",
    },
  };
}

function prepararMensagem(linha: LinhaCsv): Preparada | { erro: string } {
  const categoria = coluna(linha, "categoria", "category").toLowerCase();
  if (!categoria) return { erro: "falta a categoria" };
  if (categoria === "service") {
    return { erro: "service não tem tarifa: a Meta não cobra mensagem de serviço" };
  }
  if (!CATEGORIAS_COBRAVEIS.some((c) => c.chave === categoria)) {
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

  return {
    rotulo: `${categoria} · ${pais}`,
    detalhe: `desde ${formatDateOnly(vigencia)} · ${porMensagem} por mensagem`,
    corpo: {
      categoria,
      pais,
      vigencia_inicio: vigencia,
      por_mensagem: porMensagem,
      moeda: coluna(linha, "moeda", "currency") || "USD",
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
      "provedor, cache_leitura_por_milhao, cache_escrita_por_milhao e moeda são opcionais — cache em branco vira zero, e a moeda em branco vira USD.",
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
      "moeda é opcional e em branco vira USD. `service` não entra: a Meta não cobra mensagem de serviço.",
    preparar: prepararMensagem,
  },
} satisfies Record<string, Formato>;

export type TipoDeImportacao = keyof typeof FORMATOS;

/** O que aconteceu com uma linha depois de mandada. */
interface Resultado {
  rotulo: string;
  erro: string | null;
}

export function DialogoImportarPrecos({
  tipo,
  aberto,
  onOpenChange,
}: {
  tipo: TipoDeImportacao;
  aberto: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const formato: Formato = FORMATOS[tipo];
  const queryClient = useQueryClient();
  const arquivoRef = useRef<HTMLInputElement>(null);

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
      return "erro" in r
        ? { numero, item: null, erro: r.erro }
        : { numero, item: r, erro: null };
    });
  }, [texto, formato]);

  const prontos = preparos.filter((p): p is Preparo & { item: Preparada } => p.item !== null);
  const recusados = preparos.filter((p) => p.erro !== null);

  const importar = useMutation({
    mutationFn: async () => {
      const feitos: Resultado[] = [];
      // Em série, e não em paralelo: são as mesmas rotas de cadastro de uma linha, e disparar
      // cinquenta `POST` de uma vez só troca uma espera de segundos por um erro difícil de atribuir.
      for (const p of prontos) {
        try {
          await apiPost(formato.rota, p.item.corpo);
          feitos.push({ rotulo: p.item.rotulo, erro: null });
        } catch (e) {
          feitos.push({ rotulo: p.item.rotulo, erro: mensagemDoErro(e) });
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

      if (entraram === feitos.length) {
        toast.success(`${entraram} ${entraram === 1 ? "preço importado" : "preços importados"}.`);
      } else if (entraram === 0) {
        toast.error("Nenhuma linha entrou.");
      } else {
        toast.warning(`${entraram} de ${feitos.length} linhas entraram.`);
      }
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{formato.titulo}</DialogTitle>
          <DialogDescription>{formato.descricao}</DialogDescription>
        </DialogHeader>

        {resultados ? (
          <Relatorio resultados={resultados} />
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
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
                className="gap-1.5"
                onClick={() => arquivoRef.current?.click()}
              >
                <FileUp className="h-4 w-4" />
                Escolher arquivo .csv
              </Button>
              <span className="text-muted-foreground text-xs">ou cole a tabela abaixo</span>
            </div>

            <Textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder={formato.exemplo}
              spellCheck={false}
              className="h-40 font-mono text-xs"
              aria-label="Tabela em CSV"
            />

            <details className="text-muted-foreground text-xs">
              <summary className="cursor-pointer select-none">Colunas esperadas</summary>
              <pre className="bg-muted mt-2 overflow-x-auto rounded-sm p-3 text-[0.6875rem] leading-relaxed">
                {formato.exemplo}
              </pre>
              <p className="mt-2">{formato.opcionais}</p>
              <p className="mt-1">
                A primeira linha é o cabeçalho e dá nome às colunas — a ordem delas não importa.
                Separador `,` ou `;`, e data em `2026-01-31` ou `31/01/2026`.
              </p>
            </details>

            {texto.trim() && <Previa prontos={prontos} recusados={recusados} />}
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
                {importar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {importar.isPending
                  ? `Importando ${progresso} de ${prontos.length}…`
                  : `Importar ${prontos.length} ${prontos.length === 1 ? "preço" : "preços"}`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * O que vai ser mandado, antes de mandar.
 *
 * Uma vigência entra e não sai pela tela: se a data estiver errada, o conserto é no banco. Ver as
 * linhas já traduzidas — a data como o painel a lê, a tarifa como ela ficou — é a última chance
 * barata de notar que a planilha tinha entrada e saída trocadas.
 */
function Previa({
  prontos,
  recusados,
}: {
  prontos: (Preparo & { item: Preparada })[];
  recusados: Preparo[];
}) {
  return (
    <div className="space-y-3">
      {recusados.length > 0 && (
        <section className="border-destructive/40 rounded-sm border border-dashed p-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="text-destructive h-4 w-4 shrink-0" />
            <h3 className="etiqueta">
              {recusados.length === 1
                ? "1 linha não será importada"
                : `${recusados.length} linhas não serão importadas`}
            </h3>
          </div>
          <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto text-xs">
            {recusados.map((p) => (
              <li key={p.numero} className="text-muted-foreground">
                <span className="font-mono">linha {p.numero}</span> — {p.erro}
              </li>
            ))}
          </ul>
        </section>
      )}

      {prontos.length > 0 && (
        <section className="rounded-sm border p-3">
          <h3 className="etiqueta">
            {prontos.length === 1 ? "1 preço pronto" : `${prontos.length} preços prontos`}
          </h3>
          <ul className="mt-2 max-h-48 space-y-1.5 overflow-y-auto">
            {prontos.map((p) => (
              <li key={p.numero} className="flex flex-wrap items-baseline gap-x-2 text-xs">
                <span className="font-mono font-medium">{p.item.rotulo}</span>
                <span className="text-muted-foreground font-mono">{p.item.detalhe}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/**
 * O que entrou e o que não entrou, depois de mandado.
 *
 * As linhas vão uma a uma e nada é desfeito, então a importação pode parar no meio — com metade da
 * tabela gravada. Um toast de "deu erro" esconderia justamente o que importa saber: quais.
 */
function Relatorio({ resultados }: { resultados: Resultado[] }) {
  const entraram = resultados.filter((r) => !r.erro);
  const falharam = resultados.filter((r) => r.erro);

  return (
    <div className="space-y-3">
      <p className="text-sm">
        {entraram.length} de {resultados.length}{" "}
        {resultados.length === 1 ? "linha entrou" : "linhas entraram"}.
        {falharam.length > 0 && " As que falharam não foram gravadas — corrija e importe de novo."}
      </p>

      {falharam.length > 0 && (
        <ul className="max-h-56 space-y-1.5 overflow-y-auto rounded-sm border p-3">
          {falharam.map((r, i) => (
            <li key={`${r.rotulo}-${i}`} className="flex items-baseline gap-2 text-xs">
              <X className="text-destructive h-3.5 w-3.5 shrink-0 translate-y-0.5" />
              <span className="font-mono font-medium">{r.rotulo}</span>
              <span className="text-muted-foreground">{r.erro}</span>
            </li>
          ))}
        </ul>
      )}

      {entraram.length > 0 && (
        <ul className="max-h-40 space-y-1.5 overflow-y-auto rounded-sm border p-3">
          {entraram.map((r, i) => (
            <li key={`${r.rotulo}-${i}`} className="flex items-baseline gap-2 text-xs">
              <Check className="text-custo h-3.5 w-3.5 shrink-0 translate-y-0.5" />
              <span className="font-mono">{r.rotulo}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
