import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Eye, EyeOff, Gauge, Loader2 } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ApiError } from "@/lib/api";
import { useSessao } from "@/lib/sessao";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar — Painel LLM" },
      { name: "description", content: "Acesso ao painel de uso de tokens." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Login,
});

function Login() {
  const { entrar } = useSessao();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // O redirecionamento para `/` depois do login é do porteiro no `__root`, que já observa a
  // sessão — repetir a navegação aqui daria dois `navigate` na mesma transição.
  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setErro(null);
    try {
      await entrar(email.trim(), senha);
    } catch (e) {
      setErro(e instanceof ApiError || e instanceof Error ? e.message : "Não foi possível entrar.");
      setEnviando(false);
    }
  };

  return (
    <div className="bg-background flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="w-full max-w-sm overflow-hidden">
        {/* A fita dos quatro baldes fecha a borda de cima: a mesma assinatura que abre o painel
            do outro lado da porta. */}
        <div className="flex h-1 w-full" aria-hidden="true">
          <span className="bg-balde-entrada flex-1" />
          <span className="bg-balde-saida flex-1" />
          <span className="bg-balde-cache-leitura flex-1" />
          <span className="bg-balde-cache-escrita flex-1" />
        </div>
        <CardContent className="p-6 pt-6">
          <div className="bg-primary text-primary-foreground grid h-10 w-10 place-items-center rounded-md">
            <Gauge className="h-5 w-5" />
          </div>
          <h1 className="mt-4 text-xl font-semibold tracking-tight">Painel LLM</h1>
          <p className="text-muted-foreground mt-1 mb-6 text-sm">
            Entre para ver quanto cada aplicação consumiu e quanto isso custou.
          </p>

          <form onSubmit={enviar} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="etiqueta">
                E-mail
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                autoFocus
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="senha" className="etiqueta">
                Senha
              </Label>
              <div className="relative">
                <Input
                  id="senha"
                  type={mostrarSenha ? "text" : "password"}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  autoComplete="current-password"
                  className="pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                  aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                >
                  {mostrarSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {erro && (
              <Alert variant="destructive">
                <AlertDescription>{erro}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="w-full" disabled={enviando}>
              {enviando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Entrar
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
