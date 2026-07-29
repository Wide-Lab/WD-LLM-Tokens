/**
 * O texto cru de um evento, dentro da linha expandida de uma tabela.
 *
 * A borda esquerda colorida é o mesmo idioma da `Conversa`: a cor diz **de quem é a fala** antes de
 * o título ser lido. No LLM ela carrega o balde (entrada é o que o ator mandou, saída é o que o
 * agente devolveu); no WhatsApp, a direção — e são as mesmas duas cores de propósito, porque é a
 * mesma pergunta nas duas origens.
 */
export function Conteudo({
  titulo,
  texto,
  cor,
}: {
  titulo: string;
  texto: string | null;
  cor: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="etiqueta">{titulo}</div>
      {texto ? (
        // `whitespace-pre-wrap` porque prompt e resposta vêm com quebra de linha, e a altura é
        // limitada para uma resposta longa não empurrar a tabela inteira para fora da tela.
        <div
          className="bg-card max-h-64 overflow-y-auto rounded-sm border border-l-2 p-3 text-sm break-words whitespace-pre-wrap"
          style={{ borderLeftColor: cor }}
        >
          {texto}
        </div>
      ) : (
        <div className="text-muted-foreground rounded-sm border border-dashed p-3 text-sm">
          Não informado
        </div>
      )}
    </div>
  );
}
