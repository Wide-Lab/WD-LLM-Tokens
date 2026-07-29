import { Link, useRouterState } from "@tanstack/react-router";
import {
  Gauge,
  LayoutDashboard,
  ListOrdered,
  LogOut,
  MessageSquare,
  Moon,
  Sun,
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
    ],
  },
];

/**
 * O item do pai fica marcado quando se está no filho.
 *
 * Era igualdade exata, o que bastava com rotas irmãs; com `/llm/eventos/<ator>` embaixo de
 * `/llm/eventos`, deixaria a barra sem nenhum item aceso justo na tela mais funda. `/` é a
 * exceção que casa só exato — ele é prefixo de tudo.
 */
function estaAtivo(caminhoAtual: string, url: string): boolean {
  if (url === "/") return caminhoAtual === "/";
  return caminhoAtual === url || caminhoAtual.startsWith(`${url}/`);
}

export function AppSidebar() {
  const currentPath = useRouterState({ select: (r) => r.location.pathname });
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
                      isActive={estaAtivo(currentPath, item.url)}
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
