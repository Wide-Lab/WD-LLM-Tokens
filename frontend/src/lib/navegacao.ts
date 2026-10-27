import {
  Gauge,
  LayoutDashboard,
  ListOrdered,
  MessageSquare,
  Tags,
  type LucideIcon,
} from "lucide-react";

export interface ItemDeNavegacao {
  title: string;
  url: string;
  icon: LucideIcon;
}

export interface GrupoDeNavegacao {
  rotulo: string | null;
  itens: ItemDeNavegacao[];
}

/**
 * Três grupos, um por origem de custo, com a soma no topo e sem rótulo.
 *
 * A lista única de antes dizia, pela própria forma, que o painel era de uma coisa só. Agora a
 * primeira leitura da barra é o desenho do produto: o consolidado é a casa, LLM e WhatsApp são
 * as duas origens que ele soma.
 *
 * É a mesma lista que a barra lateral desenha, que a busca (`Ctrl K`) oferece e que a trilha do
 * topo usa para nomear os pais — uma fonte só, para os três não divergirem.
 */
export const GRUPOS: GrupoDeNavegacao[] = [
  {
    rotulo: null,
    itens: [{ title: "Visão geral", url: "/", icon: LayoutDashboard }],
  },
  {
    rotulo: "LLM",
    itens: [
      { title: "Painel", url: "/llm", icon: Gauge },
      { title: "Eventos", url: "/llm/eventos", icon: ListOrdered },
    ],
  },
  {
    rotulo: "WhatsApp",
    itens: [
      { title: "Painel", url: "/whatsapp", icon: MessageSquare },
      { title: "Mensagens", url: "/whatsapp/mensagens", icon: ListOrdered },
    ],
  },
  // Sozinha no fim e sem rótulo: preço não é uma quarta origem de custo — é a régua com que as
  // outras duas viram dinheiro. Um grupo "Configurações" com um item só nomearia uma gaveta que
  // ainda não existe. A barra separa o grupo sem rótulo com um fio, para ele não ler como
  // continuação do WhatsApp.
  {
    rotulo: null,
    itens: [{ title: "Preços", url: "/precos", icon: Tags }],
  },
];

/** Todos os destinos da barra, do mais fundo para o mais raso. */
const DESTINOS = GRUPOS.flatMap((g) => g.itens.map((i) => i.url)).sort(
  (a, b) => b.length - a.length,
);

/**
 * O destino que a barra acende — um só, o mais específico que casa com a rota atual.
 *
 * Cada item decidindo sozinho por prefixo acendia dois de uma vez: em `/llm/eventos`, o "Eventos" e
 * o "Painel" do mesmo grupo, o que é a barra dizendo que se está em dois lugares. Igualdade exata
 * corrigiria isso e apagaria a barra inteira em `/llm/eventos/<ator>`, justo na tela mais funda.
 * Escolher o casamento mais longo faz as duas coisas: o filho ganha do pai quando ele próprio é um
 * item, e o pai segue aceso pelo neto que não é. `/` casa só exato — ele é prefixo de tudo.
 */
export function destinoAtivo(caminhoAtual: string): string | undefined {
  return DESTINOS.find((url) =>
    url === "/" ? caminhoAtual === "/" : caminhoAtual === url || caminhoAtual.startsWith(`${url}/`),
  );
}

export interface Migalha {
  rotulo: string;
  /** Ausente no último passo (a página atual não é link para ela mesma) e no grupo que já é a
   *  página atual. */
  url?: string;
  /**
   * Só no último passo, e só abaixo de 640px: de onde ele é. No celular os pais somem da trilha, e
   * sem isto `/llm` e `/whatsapp` diriam os dois apenas "Painel", e o ator seria um id solto.
   */
  contexto?: string;
}

/** A trilha de um caminho que não existe — o topo não pode dizer "Painel" sobre o 404. */
export const TRILHA_NAO_ENCONTRADA: Migalha[] = [{ rotulo: "Página não encontrada" }];

/**
 * A trilha do topo: os pais em links, a página atual por último.
 *
 * Sai do destino ativo da barra, e não de uma tabela de títulos à parte, para o topo e a barra
 * nunca discordarem de onde se está. O grupo entra como primeiro passo (apontando para o painel
 * da origem — ou sem link, quando o painel é a própria página); o ator, que não é item da barra,
 * entra como o passo depois de "Eventos".
 */
export function trilhaDaRota(caminhoAtual: string): Migalha[] {
  const url = destinoAtivo(caminhoAtual);
  const grupo = GRUPOS.find((g) => g.itens.some((i) => i.url === url));
  const item = grupo?.itens.find((i) => i.url === url);
  if (!grupo || !item) return TRILHA_NAO_ENCONTRADA;

  const resto = caminhoAtual.slice(item.url.length).split("/").filter(Boolean);
  const trilha: Migalha[] = [];
  // Grupo sem rótulo não tem nome para virar passo da trilha.
  if (grupo.rotulo) {
    const ehAPropriaPagina = item === grupo.itens[0] && resto.length === 0;
    trilha.push({ rotulo: grupo.rotulo, url: ehAPropriaPagina ? undefined : grupo.itens[0].url });
  }
  trilha.push({ rotulo: item.title, url: item.url });
  // Abaixo de um item da barra só existe o ator, em `/llm/eventos/$ator`.
  for (const parte of resto) trilha.push({ rotulo: decodificar(parte) });

  // O último passo é a página atual, sem link, e no celular diz de onde é.
  const ultimo = trilha[trilha.length - 1];
  const contexto = resto.length > 0 ? [grupo.rotulo, "Ator"] : [grupo.rotulo];
  trilha[trilha.length - 1] = {
    rotulo: ultimo.rotulo,
    contexto: contexto.filter(Boolean).join(" · ") || undefined,
  };
  return trilha;
}

function decodificar(parte: string): string {
  try {
    return decodeURIComponent(parte);
  } catch {
    return parte;
  }
}
