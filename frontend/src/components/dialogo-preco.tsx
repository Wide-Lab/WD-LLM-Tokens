import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { AlertTriangle, CalendarClock, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError, apiPost } from "@/lib/api";
import { formatDateOnly, toISODate } from "@/lib/format";
import { CATEGORIAS } from "@/lib/grafico";

/**
 * O que o formulário já sabe quando é aberto a partir de uma faixa da tela.
 *
 * Só `modelo` é obrigatório: o mesmo formulário abre para reajustar um preço que existe (e aí vem
 * tudo preenchido) e para estrear o preço de um modelo que já tem evento mas nenhuma tarifa — nesse
 * caso os valores nascem vazios, porque preencher com zero afirmaria que o modelo é de graça.
 */
export interface BasePrecoModelo {
  modelo: string;
  provedor?: string | null;
  entrada_por_milhao?: number;
  saida_por_milhao?: number;
  cache_leitura_por_milhao?: number;
  cache_escrita_por_milhao?: number;
}

export interface BasePrecoMensagem {
  categoria: string;
  pais: string;
  por_mensagem: number;
}

function hojeISO(): string {
  return toISODate(new Date());
}

/**
 * O campo de vigência, com o que ele significa dito na hora de escolher.
 *
 * É o único campo desta tela em que dá para se machucar: o custo não é gravado no evento, é
 * derivado na leitura pelo preço vigente na data dele. Data no passado, portanto, **reescreve o
 * histórico** — e não há `DELETE` de preço para desfazer. O aviso aparece quando a escolha é essa,
 * e não como texto fixo de rodapé que ninguém lê na vez em que importa.
 */
function CampoVigencia({
  valor,
  onChange,
  descricaoDoImpacto,
}: {
  valor: string;
  onChange: (v: string) => void;
  /** O que passa a ser recalculado — quem sabe disso é cada formulário. */
  descricaoDoImpacto: string;
}) {
  const hoje = hojeISO();

  return (
    <div className="space-y-2">
      <Label htmlFor="preco-vigencia" className="etiqueta">
        Vigente a partir de
      </Label>
      <Input
        id="preco-vigencia"
        type="date"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        required
      />

      {valor && valor < hoje && (
        <div className="border-destructive/50 flex gap-2.5 rounded-sm border-l-2 py-1.5 pl-3">
          <AlertTriangle className="text-destructive mt-0.5 h-4 w-4 shrink-0" />
          <p className="text-muted-foreground text-xs">
            Data no passado: {descricaoDoImpacto} de {formatDateOnly(valor)} em diante passam a ser
            calculados por este preço, e os totais já vistos mudam. Preço não se apaga pela tela —
            corrigir exige acesso ao banco.
          </p>
        </div>
      )}

      {valor && valor > hoje && (
        <div className="border-border flex gap-2.5 rounded-sm border-l-2 py-1.5 pl-3">
          <CalendarClock className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
          <p className="text-muted-foreground text-xs">
            Preço agendado: nada muda até {formatDateOnly(valor)}. Até lá vale o preço atual.
          </p>
        </div>
      )}
    </div>
  );
}

/** Um campo de dinheiro: número em texto, para o `Decimal` do backend chegar exato. */
function CampoValor({
  id,
  rotulo,
  valor,
  onChange,
  sufixo,
}: {
  id: string;
  rotulo: string;
  valor: string;
  onChange: (v: string) => void;
  sufixo: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="etiqueta">
        {rotulo}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          // O passo miúdo é o do cache lido: US$ 0,000001 por token vezes um milhão ainda cabe em
          // centavos de dólar, e um `step` grosso recusaria a tarifa real no navegador.
          step="0.000001"
          min="0"
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          className="pr-14 font-mono"
          required
        />
        <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 font-mono text-xs">
          {sufixo}
        </span>
      </div>
    </div>
  );
}

/**
 * A moldura comum dos dois formulários: título, erro do backend e os dois botões.
 *
 * O erro sai aqui dentro e não num toast porque é sobre o que está escrito no formulário — o `409`
 * de vigência repetida se resolve mudando a data que está logo acima dele.
 */
function MolduraDoFormulario({
  aberto,
  onOpenChange,
  titulo,
  descricao,
  erro,
  enviando,
  onSubmit,
  children,
}: {
  aberto: boolean;
  onOpenChange: (v: boolean) => void;
  titulo: string;
  descricao: string;
  erro: string | null;
  enviando: boolean;
  onSubmit: (e: FormEvent) => void;
  children: ReactNode;
}) {
  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>{descricao}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          {children}
          {erro && (
            <Alert variant="destructive">
              <AlertDescription>{erro}</AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={enviando}>
              {enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar preço
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function mensagemDoErro(e: unknown): string {
  return e instanceof ApiError || e instanceof Error ? e.message : "Não foi possível salvar.";
}

/**
 * As consultas que mostram custo, por origem — o que fica velho quando um preço entra.
 *
 * A lista é explícita porque o custo não é gravado em lugar nenhum: ele é recalculado a cada
 * `GET`, então um preço novo muda a resposta de toda tela de dinheiro, e não só a de preços. E
 * precisa ser exata: `invalidateQueries` casa elemento a elemento, então uma chave pela metade
 * (`metricas`, para `["metricas-llm", params]`) não invalida nada e falha em silêncio — a tela
 * seguiria mostrando o total do preço anterior.
 */
const LEITURAS_DE_CUSTO = {
  llm: ["metricas-llm", "eventos-llm", "conversa", "consolidado"],
  whatsapp: ["metricas-whatsapp", "mensagens-whatsapp", "consolidado"],
} as const;

function invalidarCusto(
  queryClient: ReturnType<typeof useQueryClient>,
  origem: "llm" | "whatsapp",
) {
  for (const chave of LEITURAS_DE_CUSTO[origem]) {
    void queryClient.invalidateQueries({ queryKey: [chave] });
  }
}

/**
 * Cadastro de preço de modelo.
 *
 * `base` chega quando o formulário abre a partir de um modelo que já tem preço: os valores vêm
 * preenchidos com o que vale hoje e a data volta para hoje, de modo que a pergunta na tela seja
 * "o que muda, e a partir de quando" — que é o reajuste, o caso de longe mais comum.
 */
export function DialogoPrecoModelo({
  aberto,
  onOpenChange,
  base,
  modelosConhecidos = [],
}: {
  aberto: boolean;
  onOpenChange: (v: boolean) => void;
  base?: BasePrecoModelo | null;
  /** Os modelos já vistos em eventos, para não errar o nome — ele casa por igualdade exata. */
  modelosConhecidos?: string[];
}) {
  const queryClient = useQueryClient();
  const [modelo, setModelo] = useState("");
  const [provedor, setProvedor] = useState("");
  const [vigencia, setVigencia] = useState(hojeISO());
  const [entrada, setEntrada] = useState("");
  const [saida, setSaida] = useState("");
  const [cacheLeitura, setCacheLeitura] = useState("0");
  const [cacheEscrita, setCacheEscrita] = useState("0");
  const [erro, setErro] = useState<string | null>(null);

  // Reinicia a cada abertura: o diálogo é montado uma vez por tela e reaproveitado por todas as
  // faixas, então sem isso a segunda abertura viria com os números da primeira.
  useEffect(() => {
    if (!aberto) return;
    setErro(null);
    setVigencia(hojeISO());
    setModelo(base?.modelo ?? "");
    setProvedor(base?.provedor ?? "");
    setEntrada(base?.entrada_por_milhao?.toString() ?? "");
    setSaida(base?.saida_por_milhao?.toString() ?? "");
    setCacheLeitura(base?.cache_leitura_por_milhao?.toString() ?? "0");
    setCacheEscrita(base?.cache_escrita_por_milhao?.toString() ?? "0");
  }, [aberto, base]);

  const salvar = useMutation({
    mutationFn: () =>
      apiPost("/v1/precos", {
        modelo: modelo.trim(),
        provedor: provedor.trim() || null,
        vigencia_inicio: vigencia,
        entrada_por_milhao: entrada,
        saida_por_milhao: saida,
        cache_leitura_por_milhao: cacheLeitura || "0",
        cache_escrita_por_milhao: cacheEscrita || "0",
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["precos-modelo"] });
      invalidarCusto(queryClient, "llm");
      toast.success(`Preço de ${modelo.trim()} vale a partir de ${formatDateOnly(vigencia)}.`);
      onOpenChange(false);
    },
    onError: (e) => setErro(mensagemDoErro(e)),
  });

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    setErro(null);
    salvar.mutate();
  };

  return (
    <MolduraDoFormulario
      aberto={aberto}
      onOpenChange={onOpenChange}
      titulo={base ? `Novo preço para ${base.modelo}` : "Novo preço de modelo"}
      descricao="Preço não se edita: cada cadastro é uma vigência nova, e a anterior continua valendo para o período dela."
      erro={erro}
      enviando={salvar.isPending}
      onSubmit={enviar}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="preco-modelo" className="etiqueta">
            Modelo
          </Label>
          <Input
            id="preco-modelo"
            value={modelo}
            onChange={(e) => setModelo(e.target.value)}
            list="modelos-conhecidos"
            placeholder="gpt-5.6-terra"
            className="font-mono"
            readOnly={!!base}
            required
          />
          <datalist id="modelos-conhecidos">
            {modelosConhecidos.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </div>

        <div className="space-y-2">
          <Label htmlFor="preco-provedor" className="etiqueta">
            Provedor <span className="normal-case">(opcional)</span>
          </Label>
          <Input
            id="preco-provedor"
            value={provedor}
            onChange={(e) => setProvedor(e.target.value)}
            placeholder="openai"
            className="font-mono"
          />
        </div>
      </div>

      <CampoVigencia
        valor={vigencia}
        onChange={setVigencia}
        descricaoDoImpacto="os eventos deste modelo"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <CampoValor
          id="preco-entrada"
          rotulo="Entrada"
          valor={entrada}
          onChange={setEntrada}
          sufixo="USD/1M"
        />
        <CampoValor
          id="preco-saida"
          rotulo="Saída"
          valor={saida}
          onChange={setSaida}
          sufixo="USD/1M"
        />
        <CampoValor
          id="preco-cache-leitura"
          rotulo="Cache leitura"
          valor={cacheLeitura}
          onChange={setCacheLeitura}
          sufixo="USD/1M"
        />
        <CampoValor
          id="preco-cache-escrita"
          rotulo="Cache escrita"
          valor={cacheEscrita}
          onChange={setCacheEscrita}
          sufixo="USD/1M"
        />
      </div>

      <p className="text-muted-foreground text-xs">
        Os quatro baldes são cobrados separados e não se sobrepõem. Modelo sem cache fica com zero
        nos dois últimos — o painel não cobra o que não foi reportado.
      </p>
    </MolduraDoFormulario>
  );
}

/** As três que se pode cobrar. `service` fica de fora: a Meta não cobra, e o backend recusa. */
const CATEGORIAS_COBRAVEIS = CATEGORIAS.filter((c) => c.chave !== "service");

/** Cadastro de tarifa de mensagem. Mesma vigência, outra chave: aqui é o par categoria/país. */
export function DialogoPrecoMensagem({
  aberto,
  onOpenChange,
  base,
}: {
  aberto: boolean;
  onOpenChange: (v: boolean) => void;
  base?: BasePrecoMensagem | null;
}) {
  const queryClient = useQueryClient();
  const [categoria, setCategoria] = useState("utility");
  const [pais, setPais] = useState("");
  const [vigencia, setVigencia] = useState(hojeISO());
  const [porMensagem, setPorMensagem] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!aberto) return;
    setErro(null);
    setVigencia(hojeISO());
    setCategoria(base?.categoria ?? "utility");
    setPais(base?.pais ?? "");
    setPorMensagem(base ? String(base.por_mensagem) : "");
  }, [aberto, base]);

  const salvar = useMutation({
    mutationFn: () =>
      apiPost("/v1/precos/mensagem", {
        categoria,
        pais,
        vigencia_inicio: vigencia,
        por_mensagem: porMensagem,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["precos-mensagem"] });
      invalidarCusto(queryClient, "whatsapp");
      toast.success(
        `Tarifa de ${categoria} em ${pais} vale a partir de ${formatDateOnly(vigencia)}.`,
      );
      onOpenChange(false);
    },
    onError: (e) => setErro(mensagemDoErro(e)),
  });

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    setErro(null);
    salvar.mutate();
  };

  return (
    <MolduraDoFormulario
      aberto={aberto}
      onOpenChange={onOpenChange}
      titulo={
        base ? `Nova tarifa para ${base.categoria} · ${base.pais}` : "Nova tarifa de mensagem"
      }
      descricao="A tarifa é por mensagem cobrável, e a Meta cobra por categoria e país do destinatário."
      erro={erro}
      enviando={salvar.isPending}
      onSubmit={enviar}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="preco-categoria" className="etiqueta">
            Categoria
          </Label>
          <Select value={categoria} onValueChange={setCategoria} disabled={!!base}>
            <SelectTrigger id="preco-categoria" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIAS_COBRAVEIS.map((c) => (
                <SelectItem key={c.chave} value={c.chave}>
                  {c.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="preco-pais" className="etiqueta">
            País do destinatário
          </Label>
          <Input
            id="preco-pais"
            value={pais}
            // Maiúsculas já na digitação: o preço casa com a mensagem por igualdade de texto, e
            // `br` cadastrado com `BR` recebido não dá erro — dá custo em branco para sempre.
            onChange={(e) => setPais(e.target.value.toUpperCase().slice(0, 2))}
            placeholder="BR"
            className="font-mono uppercase"
            maxLength={2}
            readOnly={!!base}
            required
          />
        </div>
      </div>

      <CampoVigencia
        valor={vigencia}
        onChange={setVigencia}
        descricaoDoImpacto="as mensagens desta categoria e país"
      />

      <CampoValor
        id="preco-por-mensagem"
        rotulo="Por mensagem"
        valor={porMensagem}
        onChange={setPorMensagem}
        sufixo="USD"
      />

      <p className="text-muted-foreground text-xs">
        Mensagem de serviço não entra aqui: quem decide se a mensagem é cobrável é a Meta, no
        próprio evento.
      </p>
    </MolduraDoFormulario>
  );
}
