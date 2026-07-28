import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function ErrorBox({ error }: { error: unknown }) {
  const msg = error instanceof Error ? error.message : "Erro desconhecido";
  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Não foi possível carregar</AlertTitle>
      <AlertDescription className="font-mono text-xs">{msg}</AlertDescription>
    </Alert>
  );
}

/**
 * Vazio é um estado do instrumento, não uma falha: a agulha em zero. Por isso a moldura
 * tracejada mantém a altura da leitura que estaria ali, e o texto diz o que fazer em seguida.
 */
export function EmptyBox({
  message = "Nenhum evento neste período. Amplie as datas ou limpe os filtros.",
}: {
  message?: string;
}) {
  return (
    <div className="border-border flex flex-col items-center justify-center gap-2 rounded-sm border border-dashed px-6 py-10 text-center">
      <div className="etiqueta">Sem leitura</div>
      <p className="text-muted-foreground max-w-xs text-sm">{message}</p>
    </div>
  );
}
