import { createFileRoute } from "@tanstack/react-router";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { Cpu, MessageSquare, Plus, TriangleAlert, Upload } from "lucide-react";

import { CabecalhoDaPagina } from "@/components/cabecalho-da-pagina";
import {
  TabelaDePrecos,
  type ItemDePreco,
  type TermosDePreco,
  type Vigencia,
} from "@/components/faixa-preco";
import {
  DialogoPrecoMensagem,
  DialogoPrecoModelo,
  type BasePrecoMensagem,
  type BasePrecoModelo,
} from "@/components/dialogo-preco";
import { DialogoImportarPrecos } from "@/components/importar-precos";
import { PainelCard } from "@/components/painel-card";
import { Button } from "@/components/ui/button";
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

type Aba = "modelos" | "mensagens";

/** Cada aba fala uma palavra só: o cabeçalho, a ação da linha e o diálogo dizem a mesma coisa. */
const TERMOS: Record<Aba, TermosDePreco> = {
  modelos: { acao: "Novo preço", primeiro: "O primeiro preço", proximo: "novo preço em" },
  mensagens: { acao: "Nova tarifa", primeiro: "A primeira tarifa", proximo: "nova tarifa em" },
};

/**
 * A tela de preços — a única do painel que escreve.
 *
 * As outras três leem fatos; esta cadastra a régua com que os fatos viram dinheiro. Fica fora dos
 * grupos por origem de propósito: preço não é uma origem de custo, é o que traduz as duas. E é
 * organizada por **o que está sendo precificado** (um modelo, um par categoria/país), não por linha
 * de tabela — a pergunta que se faz aqui é "quanto custa hoje", e a lista crua repetiria o mesmo
 * modelo em cada reajuste que ele já teve.
 *
 * As duas listas são buscadas na abertura (dois `GET` pequenos), e não só ao trocar de aba: a
 * contagem de cada uma aparece na própria aba. Os diálogos moram aqui, e não dentro das abas, porque
 * a importação grava linha a linha — se ela vivesse na aba e a aba desmontasse no meio de um lote,
 * o relatório do que entrou e do que não entrou sumiria junto, com os `POST` ainda rodando.
 */
function Precos() {
  const [aba, setAba] = useState<Aba>("modelos");

  const [abertoModelo, setAbertoModelo] = useState(false);
  const [baseModelo, setBaseModelo] = useState<BasePrecoModelo | null>(null);
  const [abertoMensagem, setAbertoMensagem] = useState(false);
  const [baseMensagem, setBaseMensagem] = useState<BasePrecoMensagem | null>(null);
  const [importandoModelo, setImportandoModelo] = useState(false);
  const [importandoMensagem, setImportandoMensagem] = useState(false);

  // Quem abriu o diálogo — o botão do cabeçalho, o "+" de uma linha, o do alerta —, para o foco
  // voltar a ele ao fechar. Os diálogos não têm `DialogTrigger`, e sem isto o foco cairia no `<body>`.
  const origemDoFoco = useRef<HTMLElement | null>(null);
  const guardarOrigem = () => {
    origemDoFoco.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
  };

  const precosModelo = useQuery({
    queryKey: ["precos-modelo"],
    queryFn: () => apiGet<PrecoModelo[]>("/v1/precos"),
  });
  const precosMensagem = useQuery({
    queryKey: ["precos-mensagem"],
    queryFn: () => apiGet<PrecoMensagem[]>("/v1/precos/mensagem"),
  });

  // Os modelos que já apareceram em evento. Servem à lista de sugestões do formulário e, antes
  // disso, ao aviso: modelo com evento e sem preço é custo em branco no painel inteiro.
  const modelosVistos = useQuery({
    queryKey: ["modelos"],
    queryFn: () => apiGet<string[]>("/v1/llm/modelos"),
    staleTime: 60_000,
  });

  const gruposModelo = useMemo(
    () => agrupar(precosModelo.data ?? [], (p) => p.modelo),
    [precosModelo.data],
  );
  // A tarifa é por categoria **e** país: as duas juntas são a chave, e separá-las em duas listas
  // faria parecer que existe "o preço do marketing" ou "o preço do Brasil". O separador entra como
  // escape e não como byte no fonte: gravado, ele faz o `grep` ler o arquivo como binário e pular a
  // tela inteira na busca — é o mesmo cuidado do BOM em `lib/csv.ts`.
  const gruposMensagem = useMemo(
    () => agrupar(precosMensagem.data ?? [], (p) => `${p.categoria}\u0000${p.pais}`),
    [precosMensagem.data],
  );

  const abrirModelo = (b: BasePrecoModelo | null) => {
    guardarOrigem();
    setBaseModelo(b);
    setAbertoModelo(true);
  };
  const abrirMensagem = (b: BasePrecoMensagem | null) => {
    guardarOrigem();
    setBaseMensagem(b);
    setAbertoMensagem(true);
  };

  return (
    <div className="flex flex-col gap-4">
      <CabecalhoDaPagina
        titulo="Preços"
        subtitulo="Quanto custa cada modelo e cada mensagem cobrável, e desde quando"
        acoes={
          // Importar fica contornado ao lado do primário: o caminho de todo dia é o reajuste de um
          // preço só, e a importação é a de encher a tabela — a estreia do painel, ou o dia em que
          // um provedor mexeu no preço de doze modelos de uma vez. Os dois agem na aba aberta.
          <>
            <Button
              variant="outline"
              onClick={() => {
                guardarOrigem();
                if (aba === "modelos") setImportandoModelo(true);
                else setImportandoMensagem(true);
              }}
            >
              <Upload />
              Importar CSV
            </Button>
            <Button onClick={() => (aba === "modelos" ? abrirModelo(null) : abrirMensagem(null))}>
              <Plus />
              {TERMOS[aba].acao}
            </Button>
          </>
        }
      />

      <Tabs value={aba} onValueChange={(v) => setAba(v as Aba)} className="flex flex-col gap-4">
        <TabsList>
          <TabsTrigger value="modelos">
            Modelos
            <Contagem consulta={precosModelo} total={gruposModelo.size} />
          </TabsTrigger>
          <TabsTrigger value="mensagens">
            Mensagens
            <Contagem consulta={precosMensagem} total={gruposMensagem.size} />
          </TabsTrigger>
        </TabsList>

        <TabsContent value="modelos" className="mt-0 flex flex-col gap-4">
          <SemPreco
            modelos={(modelosVistos.data ?? []).filter((m) => !gruposModelo.has(m))}
            visivel={!!precosModelo.data}
            onEscolher={(m) => abrirModelo({ modelo: m })}
          />
          <PainelCard
            title="Preços de modelo"
            icon={Cpu}
            hint="por milhão de tokens"
            bleed
            loading={precosModelo.isLoading}
            error={precosModelo.error}
            onRetry={() => void precosModelo.refetch()}
            empty={gruposModelo.size === 0}
            emptyMessage="Nenhum preço cadastrado. Enquanto a tabela estiver vazia, o custo de todo evento de LLM aparece em branco no painel. Cadastre um preço ou importe um CSV."
          >
            <TabelaDePrecos
              rotuloDoItem="Modelo"
              colunas={["Entrada", "Saída", "Cache leitura", "Cache escrita"]}
              termos={TERMOS.modelos}
              itens={[...gruposModelo].map(([modelo, linhas]) => {
                const vigente = vigenteHoje(linhas);
                return {
                  chave: modelo,
                  titulo: modelo,
                  meta: vigente.provedor,
                  vigencias: linhas.map(vigenciaDeModelo),
                  onNovoPreco: () =>
                    abrirModelo({
                      modelo,
                      provedor: vigente.provedor,
                      moeda: vigente.moeda,
                      entrada_por_milhao: vigente.entrada_por_milhao,
                      saida_por_milhao: vigente.saida_por_milhao,
                      cache_leitura_por_milhao: vigente.cache_leitura_por_milhao,
                      cache_escrita_por_milhao: vigente.cache_escrita_por_milhao,
                    }),
                } satisfies ItemDePreco;
              })}
            />
          </PainelCard>
        </TabsContent>

        <TabsContent value="mensagens" className="mt-0">
          <PainelCard
            title="Tarifas de mensagem"
            icon={MessageSquare}
            hint="por mensagem cobrável"
            bleed
            loading={precosMensagem.isLoading}
            error={precosMensagem.error}
            onRetry={() => void precosMensagem.refetch()}
            empty={gruposMensagem.size === 0}
            emptyMessage="Nenhuma tarifa cadastrada. Sem ela, mensagem cobrável aparece no painel com custo em branco. Cadastre uma tarifa ou importe um CSV."
          >
            <TabelaDePrecos
              rotuloDoItem="Tarifa"
              colunas={["Por mensagem"]}
              termos={TERMOS.mensagens}
              itens={[...gruposMensagem].map(([chave, linhas]) => {
                const vigente = vigenteHoje(linhas);
                const { categoria, pais } = vigente;
                return {
                  chave,
                  titulo: `${nomeDaCategoria(categoria)} · ${pais}`,
                  vigencias: linhas.map(vigenciaDeMensagem),
                  onNovoPreco: () =>
                    abrirMensagem({
                      categoria,
                      pais,
                      moeda: vigente.moeda,
                      por_mensagem: vigente.por_mensagem,
                    }),
                } satisfies ItemDePreco;
              })}
            />
          </PainelCard>
        </TabsContent>
      </Tabs>

      <DialogoPrecoModelo
        aberto={abertoModelo}
        onOpenChange={setAbertoModelo}
        base={baseModelo}
        modelosConhecidos={modelosVistos.data ?? []}
        origemDoFoco={origemDoFoco}
      />
      <DialogoPrecoMensagem
        aberto={abertoMensagem}
        onOpenChange={setAbertoMensagem}
        base={baseMensagem}
        origemDoFoco={origemDoFoco}
      />
      <DialogoImportarPrecos
        tipo="modelo"
        aberto={importandoModelo}
        onOpenChange={setImportandoModelo}
        origemDoFoco={origemDoFoco}
      />
      <DialogoImportarPrecos
        tipo="mensagem"
        aberto={importandoMensagem}
        onOpenChange={setImportandoMensagem}
        origemDoFoco={origemDoFoco}
      />
    </div>
  );
}

/** A contagem da aba, na pílula `sel` do wide-ui. Só aparece quando a lista chegou. */
function Contagem({ consulta, total }: { consulta: UseQueryResult<unknown>; total: number }) {
  if (!consulta.data) return null;
  return (
    <span className="bg-sel text-muted-foreground rounded-full px-1.5 text-[11.5px] leading-[18px] font-medium">
      {total}
    </span>
  );
}

function nomeDaCategoria(chave: string): string {
  return CATEGORIAS.find((c) => c.chave === chave)?.nome ?? chave;
}

/**
 * A linha que vale hoje, dentre as vigências de um mesmo item.
 *
 * As linhas chegam da mais nova para a mais antiga, e a mais nova nem sempre é a que vale: um preço
 * agendado para o mês que vem é a primeira da lista e ainda não vale nada. O formulário precisa
 * abrir com o mesmo número que a tabela exibe como vigente — senão "Novo preço" prefila uma tarifa
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

function vigenciaDeMensagem(p: PrecoMensagem): Vigencia {
  return {
    id: p.id,
    desde: p.vigencia_inicio,
    leituras: [{ rotulo: "Por mensagem", valor: formatTarifa(p.por_mensagem, p.moeda) }],
  };
}

/**
 * O buraco, dito em voz alta.
 *
 * Modelo sem preço não some do painel — ele aparece com os tokens e com o custo em branco, o que é
 * fácil de não notar num total que continua parecendo plausível. Esta é a tela que pode consertar
 * isso, então é aqui que a falta precisa estar visível: um alerta `danger-bg` no topo da aba, como o
 * wide-ui pede para condição que bloqueia, com um botão por modelo que abre o cadastro dele.
 */
function SemPreco({
  modelos,
  visivel,
  onEscolher,
}: {
  modelos: string[];
  /** Só com a lista de preços carregada: antes dela, todo modelo visto pareceria sem preço. */
  visivel: boolean;
  onEscolher: (m: string) => void;
}) {
  if (!visivel || modelos.length === 0) return null;

  return (
    <section role="alert" className="bg-danger-bg flex gap-3 rounded-[var(--wu-radius)] px-4 py-3">
      <TriangleAlert className="text-danger mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <h2 className="text-danger text-[13.5px] font-semibold">
          {modelos.length === 1 ? "1 modelo sem preço" : `${modelos.length} modelos sem preço`}
        </h2>
        <p className="text-foreground mt-0.5 text-[13px]">
          Já apareceram em eventos e não têm tarifa: o custo deles fica em branco no painel, e o
          total do período sai menor do que foi. Cadastre o preço de cada um.
        </p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {modelos.map((m) => (
            <Button
              key={m}
              variant="outline"
              size="sm"
              className="max-w-full"
              onClick={() => onEscolher(m)}
              aria-label={`Cadastrar preço de ${m}`}
            >
              <Plus />
              <span className="truncate">{m}</span>
            </Button>
          ))}
        </div>
      </div>
    </section>
  );
}
