import type { ReactNode } from "react";

/**
 * O cabeçalho de página do wide-ui: título 22/600 (19 abaixo de 700px) e subtítulo 13 `muted` à
 * esquerda, ações à direita — que descem para baixo do título quando falta largura. No máximo um
 * botão primário entre as ações. O título quebra em qualquer ponto porque às vezes é um id (o ator
 * em `/llm/eventos/$ator`), e um id sem espaço empurraria a página para o lado a 390px.
 */
export function CabecalhoDaPagina({
  titulo,
  subtitulo,
  acoes,
}: {
  titulo: string;
  subtitulo?: ReactNode;
  acoes?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
      <div className="min-w-0">
        <h1 className="text-foreground text-[19px] leading-tight font-semibold tracking-[-0.01em] [overflow-wrap:anywhere] min-[700px]:text-[22px]">
          {titulo}
        </h1>
        {subtitulo && <p className="text-muted-foreground mt-1 text-[13px]">{subtitulo}</p>}
      </div>
      {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
    </header>
  );
}
