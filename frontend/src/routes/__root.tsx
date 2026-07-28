import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useNavigate,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider } from "@/lib/theme";
import { SessaoProvider, useSessao } from "@/lib/sessao";
import { FiltersProvider } from "@/lib/filters";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          A página que você procura não existe ou foi movida.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Ir para o início
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Esta página não carregou
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Algo deu errado. Tente atualizar ou volte para o início.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Tentar novamente
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Início
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Painel LLM — Uso de tokens" },
      {
        name: "description",
        content:
          "Painel de controle para acompanhar consumo, custos e métricas de uso de modelos de linguagem.",
      },
      { property: "og:title", content: "Painel LLM — Uso de tokens" },
      {
        property: "og:description",
        content:
          "Dashboard para monitorar tokens, custos e eventos de uso de LLMs em tempo real.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <SessaoProvider>
          <Portao />
          <Toaster />
        </SessaoProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

function Carregando() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

/**
 * Decide entre a tela de login e o painel.
 *
 * Fica aqui, e não num `beforeLoad` de rota, porque quem sabe da sessão é o cookie `HttpOnly` —
 * o roteador não consegue lê-lo, só o `GET /v1/sessao` responde. Enquanto essa resposta não
 * chega (inclusive no SSR, onde ela nunca chega) o que vai à tela é o spinner: renderizar o
 * painel "otimista" mostraria a moldura de dados a quem talvez não possa vê-los.
 */
function Portao() {
  const { usuario, carregando } = useSessao();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const naTelaDeLogin = pathname === "/login";

  useEffect(() => {
    if (carregando) return;
    if (!usuario && !naTelaDeLogin) navigate({ to: "/login", replace: true });
    if (usuario && naTelaDeLogin) navigate({ to: "/", replace: true });
  }, [usuario, carregando, naTelaDeLogin, navigate]);

  if (carregando) return <Carregando />;
  if (!usuario) return naTelaDeLogin ? <Outlet /> : <Carregando />;
  if (naTelaDeLogin) return <Carregando />;

  return (
    <FiltersProvider>
      <SidebarProvider>
        <div className="flex min-h-screen w-full bg-background">
          <AppSidebar />
          <SidebarInset className="flex min-w-0 flex-1 flex-col">
            <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur">
              <SidebarTrigger />
              <div className="text-sm font-medium text-muted-foreground">
                Painel de uso de tokens
              </div>
            </header>
            <main className="flex-1 p-4 md:p-6">
              <Outlet />
            </main>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </FiltersProvider>
  );
}
