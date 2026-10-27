import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useNavigate,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { Moldura } from "@/components/app-sidebar";
import { ErroNaRaiz, PaginaNaoEncontrada } from "@/components/pagina-de-estado";
import { Skeleton } from "@/components/ui/skeleton";
import { SCRIPT_DO_TEMA, ThemeProvider } from "@/lib/theme";
import { COR_DA_MARCA, variaveisDaMarca } from "@/lib/marca";
import { applyAccent } from "@/styles/wide-ui/accent";
import { SessaoProvider, useSessao } from "@/lib/sessao";
import { FiltersProvider } from "@/lib/filters";
import { Toaster } from "@/components/ui/sonner";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Painel de custos — LLM e WhatsApp" },
      {
        name: "description",
        content: "Painel de controle para acompanhar consumo, custos e métricas de LLM e WhatsApp.",
      },
      { property: "og:title", content: "Painel de custos — LLM e WhatsApp" },
      {
        property: "og:description",
        content:
          "Dashboard para monitorar tokens, mensagens e custo das duas origens em tempo real.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      // Inter em tudo, números inclusive (o `tokens.css` liga os algarismos tabulares). Vem por
      // <link> e não por @import no CSS para não bloquear o parse da folha de estilo principal.
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
      },
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  // As rotas filhas herdam os estados pelo `defaultNotFoundComponent`/`defaultErrorComponent` do
  // roteador; aqui fica só o que é da raiz: o 404 (que ela desenha no próprio `<Outlet>`, dentro
  // da moldura) e a falha dela mesma, que sai em tela cheia porque a moldura não existe.
  notFoundComponent: PaginaNaoEncontrada,
  errorComponent: ErroNaRaiz,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    // O script e o `style` mexem no `<html>` antes do React: o atributo de tema e as variáveis do
    // accent podem não bater com o SSR, e é de propósito.
    <html lang="pt-BR" style={variaveisDaMarca(COR_DA_MARCA)} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_DO_TEMA }} />
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

  // O accent sai no SSR pelo `style` do `<html>`; no cliente quem manda é o `applyAccent`.
  useEffect(() => applyAccent(COR_DA_MARCA), []);

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

/**
 * Enquanto a sessão não responde, o que vai à tela é o esqueleto da moldura — a forma do que vai
 * aparecer, e não um spinner no meio da página. Não mostra item nenhum da barra nem dado: quem
 * talvez não possa ver o painel não vê nem os nomes dos destinos.
 */
function Carregando() {
  return (
    <div role="status" aria-busy="true" className="bg-background flex min-h-screen w-full">
      <span className="sr-only">Carregando</span>
      <div className="border-line bg-surface hidden w-[252px] shrink-0 flex-col gap-3 border-r p-4 min-[1000px]:flex">
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-8 w-8" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-2.5 w-20" />
          </div>
        </div>
        <Skeleton className="h-8 w-full" />
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-6 w-full" />
        ))}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="border-line bg-surface flex h-[52px] items-center gap-2 border-b px-4 min-[700px]:px-7">
          {/* O lugar do hambúrguer, para o conteúdo não pular quando a moldura chegar. */}
          <div className="-ml-2 grid h-9 w-9 shrink-0 place-items-center min-[1000px]:hidden">
            <Skeleton className="h-[18px] w-[18px]" />
          </div>
          <Skeleton className="h-3.5 w-40" />
        </div>
        <div className="mx-auto w-full max-w-[1400px] space-y-4 px-4 pt-6 min-[700px]:px-7">
          <Skeleton className="h-6 w-56" />
          <div className="grid grid-cols-1 gap-3 min-[700px]:grid-cols-2 min-[1100px]:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-[104px]" />
            ))}
          </div>
          <Skeleton className="h-72" />
        </div>
      </div>
    </div>
  );
}

/**
 * Decide entre a tela de login e o painel.
 *
 * Fica aqui, e não num `beforeLoad` de rota, porque quem sabe da sessão é o cookie `HttpOnly` —
 * o roteador não consegue lê-lo, só o `GET /v1/sessao` responde. Enquanto essa resposta não
 * chega (inclusive no SSR, onde ela nunca chega) o que vai à tela é o esqueleto da moldura: renderizar o
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
      <Moldura>
        <Outlet />
      </Moldura>
    </FiltersProvider>
  );
}
