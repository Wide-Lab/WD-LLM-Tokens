import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Eye, EyeOff, Loader2, Sparkles } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="mx-auto grid h-11 w-11 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="h-6 w-6" />
          </div>
          <CardTitle className="mt-3">Painel LLM</CardTitle>
          <CardDescription>Entre para ver o uso e os custos.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={enviar} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
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
              <Label htmlFor="senha">Senha</Label>
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
