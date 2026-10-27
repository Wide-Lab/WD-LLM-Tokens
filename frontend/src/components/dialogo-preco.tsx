import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { CalendarClock, Check, Loader2, TriangleAlert } from "lucide-react";
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
import { apiPost } from "@/lib/api";
import { formatDateOnly, toISODate } from "@/lib/format";
import { CATEGORIAS_COBRAVEIS, invalidarCusto, mensagemDoErro } from "@/lib/precos";

/**
 * O que o formulário já sabe quando é aberto a partir de uma linha da tela.
 *
 * Só `modelo` é obrigatório: o mesmo formulário abre para reajustar um preço que existe (e aí vem
 * tudo preenchido) e para estrear o preço de um modelo que já tem evento mas nenhuma tarifa — nesse
 * caso os valores nascem vazios, porque preencher com zero afirmaria que o modelo é de graça.
 */
export interface BasePrecoModelo {
  modelo: string;
  provedor?: string | null;
  moeda?: string;
  entrada_por_milhao?: number;
  saida_por_milhao?: number;
  cache_leitura_por_milhao?: number;
  cache_escrita_por_milhao?: number;
}

export interface BasePrecoMensagem {
  categoria: string;
  pais: string;
  moeda?: string;
  por_mensagem: number;
}

/**
 * A moeda da série, carregada e devolvida sem o formulário perguntar nada.
 *
 * O painel só cadastra em uma moeda por vez e não há campo para trocá-la — mas a importação de CSV
 * aceita a coluna, então existe série que não é USD. Se o reajuste não devolvesse a moeda que veio,
 * o backend aplicaria o default e a série trocaria de moeda no meio, sem ninguém pedir: é o único
 * jeito de o total do painel sair errado parecendo certo (ver `preco_modelo.moeda`, no backend).
 */
const MOEDA_PADRAO = "USD";

function hojeISO(): string {
  return toISODate(new Date());
}

function nomeDaCategoria(chave: string): string {
  return CATEGORIAS_COBRAVEIS.find((c) => c.chave === chave)?.nome ?? chave;
}

/** O asterisco `danger` do wide-ui nos obrigatórios. Quem o leitor de tela lê é o `required`. */
function Obrigatorio() {
  return (
    <span aria-hidden className="text-danger ml-0.5">
      *
    </span>
  );
}

/** O erro embaixo do campo, dizendo como corrigir. */
function ErroDoCampo({ id, erro }: { id: string; erro?: string }) {
  if (!erro) return null;
  return (
    <p id={`${id}-erro`} className="text-danger text-[12.5px]">
      {erro}
    </p>
  );
}

/** O que liga o campo ao erro dele: borda `danger` e a frase lida junto com o rótulo. */
function ariaDoErro(id: string, erro?: string) {
  return erro ? { "aria-invalid": true, "aria-describedby": `${id}-erro` } : {};
}

/** Erros por `name` do campo. */
type ErrosDosCampos = Record<string, string>;

/**
 * As regras do formulário são as do próprio navegador — `required`, `min="0"`, o `step` de seis
 * casas —, as mesmas de antes. O que muda é quem fala: o balão nativo some (o `<form>` é
 * `noValidate`) e a recusa vira uma frase embaixo do campo, em português e dizendo o conserto.
 * `faltando` é a frase de campo vazio, a única que depende de qual campo é.
 */
function validar(form: HTMLFormElement, faltando: Record<string, string>): ErrosDosCampos {
  const erros: ErrosDosCampos = {};
  for (const el of Array.from(form.elements)) {
    if (!(el instanceof HTMLInputElement) || !el.name || el.validity.valid) continue;
    const v = el.validity;
    if (v.valueMissing) erros[el.name] = faltando[el.name] ?? "Preencha este campo.";
    else if (v.badInput && el.type === "date") erros[el.name] = "Complete a data: dia, mês e ano.";
    else if (v.badInput)
      erros[el.name] = "Digite só o número, com ponto antes das casas decimais (ex.: 1.25).";
    else if (v.rangeUnderflow) erros[el.name] = "O valor não pode ser negativo: use zero ou mais.";
    else if (v.stepMismatch) erros[el.name] = "Use no máximo seis casas decimais.";
    else erros[el.name] = "Confira este campo.";
  }
  return erros;
}

/**
 * Valida o formulário no envio. Com erro, leva o foco ao primeiro campo recusado — onde a pessoa
 * vai corrigir — e devolve `false`.
 */
function useValidacao(faltando: Record<string, string>) {
  const [erros, setErros] = useState<ErrosDosCampos>({});

  const conferir = (form: HTMLFormElement): boolean => {
    const encontrados = validar(form, faltando);
    setErros(encontrados);
    if (Object.keys(encontrados).length === 0) return true;
    form.querySelector<HTMLInputElement>("input:invalid")?.focus();
    return false;
  };

  /** O erro de um campo some assim que a pessoa mexe nele. */
  const limpar = (nome: string) =>
    setErros((atual) => {
      if (!(nome in atual)) return atual;
      const proximo = { ...atual };
      delete proximo[nome];
      return proximo;
    });

  const zerar = useCallback(() => setErros({}), []);

  return { erros, conferir, limpar, zerar };
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
  erro,
  descricaoDoImpacto,
}: {
  valor: string;
  onChange: (v: string) => void;
  erro?: string;
  /** O que passa a ser recalculado — quem sabe disso é cada formulário. */
  descricaoDoImpacto: string;
}) {
  const hoje = hojeISO();

  return (
    <div className="space-y-1.5">
      <Label htmlFor="preco-vigencia">
        Vigente a partir de
        <Obrigatorio />
      </Label>
      <Input
        id="preco-vigencia"
        name="vigencia"
        type="date"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        required
        {...ariaDoErro("preco-vigencia", erro)}
      />
      <ErroDoCampo id="preco-vigencia" erro={erro} />

      {valor && valor < hoje && (
        <div className="bg-danger-bg flex gap-2.5 rounded-[var(--wu-radius)] px-3 py-2">
          <TriangleAlert className="text-danger mt-0.5 h-4 w-4 shrink-0" />
          <p className="text-foreground text-[12.5px]">
            Data no passado: {descricaoDoImpacto} de {formatDateOnly(valor)} em diante passam a ser
            calculados por este preço, e os totais já vistos mudam. Preço não se apaga pela tela —
            corrigir exige acesso ao banco.
          </p>
        </div>
      )}

      {valor && valor > hoje && (
        <div className="bg-raised flex gap-2.5 rounded-[var(--wu-radius)] px-3 py-2">
          <CalendarClock className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
          <p className="text-muted-foreground text-[12.5px]">
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
  nome,
  rotulo,
  valor,
  onChange,
  sufixo,
  erro,
}: {
  id: string;
  nome: string;
  rotulo: string;
  valor: string;
  onChange: (v: string) => void;
  sufixo: string;
  erro?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {rotulo}
        <Obrigatorio />
      </Label>
      <div className="relative">
        <Input
          id={id}
          name={nome}
          type="number"
          inputMode="decimal"
          // O passo miúdo é o do cache lido: US$ 0,000001 por token vezes um milhão ainda cabe em
          // centavos de dólar, e um `step` grosso recusaria a tarifa real no navegador.
          step="0.000001"
          min="0"
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0.00"
          className="pr-16"
          required
          {...ariaDoErro(id, erro)}
        />
        <span className="text-subtle pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs">
          {sufixo}
        </span>
      </div>
      <ErroDoCampo id={id} erro={erro} />
    </div>
  );
}

/**
 * A moldura comum dos dois formulários: título, erro do backend e os dois botões.
 *
 * O erro do backend sai aqui dentro e não num toast porque é sobre o que está escrito no formulário
 * — o `409` de vigência repetida se resolve mudando a data que está logo acima dele. O de cada campo
 * sai embaixo do próprio campo.
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
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  children: ReactNode;
}) {
  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>{descricao}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="space-y-4">
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
              {enviando ? <Loader2 className="animate-spin" /> : <Check />}
              Salvar preço
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const FALTANDO_MODELO = {
  modelo: "Informe o modelo exatamente como ele chega nos eventos, como gpt-4o.",
  vigencia: "Escolha a data a partir da qual este preço vale.",
  entrada: "Informe a tarifa de entrada por milhão de tokens.",
  saida: "Informe a tarifa de saída por milhão de tokens.",
  cache_leitura: "Informe a tarifa de cache lido; use 0 se o modelo não tem cache.",
  cache_escrita: "Informe a tarifa de cache escrito; use 0 se o modelo não tem cache.",
};

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
  const { erros, conferir, limpar, zerar } = useValidacao(FALTANDO_MODELO);

  const moeda = base?.moeda ?? MOEDA_PADRAO;

  // Reinicia a cada abertura: o diálogo é montado uma vez por tela e reaproveitado por todas as
  // linhas, então sem isso a segunda abertura viria com os números da primeira.
  useEffect(() => {
    if (!aberto) return;
    setErro(null);
    zerar();
    setVigencia(hojeISO());
    setModelo(base?.modelo ?? "");
    setProvedor(base?.provedor ?? "");
    setEntrada(base?.entrada_por_milhao?.toString() ?? "");
    setSaida(base?.saida_por_milhao?.toString() ?? "");
    setCacheLeitura(base?.cache_leitura_por_milhao?.toString() ?? "0");
    setCacheEscrita(base?.cache_escrita_por_milhao?.toString() ?? "0");
  }, [aberto, base, zerar]);

  const salvar = useMutation({
    mutationFn: () =>
      apiPost("/v1/precos", {
        modelo: modelo.trim(),
        provedor: provedor.trim() || null,
        moeda,
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

  const enviar = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErro(null);
    if (!conferir(e.currentTarget)) return;
    salvar.mutate();
  };

  /** O setter do campo, que também apaga o erro dele. */
  const campo = (nome: string, set: (v: string) => void) => (v: string) => {
    set(v);
    limpar(nome);
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
      <div className="grid grid-cols-1 gap-4 min-[700px]:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="preco-modelo">
            Modelo
            <Obrigatorio />
          </Label>
          <Input
            id="preco-modelo"
            name="modelo"
            value={modelo}
            onChange={(e) => campo("modelo", setModelo)(e.target.value)}
            list="modelos-conhecidos"
            placeholder="Nome exato, ex.: gpt-4o"
            readOnly={!!base}
            required
            {...ariaDoErro("preco-modelo", erros.modelo)}
          />
          <datalist id="modelos-conhecidos">
            {modelosConhecidos.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
          <ErroDoCampo id="preco-modelo" erro={erros.modelo} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="preco-provedor">Provedor</Label>
          <Input
            id="preco-provedor"
            name="provedor"
            value={provedor}
            onChange={(e) => setProvedor(e.target.value)}
            placeholder="Ex.: openai"
          />
        </div>
      </div>

      <CampoVigencia
        valor={vigencia}
        onChange={campo("vigencia", setVigencia)}
        erro={erros.vigencia}
        descricaoDoImpacto="os eventos deste modelo"
      />

      <div className="grid grid-cols-1 gap-4 min-[700px]:grid-cols-2">
        <CampoValor
          id="preco-entrada"
          nome="entrada"
          rotulo="Entrada"
          valor={entrada}
          onChange={campo("entrada", setEntrada)}
          sufixo={`${moeda}/1M`}
          erro={erros.entrada}
        />
        <CampoValor
          id="preco-saida"
          nome="saida"
          rotulo="Saída"
          valor={saida}
          onChange={campo("saida", setSaida)}
          sufixo={`${moeda}/1M`}
          erro={erros.saida}
        />
        <CampoValor
          id="preco-cache-leitura"
          nome="cache_leitura"
          rotulo="Cache leitura"
          valor={cacheLeitura}
          onChange={campo("cache_leitura", setCacheLeitura)}
          sufixo={`${moeda}/1M`}
          erro={erros.cache_leitura}
        />
        <CampoValor
          id="preco-cache-escrita"
          nome="cache_escrita"
          rotulo="Cache escrita"
          valor={cacheEscrita}
          onChange={campo("cache_escrita", setCacheEscrita)}
          sufixo={`${moeda}/1M`}
          erro={erros.cache_escrita}
        />
      </div>

      <p className="text-muted-foreground text-[12.5px]">
        Os quatro baldes são cobrados separados e não se sobrepõem. Modelo sem cache fica com zero
        nos dois últimos — o painel não cobra o que não foi reportado.
      </p>
    </MolduraDoFormulario>
  );
}

const FALTANDO_MENSAGEM = {
  pais: "Informe a sigla de 2 letras do país do destinatário, como BR.",
  vigencia: "Escolha a data a partir da qual esta tarifa vale.",
  por_mensagem: "Informe a tarifa por mensagem cobrável.",
};

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
  const { erros, conferir, limpar, zerar } = useValidacao(FALTANDO_MENSAGEM);

  const moeda = base?.moeda ?? MOEDA_PADRAO;

  useEffect(() => {
    if (!aberto) return;
    setErro(null);
    zerar();
    setVigencia(hojeISO());
    setCategoria(base?.categoria ?? "utility");
    setPais(base?.pais ?? "");
    setPorMensagem(base ? String(base.por_mensagem) : "");
  }, [aberto, base, zerar]);

  const salvar = useMutation({
    mutationFn: () =>
      apiPost("/v1/precos/mensagem", {
        categoria,
        pais,
        moeda,
        vigencia_inicio: vigencia,
        por_mensagem: porMensagem,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["precos-mensagem"] });
      invalidarCusto(queryClient, "whatsapp");
      toast.success(
        `Tarifa de ${nomeDaCategoria(categoria)} em ${pais} vale a partir de ${formatDateOnly(vigencia)}.`,
      );
      onOpenChange(false);
    },
    onError: (e) => setErro(mensagemDoErro(e)),
  });

  const enviar = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErro(null);
    if (!conferir(e.currentTarget)) return;
    salvar.mutate();
  };

  const campo = (nome: string, set: (v: string) => void) => (v: string) => {
    set(v);
    limpar(nome);
  };

  return (
    <MolduraDoFormulario
      aberto={aberto}
      onOpenChange={onOpenChange}
      titulo={
        base
          ? `Nova tarifa para ${nomeDaCategoria(base.categoria)} · ${base.pais}`
          : "Nova tarifa de mensagem"
      }
      descricao="A tarifa é por mensagem cobrável, e a Meta cobra por categoria e país do destinatário."
      erro={erro}
      enviando={salvar.isPending}
      onSubmit={enviar}
    >
      <div className="grid grid-cols-1 gap-4 min-[700px]:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="preco-categoria">
            Categoria
            <Obrigatorio />
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

        <div className="space-y-1.5">
          <Label htmlFor="preco-pais">
            País do destinatário
            <Obrigatorio />
          </Label>
          <Input
            id="preco-pais"
            name="pais"
            value={pais}
            // Maiúsculas já na digitação: o preço casa com a mensagem por igualdade de texto, e
            // `br` cadastrado com `BR` recebido não dá erro — dá custo em branco para sempre.
            onChange={(e) => campo("pais", setPais)(e.target.value.toUpperCase().slice(0, 2))}
            placeholder="Sigla de 2 letras, ex.: BR"
            className="uppercase placeholder:normal-case"
            maxLength={2}
            readOnly={!!base}
            required
            {...ariaDoErro("preco-pais", erros.pais)}
          />
          <ErroDoCampo id="preco-pais" erro={erros.pais} />
        </div>
      </div>

      <CampoVigencia
        valor={vigencia}
        onChange={campo("vigencia", setVigencia)}
        erro={erros.vigencia}
        descricaoDoImpacto="as mensagens desta categoria e país"
      />

      <div className="grid grid-cols-1 gap-4 min-[700px]:grid-cols-2">
        <CampoValor
          id="preco-por-mensagem"
          nome="por_mensagem"
          rotulo="Por mensagem"
          valor={porMensagem}
          onChange={campo("por_mensagem", setPorMensagem)}
          sufixo={moeda}
          erro={erros.por_mensagem}
        />
      </div>

      <p className="text-muted-foreground text-[12.5px]">
        Mensagem de serviço não entra aqui: quem decide se a mensagem é cobrável é a Meta, no
        próprio evento.
      </p>
    </MolduraDoFormulario>
  );
}
