import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * O botão que abre o texto de uma linha de log (chamada do LLM, mensagem do WhatsApp). A linha
 * inteira também abre, mas uma `<tr>` com `onClick` não é focável: o botão é o caminho do teclado
 * e do leitor de tela, e segura o próprio clique para a linha não alternar duas vezes.
 *
 * `comRotulo` é a forma do cartão (abaixo de 700px), em que o ícone sozinho não diz o que abre.
 */
export function BotaoDeConteudo({
  aberto,
  onClick,
  comRotulo,
}: {
  aberto: boolean;
  onClick: () => void;
  comRotulo?: boolean;
}) {
  return (
    <Button
      variant="ghost"
      size={comRotulo ? "sm" : "icon"}
      className={comRotulo ? "-ml-2 h-7 px-2" : "h-8 w-8"}
      onClick={(e) => {
        // Para aqui, e não na célula: o resto da célula continua abrindo a linha.
        e.stopPropagation();
        onClick();
      }}
      aria-expanded={aberto}
      aria-label={aberto ? "Ocultar conteúdo" : "Ver conteúdo"}
    >
      <ChevronDown className={cn("h-4 w-4 transition-transform", aberto && "rotate-180")} />
      {comRotulo && (aberto ? "Ocultar conteúdo" : "Ver conteúdo")}
    </Button>
  );
}
