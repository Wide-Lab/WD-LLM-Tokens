import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, ListOrdered, LogOut, Moon, Sun, Sparkles } from "lucide-react";
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

const items = [
  { title: "Visão geral", url: "/", icon: LayoutDashboard },
  { title: "Eventos", url: "/eventos", icon: ListOrdered },
];

export function AppSidebar() {
  const currentPath = useRouterState({ select: (r) => r.location.pathname });
  const { theme, toggle } = useTheme();
  const { usuario, sair } = useSessao();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <div className="truncate text-sm font-semibold">Painel LLM</div>
            <div className="truncate text-xs text-muted-foreground">Uso e custos</div>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navegação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={currentPath === item.url} tooltip={item.title}>
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
      </SidebarContent>
      <SidebarFooter className="gap-2">
        {usuario && (
          <div className="min-w-0 px-2 group-data-[collapsible=icon]:hidden">
            <div className="truncate text-sm font-medium">{usuario.nome}</div>
            <div className="truncate text-xs text-muted-foreground">{usuario.email}</div>
          </div>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={toggle}
          className="w-full justify-start gap-2"
        >
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
