import { Link, useRouterState } from "@tanstack/react-router";
import {
  CalendarClock,
  ChartColumn,
  FileText,
  Gauge,
  LayoutDashboard,
  ListOrdered,
  LogOut,
  MessageSquare,
  Moon,
  Sun,
  Tags,
  Users,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/lib/theme";
import { useSessao } from "@/lib/sessao";

/**
 * Três grupos, um por origem de custo, com a soma no topo e sem rótulo.
 *
 * A lista única de antes dizia, pela própria forma, que o painel era de uma coisa só. Agora a
 * primeira leitura da barra é o desenho do produto: o consolidado é a casa, LLM e WhatsApp são
 * as duas origens que ele soma.
 *
 * Depois das origens vem o que não é origem nenhuma, e por isso fica no fim: `Disparos` cadastra
 * quem recebe, `Preços` cadastra quanto custa. As duas seções mexem no gasto de amanhã em vez de
 * explicar o de ontem, e nenhuma delas soma no consolidado.
 */
const GRUPOS = [
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
      // Fim do grupo, depois das duas leituras: é a única aba da seção que cadastra, e vem depois
      // do que ela explica — o texto aprovado é a causa das mensagens listadas acima.
      { title: "Templates", url: "/whatsapp/templates", icon: FileText },
    ],
  },
  // Seção própria, e não uma quarta aba do WhatsApp: o WhatsApp é o canal, o disparo é a decisão
  // de usar o canal. Quem está aqui escolhe para quem a mensagem vai; quem está lá lê o que já foi.
  {
    rotulo: "Disparos",
    itens: [
      // Régua antes de clientes porque é para ela que o cliente aponta: o vínculo guarda o id de
      // uma régua, e ler a carteira sem saber o que é uma régua é ler uma coluna de nomes soltos.
      { title: "Réguas", url: "/disparos/reguas", icon: CalendarClock },
      { title: "Clientes", url: "/disparos/clientes", icon: Users },
      // A única leitura da seção, e por isso no fim: as duas de cima decidem o disparo, esta conta
      // o que elas já produziram. É a única aba de Disparos com filtro de data, porque é a única
      // em que período responde alguma coisa.
      { title: "Dashboard", url: "/disparos/dashboard", icon: ChartColumn },
    ],
  },
  // Sozinha no fim e sem rótulo: preço não é uma quarta origem de custo — é a régua com que as
  // outras duas viram dinheiro. Um grupo "Configurações" com um item só nomearia uma gaveta que
  // ainda não existe.
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
function destinoAtivo(caminhoAtual: string): string | undefined {
  return DESTINOS.find((url) =>
    url === "/" ? caminhoAtual === "/" : caminhoAtual === url || caminhoAtual.startsWith(`${url}/`),
  );
}

export function AppSidebar() {
  const currentPath = useRouterState({ select: (r) => r.location.pathname });
  const ativo = destinoAtivo(currentPath);
  const { theme, toggle } = useTheme();
  const { usuario, sair } = useSessao();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2.5 px-2 py-3">
          <div className="bg-primary text-primary-foreground grid h-9 w-9 shrink-0 place-items-center rounded-md">
            <Gauge className="h-5 w-5" />
          </div>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <div className="truncate text-sm font-semibold tracking-tight">Painel de custos</div>
            <div className="etiqueta mt-1 truncate">LLM e WhatsApp</div>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {GRUPOS.map((grupo, i) => (
          <SidebarGroup key={grupo.rotulo ?? i}>
            {grupo.rotulo && (
              <SidebarGroupLabel className="etiqueta">{grupo.rotulo}</SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {grupo.itens.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      isActive={item.url === ativo}
                      // Recolhida, a barra some com o rótulo do grupo e sobram dois "Painel"
                      // iguais: o tooltip precisa dizer de qual origem cada um é.
                      tooltip={grupo.rotulo ? `${grupo.rotulo} · ${item.title}` : item.title}
                    >
                      <Link to={item.url} className="flex items-center gap-2">
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="gap-2">
        {usuario && (
          <div className="border-sidebar-border min-w-0 border-t px-2 pt-3 group-data-[collapsible=icon]:hidden">
            <div className="truncate text-sm font-medium">{usuario.nome}</div>
            <div className="text-muted-foreground truncate font-mono text-xs">{usuario.email}</div>
          </div>
        )}
        <Button variant="outline" size="sm" onClick={toggle} className="w-full justify-start gap-2">
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          <span className="group-data-[collapsible=icon]:hidden">
            {theme === "dark" ? "Tema claro" : "Tema escuro"}
          </span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void sair()}
          className="w-full justify-start gap-2"
          title="Sair"
        >
          <LogOut className="h-4 w-4" />
          <span className="group-data-[collapsible=icon]:hidden">Sair</span>
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
