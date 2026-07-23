import { Link } from "@tanstack/react-router";
import { AlertCircle, Settings2, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function NeedsConfig() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6">
      <div className="max-w-md rounded-xl border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
          <Settings2 className="h-6 w-6" />
        </div>
        <h2 className="mt-4 text-lg font-semibold">Configure a API</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Informe a URL da API e a chave para começar a visualizar suas métricas
          de uso de tokens.
        </p>
        <Button asChild className="mt-4">
          <Link to="/configuracoes">Ir para Configurações</Link>
        </Button>
      </div>
    </div>
  );
}

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
