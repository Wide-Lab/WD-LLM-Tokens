import { AlertCircle, Inbox } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function ErrorBox({ error }: { error: unknown }) {
  const msg = error instanceof Error ? error.message : "Erro desconhecido";
  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Falha ao carregar</AlertTitle>
      <AlertDescription>{msg}</AlertDescription>
    </Alert>
  );
}

export function EmptyBox({ message = "Nenhum dado no período selecionado." }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
      <Inbox className="h-6 w-6" />
      <span>{message}</span>
    </div>
  );
}
