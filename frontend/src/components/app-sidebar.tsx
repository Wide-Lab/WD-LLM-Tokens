import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { LogOut, Menu, Moon, Search, Sun } from "lucide-react";
import { useEffect, useState } from "react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { GRUPOS, TRILHA_NAO_ENCONTRADA, destinoAtivo, trilhaDaRota } from "@/lib/navegacao";
import { useTheme } from "@/lib/theme";
import { useSessao } from "@/lib/sessao";

/**
 * A moldura do painel no padrão "App shell" do wide-ui: barra lateral de 252px fixa a partir de
 * 1000px, gaveta temporária abaixo disso, e um topo de 52px com a trilha.
 *
 * Não usa o `components/ui/sidebar.tsx` do shadcn: o modo recolhido em ícone dele não existe no
 * wide-ui, e o que sobra (uma coluna fixa e uma gaveta) cabe em menos código do que configurá-lo.
 */
export function Moldura({ children }: { children: React.ReactNode }) {
  const [gavetaAberta, setGavetaAberta] = useState(false);
  const [buscaAberta, setBuscaAberta] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // A gaveta fecha sozinha ao navegar: ficar aberta sobre a página nova esconderia o destino.
  useEffect(() => setGavetaAberta(false), [pathname]);

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        // Busca e gaveta são dois modais: abrir um sobre o outro deixaria o foco preso no de baixo.
        setGavetaAberta(false);
        setBuscaAberta((aberta) => !aberta);
      }
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, []);

  const abrirBusca = () => {
    setGavetaAberta(false);
    setBuscaAberta(true);
  };

  return (
    <div className="bg-background flex min-h-screen w-full">
      <aside className="border-line bg-surface sticky top-0 hidden h-screen w-[252px] shrink-0 border-r min-[1000px]:flex">
        <BarraLateral aoBuscar={abrirBusca} />
      </aside>

      <Sheet open={gavetaAberta} onOpenChange={setGavetaAberta}>
        <SheetContent
          side="left"
          className="bg-surface flex w-[252px] max-w-[85vw] p-0 sm:max-w-[252px]"
        >
          <SheetTitle className="sr-only">Navegação</SheetTitle>
          <SheetDescription className="sr-only">Destinos do painel</SheetDescription>
          <BarraLateral aoBuscar={abrirBusca} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-line bg-surface sticky top-0 z-30 flex h-[52px] shrink-0 items-center gap-2 border-b px-4 min-[700px]:px-7">
          <Button
            variant="ghost"
            size="icon"
            className="-ml-2 min-[1000px]:hidden"
            onClick={() => setGavetaAberta(true)}
            aria-label="Abrir navegação"
          >
            <Menu className="h-[18px] w-[18px]" />
          </Button>
          <Trilha caminho={pathname} />
        </header>
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 pt-4 pb-10 min-[700px]:px-7 min-[700px]:pt-6">
          {children}
        </main>
      </div>

      <BuscaDeComando aberta={buscaAberta} aoMudar={setBuscaAberta} />
    </div>
  );
}

function Trilha({ caminho }: { caminho: string }) {
  // Caminho que não existe ainda pode casar por prefixo com um item da barra (`/llm/qualquer`);
  // quem sabe que é 404 é o roteador, não a lista de destinos.
  const naoEncontrada = useRouterState({
    select: (s) => s.matches.some((m) => m.globalNotFound || m.status === "notFound"),
  });
  const trilha = naoEncontrada ? TRILHA_NAO_ENCONTRADA : trilhaDaRota(caminho);
  return (
    <nav aria-label="Trilha" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1.5 text-[13px]">
        {trilha.map((m, i) => {
          const ultima = i === trilha.length - 1;
          return (
            <li
              key={`${m.rotulo}-${i}`}
              className={cn("flex min-w-0 items-center gap-1.5", !ultima && "hidden sm:flex")}
            >
              {ultima ? (
                <span aria-current="page" className="text-foreground truncate font-semibold">
                  {m.contexto && (
                    <span className="text-subtle font-normal sm:hidden">{m.contexto} · </span>
                  )}
                  {m.rotulo}
                </span>
              ) : (
                <>
                  {m.url ? (
                    <Link to={m.url} className="text-subtle hover:text-foreground truncate">
                      {m.rotulo}
                    </Link>
                  ) : (
                    <span className="text-subtle truncate">{m.rotulo}</span>
                  )}
                  <span aria-hidden className="text-subtle">
                    /
                  </span>
                </>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * O rótulo do atalho da busca. Começa em "Ctrl K" e só troca para "⌘ K" depois de montar: no SSR
 * não há `navigator`, e decidir no primeiro render faria o HTML do servidor e o do cliente
 * discordarem.
 */
function useRotuloDoAtalho(): string {
  const [ehMac, setEhMac] = useState(false);
  useEffect(() => {
    const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
    const plataforma = nav.userAgentData?.platform || nav.platform || "";
    setEhMac(/mac/i.test(plataforma));
  }, []);
  return ehMac ? "⌘ K" : "Ctrl K";
}

/** Sem acento e em minúsculas, para "precos" achar "Preços" e "visao" achar "Visão geral". */
function semAcento(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function BarraLateral({ aoBuscar }: { aoBuscar: () => void }) {
  const currentPath = useRouterState({ select: (r) => r.location.pathname });
  const ativo = destinoAtivo(currentPath);
  const atalho = useRotuloDoAtalho();

  return (
    <div className="flex h-full w-full min-w-0 flex-col">
      <div className="flex items-center gap-2.5 px-4 pt-4 pb-3">
        {/* O tile do wide-ui é o accent com iniciais; aqui o próprio logo já é magenta, então o
            tile é claro com o logo — magenta sobre magenta sumiria. */}
        <div className="border-line grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-[var(--wu-radius-sm)] border bg-white">
          <img src="/favicon.png" alt="" className="h-full w-full scale-125 object-cover" />
        </div>
        <div className="min-w-0">
          <div className="text-foreground truncate text-[13.5px] font-semibold">
            Painel de custos
          </div>
          <div className="text-subtle truncate text-xs">LLM e WhatsApp</div>
        </div>
      </div>

      <div className="px-3 pb-2">
        <button
          type="button"
          onClick={aoBuscar}
          className="border-line bg-raised text-subtle hover:bg-hover flex h-8 w-full items-center gap-2 rounded-[var(--wu-radius)] border px-2.5 text-[13px]"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="flex-1 truncate text-left">Buscar ou ir para...</span>
          <kbd className="border-line rounded border px-1 font-sans text-[11px] font-medium">
            {atalho}
          </kbd>
        </button>
      </div>

      <nav
        data-sidebar="content"
        aria-label="Principal"
        className="flex-1 overflow-y-auto px-3 pb-3"
      >
        {GRUPOS.map((grupo, i) => (
          <div
            key={grupo.rotulo ?? `grupo-${i}`}
            className={cn("pt-3", !grupo.rotulo && i > 0 && "border-line mt-3 border-t")}
          >
            {grupo.rotulo && (
              <div className="text-subtle px-2.5 pb-1.5 text-[11px] font-semibold tracking-[0.04em] uppercase">
                {grupo.rotulo}
              </div>
            )}
            <ul className="flex flex-col gap-0.5">
              {grupo.itens.map((item) => {
                const aceso = item.url === ativo;
                return (
                  <li key={item.url}>
                    <Link
                      to={item.url}
                      aria-current={aceso ? "page" : undefined}
                      className={cn(
                        "relative flex h-8 items-center gap-2.5 rounded-[var(--wu-radius-sm)] px-2.5 text-[13.5px] font-medium transition-colors",
                        aceso
                          ? "bg-sel text-foreground"
                          : "text-muted-foreground hover:bg-hover hover:text-foreground",
                      )}
                    >
                      {aceso && (
                        <span
                          aria-hidden
                          className="bg-brand absolute top-1.5 bottom-1.5 -left-3 w-[3px] rounded-r"
                        />
                      )}
                      <item.icon
                        className={cn("h-[18px] w-[18px] shrink-0", !aceso && "text-subtle")}
                      />
                      <span className="truncate">{item.title}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <Rodape />
    </div>
  );
}

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  const primeira = partes[0][0];
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : "";
  return (primeira + ultima).toUpperCase();
}

function Rodape() {
  const { theme, toggle } = useTheme();
  const { usuario, sair } = useSessao();

  return (
    <div className="border-line flex items-center gap-2.5 border-t px-3 py-3">
      <div className="bg-sel text-muted-foreground grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-semibold">
        {usuario ? iniciais(usuario.nome) : "?"}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-foreground truncate text-[13px] font-medium">{usuario?.nome}</div>
        <div className="text-subtle truncate text-xs">{usuario?.email}</div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={toggle}
        aria-label={theme === "dark" ? "Usar tema claro" : "Usar tema escuro"}
        title={theme === "dark" ? "Tema claro" : "Tema escuro"}
      >
        {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={() => void sair()}
        aria-label="Sair"
        title="Sair"
      >
        <LogOut className="h-4 w-4" />
      </Button>
    </div>
  );
}

/** "Buscar ou ir para...": os mesmos destinos da barra, por teclado. */
function BuscaDeComando({ aberta, aoMudar }: { aberta: boolean; aoMudar: (v: boolean) => void }) {
  const navigate = useNavigate();

  return (
    <Dialog open={aberta} onOpenChange={aoMudar}>
      <DialogContent className="top-[20%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-md [&>button:last-child]:hidden">
        <DialogTitle className="sr-only">Buscar ou ir para</DialogTitle>
        <DialogDescription className="sr-only">
          Digite o nome de uma página do painel
        </DialogDescription>
        <Command>
          <CommandInput placeholder="Buscar ou ir para..." className="h-11" />
          <CommandList className="max-h-[320px] p-1">
            <CommandEmpty>Nenhuma página com esse nome</CommandEmpty>
            {GRUPOS.map((grupo, i) => (
              <CommandGroup key={grupo.rotulo ?? `grupo-${i}`} heading={grupo.rotulo ?? undefined}>
                {grupo.itens.map((item) => {
                  const nome = grupo.rotulo ? `${grupo.rotulo} · ${item.title}` : item.title;
                  return (
                    <CommandItem
                      key={item.url}
                      value={nome}
                      keywords={[semAcento(nome)]}
                      onSelect={() => {
                        aoMudar(false);
                        navigate({ to: item.url });
                      }}
                      className="h-9"
                    >
                      <item.icon className="text-subtle" />
                      <span>{nome}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
