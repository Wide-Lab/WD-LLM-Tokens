import { Link, useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Compass, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Cartão central das páginas de 404 e de falha, no estado "vazio/erro" do wide-ui: tile de 48px
 * com o ícone, título, uma linha de porquê e a ação que resolve.
 *
 * Duas formas, pelo lugar onde cai. Dentro da moldura (`embutida`) ele ocupa o `main` sem fundo
 * próprio e sem altura de tela — o topo de 52px já está em cima, e um bloco de 100vh embaixo dele
 * só criaria rolagem. Fora dela (falha na própria raiz, quando nem a moldura existe) ele ocupa a
 * tela inteira com o fundo da página.
 */
function PaginaDeEstado({
  icone,
  tom,
  titulo,
  descricao,
  embutida,
  children,
}: {
  icone: ReactNode;
  tom: "neutro" | "erro";
  titulo: string;
  descricao: string;
  embutida: boolean;
  children: ReactNode;
}) {
  return (
    <div
      role={tom === "erro" ? "alert" : undefined}
      className={cn(
        "flex items-center justify-center",
        embutida ? "py-16" : "bg-background min-h-screen px-4",
      )}
    >
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

/**
 * O 404 de qualquer rota. Cai sempre dentro da moldura: caminho desconhecido marca o não
 * encontrado na raiz, que o desenha no próprio `<Outlet>` — e sem sessão o porteiro manda para o
 * login antes de chegar aqui.
 */
export function PaginaNaoEncontrada() {
  return (
    <PaginaDeEstado
      embutida
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

function PaginaDeErro({ error, reset, embutida }: ErrorComponentProps & { embutida: boolean }) {
  const router = useRouter();

  // A mensagem crua vai para o console, não para a tela: quem lê a tela precisa saber o que
  // fazer, não o stack. No efeito, e não no corpo, para não repetir a cada render.
  useEffect(() => console.error(error), [error]);

  return (
    <PaginaDeEstado
      embutida={embutida}
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

/**
 * Falha numa rota filha (`defaultErrorComponent` do roteador): sai no `<Outlet>` da raiz, dentro
 * da moldura, e a barra segue de pé para a pessoa ir a outro lugar.
 */
export function ErroNaRota(props: ErrorComponentProps) {
  return <PaginaDeErro {...props} embutida />;
}

/** Falha na própria raiz: a moldura não chegou a existir, então a página ocupa a tela. */
export function ErroNaRaiz(props: ErrorComponentProps) {
  return <PaginaDeErro {...props} embutida={false} />;
}
