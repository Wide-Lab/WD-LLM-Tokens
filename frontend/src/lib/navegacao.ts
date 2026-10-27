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
  /** Ausente no último passo: a página atual não é link para ela mesma. */
  url?: string;
}

/**
 * A trilha do topo: os pais em links, a página atual por último.
 *
 * Sai do destino ativo da barra, e não de uma tabela de títulos à parte, para o topo e a barra
 * nunca discordarem de onde se está. O grupo entra como primeiro passo (apontando para o painel
 * da origem); o ator, que não é item da barra, entra como o passo depois de "Eventos".
 */
export function trilhaDaRota(caminhoAtual: string): Migalha[] {
  const url = destinoAtivo(caminhoAtual);
  const grupo = GRUPOS.find((g) => g.itens.some((i) => i.url === url));
  const item = grupo?.itens.find((i) => i.url === url);
  if (!grupo || !item) return [{ rotulo: "Painel" }];

  const trilha: Migalha[] = [];
  // Grupo sem rótulo não tem nome para virar passo da trilha.
  if (grupo.rotulo) {
    trilha.push({ rotulo: grupo.rotulo, url: grupo.itens[0].url });
  }
  trilha.push({ rotulo: item.title, url: item.url });

  const resto = caminhoAtual.slice(url!.length).split("/").filter(Boolean);
  for (const parte of resto) trilha.push({ rotulo: decodificar(parte) });

  // O último passo é a página atual, sem link.
  trilha[trilha.length - 1] = { rotulo: trilha[trilha.length - 1].rotulo };
  return trilha;
}

function decodificar(parte: string): string {
  try {
    return decodeURIComponent(parte);
  } catch {
    return parte;
  }
}
