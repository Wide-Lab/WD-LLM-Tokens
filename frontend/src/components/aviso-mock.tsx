import type { ReactNode } from "react";

/**
 * O aviso de que a aba é uma maquete.
 *
 * Fica no topo da tela e escrito, não num rodapé: uma tela com botão de salvar e número em dinheiro
 * é lida como produção por padrão, e nas abas que usam este aviso nada disso saiu do banco. Cada
 * tela escreve o próprio texto porque o que é falso muda de uma para outra — o que não muda é o
 * lugar e a forma. Some da tela no dia em que a rota dela existir, junto com o mock que a alimenta.
 */
export function AvisoDeMock({ children }: { children: ReactNode }) {
  return (
    <div className="border-border rounded-sm border border-dashed px-4 py-3">
      <div className="etiqueta">Dados de exemplo</div>
      <p className="text-muted-foreground mt-1.5 text-sm">{children}</p>
    </div>
  );
}
