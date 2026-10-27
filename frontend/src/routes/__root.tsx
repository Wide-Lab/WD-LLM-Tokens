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
import { Compass, TriangleAlert } from "lucide-react";

import appCss from "../styles.css?url";
import { Moldura } from "@/components/app-sidebar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { SCRIPT_DO_TEMA, ThemeProvider } from "@/lib/theme";
import { COR_DA_MARCA, variaveisDaMarca } from "@/lib/marca";
import { applyAccent } from "@/styles/wide-ui/accent";
import { SessaoProvider, useSessao } from "@/lib/sessao";
import { FiltersProvider } from "@/lib/filters";
import { Toaster } from "@/components/ui/sonner";

/**
 * Cartão central das páginas fora da moldura (404 e falha), no estado "vazio/erro" do wide-ui:
 * tile de 48px com o ícone, título, uma linha de porquê e a ação que resolve.
 */
function PaginaDeEstado({
  icone,
  tom,
  titulo,
  descricao,
  children,
}: {
  icone: ReactNode;
  tom: "neutro" | "erro";
  titulo: string;
  descricao: string;
  children: ReactNode;
}) {
  return (
    <div className="bg-background flex min-h-screen items-center justify-center px-4">
      <div className="border-line bg-surface shadow-card w-full max-w-md rounded-[var(--wu-radius)] border p-8 text-center">
        <div
          className={cn(
            "mx-auto grid h-12 w-12 place-items-center rounded-[var(--wu-radius)]",
            tom === "erro" ? "bg-danger-bg text-danger" : "bg-sel text-muted-foreground",
          )}
        >
          {icone}
        </div>
        <h1 className="text-foreground mt-4 text-base font-semibold">{titulo}</h1>
        <p className="text-muted-foreground mt-1 text-[13px]">{descricao}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">{children}</div>
      </div>
    </div>
  );
}

function NotFoundComponent() {
  return (
    <PaginaDeEstado
      tom="neutro"
      icone={<Compass className="h-6 w-6" />}
      titulo="Página não encontrada"
      descricao="Este endereço não existe no painel. Volte para a visão geral."
    >
      <Button asChild>
        <Link to="/">Ir para a visão geral</Link>
      </Button>
    </PaginaDeEstado>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  // A mensagem crua vai para o console, não para a tela: quem lê a tela precisa saber o que
  // fazer, não o stack.
  console.error(error);
  const router = useRouter();

  return (
    <PaginaDeEstado
      tom="erro"
      icone={<TriangleAlert className="h-6 w-6" />}
      titulo="Esta página não carregou"
      descricao="Tente de novo. Se continuar falhando, o serviço de métricas pode estar fora do ar."
    >
      <Button
        onClick={() => {
          router.invalidate();
          reset();
        }}
      >
        Tentar de novo
      </Button>
      <Button variant="outline" asChild>
        <a href="/">Ir para a visão geral</a>
      </Button>
    </PaginaDeEstado>
  );
}

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
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
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
    <div
      className="bg-background flex min-h-screen w-full"
      aria-busy="true"
      aria-label="Carregando"
    >
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
        <div className="border-line bg-surface flex h-[52px] items-center border-b px-7">
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
