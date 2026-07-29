import type { ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";

/**
 * O cartão de KPI: uma etiqueta, uma leitura grande e o que ela significa embaixo.
 *
 * Nasceu no consolidado e saiu de lá quando o painel de WhatsApp precisou dos mesmos quatro
 * cartões com outro vocabulário. É o irmão de `PainelCard` para número solto — lá a leitura é um
 * gráfico, aqui é uma quantia — e ter os dois num arquivo só quebraria o fast refresh do Vite.
 */
export function Cartao({
  rotulo,
  valor,
  nota,
  cor,
  destaque,
  carregando,
  children,
}: {
  rotulo: string;
  valor: string;
  nota?: string;
  /** Filete lateral na cor da série — a mesma que a leitura tem nos gráficos da tela. */
  cor?: string;
  destaque?: boolean;
  carregando?: boolean;
  /** Espaço para o que a nota não diz sozinha: uma fita de proporção, uma fração desenhada. */
  children?: ReactNode;
}) {
  return (
    <section
      className="bg-card flex flex-col justify-center gap-1.5 rounded-xl border p-5 shadow-sm"
      style={cor ? { borderLeftColor: cor, borderLeftWidth: 2 } : undefined}
    >
      <div className="etiqueta">{rotulo}</div>
      {carregando ? (
        <Skeleton className="h-8 w-32" />
      ) : (
        <div
          className={
            destaque
              ? "leitura text-custo overflow-hidden text-2xl leading-none text-ellipsis whitespace-nowrap sm:text-[1.75rem]"
              : "leitura overflow-hidden text-xl leading-none text-ellipsis whitespace-nowrap"
          }
        >
          {valor}
        </div>
      )}
      {!carregando && children}
      {nota && !carregando && <div className="text-muted-foreground text-xs">{nota}</div>}
      {nota && carregando && <Skeleton className="h-4 w-24" />}
    </section>
  );
}
