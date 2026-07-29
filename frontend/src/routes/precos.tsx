import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";

import { EmptyBox, ErrorBox } from "@/components/empty-states";
import { FaixaDePreco, type Vigencia } from "@/components/faixa-preco";
import {
  DialogoPrecoMensagem,
  DialogoPrecoModelo,
  type BasePrecoMensagem,
  type BasePrecoModelo,
} from "@/components/dialogo-preco";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiGet } from "@/lib/api";
import { formatTarifa, toISODate } from "@/lib/format";
import { CATEGORIAS } from "@/lib/grafico";
import type { PrecoMensagem, PrecoModelo } from "@/lib/api-types";

export const Route = createFileRoute("/precos")({
  head: () => ({
    meta: [
      { title: "Preços — Painel de custos" },
      {
        name: "description",
        content: "A tabela de preços que converte token e mensagem em dinheiro, por vigência.",
      },
      { property: "og:title", content: "Preços — Painel de custos" },
      {
        property: "og:description",
        content: "Quanto custa cada modelo e cada categoria de mensagem, e desde quando.",
      },
    ],
  }),
  component: Precos,
});

/**
 * A tela de preços — a única do painel que escreve.
 *
 * As outras três leem fatos; esta cadastra a régua com que os fatos viram dinheiro. Fica fora dos
 * grupos por origem de propósito: preço não é uma origem de custo, é o que traduz as duas. E é
 * organizada por **o que está sendo precificado** (um modelo, um par categoria/país), não por linha
 * de tabela — a pergunta que se faz aqui é "quanto custa hoje", e a lista crua repetiria o mesmo
 * modelo em cada reajuste que ele já teve.
 */
function Precos() {
  return (
    <Tabs defaultValue="modelos" className="flex flex-col gap-4">
      <TabsList>
        <TabsTrigger value="modelos">Modelos</TabsTrigger>
        <TabsTrigger value="mensagens">Mensagens</TabsTrigger>
      </TabsList>
      <TabsContent value="modelos" className="mt-0">
        <PrecosDeModelo />
      </TabsContent>
      <TabsContent value="mensagens" className="mt-0">
        <PrecosDeMensagem />
      </TabsContent>
    </Tabs>
  );
}

/**
 * A linha que vale hoje, dentre as vigências de um mesmo item.
 *
 * As linhas chegam da mais nova para a mais antiga, e a mais nova nem sempre é a que vale: um preço
 * agendado para o mês que vem é a primeira da lista e ainda não vale nada. O formulário precisa
 * abrir com o mesmo número que a faixa exibe como vigente — senão "Novo preço" prefila uma tarifa
 * que a tela não mostrou em lugar nenhum. Sem nenhuma vigente (só futuras), a mais nova serve de
 * ponto de partida.
 */
function vigenteHoje<T extends { vigencia_inicio: string }>(linhas: T[]): T {
  const hoje = toISODate(new Date());
  return linhas.find((l) => l.vigencia_inicio <= hoje) ?? linhas[0];
}

/** Junta as linhas pelo que elas precificam, preservando a ordem que o backend já deu. */
function agrupar<T>(itens: T[], chave: (item: T) => string): Map<string, T[]> {
  const grupos = new Map<string, T[]>();
  for (const item of itens) {
    const k = chave(item);
    const atual = grupos.get(k);
    if (atual) atual.push(item);
    else grupos.set(k, [item]);
  }
  return grupos;
}

function Carregando() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-40 w-full rounded-xl" />
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  );
}

/** O cabeçalho de cada aba: o que a lista conta, e a porta para acrescentar. */
function Cabecalho({
  contagem,
  singular,
  plural,
  onNovo,
}: {
  contagem: number;
  singular: string;
  plural: string;
  onNovo: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="etiqueta">
        {contagem} {contagem === 1 ? singular : plural}
      </p>
      <Button onClick={onNovo} className="gap-1.5">
        <Plus className="h-4 w-4" />
        Novo preço
      </Button>
    </div>
  );
}

function PrecosDeModelo() {
  const [aberto, setAberto] = useState(false);
  const [base, setBase] = useState<BasePrecoModelo | null>(null);

  const precos = useQuery({
    queryKey: ["precos-modelo"],
    queryFn: () => apiGet<PrecoModelo[]>("/v1/precos"),
  });

  // Os modelos que já apareceram em evento. Servem à lista de sugestões do formulário e, antes
  // disso, ao aviso: modelo com evento e sem preço é custo em branco no painel inteiro.
  const modelosVistos = useQuery({
    queryKey: ["modelos"],
    queryFn: () => apiGet<string[]>("/v1/llm/modelos"),
    staleTime: 60_000,
  });

  const grupos = useMemo(() => agrupar(precos.data ?? [], (p) => p.modelo), [precos.data]);
  const semPreco = (modelosVistos.data ?? []).filter((m) => !grupos.has(m));

  const abrir = (b: BasePrecoModelo | null) => {
    setBase(b);
    setAberto(true);
  };

  if (precos.isLoading) return <Carregando />;
  if (precos.error) return <ErrorBox error={precos.error} />;

  return (
    <div className="flex flex-col gap-4">
      <Cabecalho
        contagem={grupos.size}
        singular="modelo precificado"
        plural="modelos precificados"
        onNovo={() => abrir(null)}
      />

      {semPreco.length > 0 && (
        <SemPreco modelos={semPreco} onEscolher={(m) => abrir({ modelo: m })} />
      )}

      {grupos.size === 0 ? (
        <EmptyBox message="Nenhum preço cadastrado. Enquanto a tabela estiver vazia, o custo de todo evento de LLM aparece em branco no painel." />
      ) : (
        [...grupos].map(([modelo, linhas]) => {
          const vigente = vigenteHoje(linhas);

          return (
            <FaixaDePreco
              key={modelo}
              titulo={modelo}
              subtitulo={vigente.provedor}
              unidade="por milhão de tokens"
              vigencias={linhas.map(vigenciaDeModelo)}
              onNovoPreco={() =>
                abrir({
                  modelo,
                  provedor: vigente.provedor,
                  entrada_por_milhao: vigente.entrada_por_milhao,
                  saida_por_milhao: vigente.saida_por_milhao,
                  cache_leitura_por_milhao: vigente.cache_leitura_por_milhao,
                  cache_escrita_por_milhao: vigente.cache_escrita_por_milhao,
                })
              }
            />
          );
        })
      )}

      <DialogoPrecoModelo
        aberto={aberto}
        onOpenChange={setAberto}
        base={base}
        modelosConhecidos={modelosVistos.data ?? []}
      />
    </div>
  );
}

function vigenciaDeModelo(p: PrecoModelo): Vigencia {
  return {
    id: p.id,
    desde: p.vigencia_inicio,
    leituras: [
      { rotulo: "Entrada", valor: formatTarifa(p.entrada_por_milhao, p.moeda) },
      { rotulo: "Saída", valor: formatTarifa(p.saida_por_milhao, p.moeda) },
      { rotulo: "Cache leitura", valor: formatTarifa(p.cache_leitura_por_milhao, p.moeda) },
      { rotulo: "Cache escrita", valor: formatTarifa(p.cache_escrita_por_milhao, p.moeda) },
    ],
  };
}

/**
 * O buraco, dito em voz alta.
 *
 * Modelo sem preço não some do painel — ele aparece com os tokens e com o custo em branco, o que é
 * fácil de não notar num total que continua parecendo plausível. Esta é a tela que pode consertar
 * isso, então é aqui que a falta precisa estar visível.
 */
function SemPreco({ modelos, onEscolher }: { modelos: string[]; onEscolher: (m: string) => void }) {
  return (
    <section className="border-destructive/40 bg-card rounded-xl border border-dashed p-5">
      <h2 className="etiqueta">
        {modelos.length === 1 ? "1 modelo sem preço" : `${modelos.length} modelos sem preço`}
      </h2>
      <p className="text-muted-foreground mt-1.5 text-sm">
        Já apareceram em eventos e não têm tarifa cadastrada: o custo deles fica em branco no
        painel, e o total do período sai menor do que foi.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {modelos.map((m) => (
          <Button
            key={m}
            variant="outline"
            size="sm"
            className="gap-1.5 font-mono"
            onClick={() => onEscolher(m)}
          >
            <Plus className="h-3.5 w-3.5" />
            {m}
          </Button>
        ))}
      </div>
    </section>
  );
}

function PrecosDeMensagem() {
  const [aberto, setAberto] = useState(false);
  const [base, setBase] = useState<BasePrecoMensagem | null>(null);

  const precos = useQuery({
    queryKey: ["precos-mensagem"],
    queryFn: () => apiGet<PrecoMensagem[]>("/v1/precos/mensagem"),
  });

  // A tarifa é por categoria **e** país: as duas juntas são a chave, e separá-las em duas listas
  // faria parecer que existe "o preço do marketing" ou "o preço do Brasil".
  const grupos = useMemo(
    () => agrupar(precos.data ?? [], (p) => `${p.categoria} ${p.pais}`),
    [precos.data],
  );

  const abrir = (b: BasePrecoMensagem | null) => {
    setBase(b);
    setAberto(true);
  };

  if (precos.isLoading) return <Carregando />;
  if (precos.error) return <ErrorBox error={precos.error} />;

  return (
    <div className="flex flex-col gap-4">
      <Cabecalho
        contagem={grupos.size}
        singular="tarifa"
        plural="tarifas"
        onNovo={() => abrir(null)}
      />

      {grupos.size === 0 ? (
        <EmptyBox message="Nenhuma tarifa cadastrada. Sem ela, mensagem cobrável aparece no painel com custo em branco." />
      ) : (
        [...grupos].map(([chave, linhas]) => {
          const vigente = vigenteHoje(linhas);
          const { categoria, pais } = vigente;
          const cor = CATEGORIAS.find((c) => c.chave === categoria)?.cor;

          return (
            <FaixaDePreco
              key={chave}
              titulo={pais}
              distintivo={
                <span
                  className="etiqueta rounded-sm px-2 py-1 text-[0.625rem]"
                  style={cor ? { background: cor, color: "white" } : undefined}
                >
                  {categoria}
                </span>
              }
              unidade="por mensagem cobrável"
              vigencias={linhas.map(vigenciaDeMensagem)}
              onNovoPreco={() => abrir({ categoria, pais, por_mensagem: vigente.por_mensagem })}
            />
          );
        })
      )}

      <DialogoPrecoMensagem aberto={aberto} onOpenChange={setAberto} base={base} />
    </div>
  );
}

function vigenciaDeMensagem(p: PrecoMensagem): Vigencia {
  return {
    id: p.id,
    desde: p.vigencia_inicio,
    leituras: [{ rotulo: "Por mensagem", valor: formatTarifa(p.por_mensagem, p.moeda) }],
  };
}
