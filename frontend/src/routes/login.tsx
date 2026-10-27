import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ApiError } from "@/lib/api";
import { useSessao } from "@/lib/sessao";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar — Painel de custos" },
      { name: "description", content: "Acesso ao painel de custos de LLM e WhatsApp." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Login,
});

/**
 * O que a tela diz quando o login falha. Só as recusas do backend (credencial errada, sessão,
 * excesso de tentativas) chegam com a mensagem dele, que já vem em pt-BR e diz o que fazer. Rede
 * fora (`status` 0) e 5xx trazem texto técnico — "Falha de rede: Failed to fetch", "Erro 502" — e
 * viram uma frase que a pessoa entende; a mensagem crua vai para o console.
 */
function mensagemDeFalha(e: unknown): string {
  if (e instanceof ApiError && [400, 401, 403, 429].includes(e.status)) return e.message;
  console.error(e);
  if (e instanceof ApiError && (e.status === 0 || e.status >= 500)) {
    return "Não foi possível falar com o servidor. Tente de novo em instantes.";
  }
  return "Não foi possível entrar. Confira o e-mail e a senha e tente de novo.";
}

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
      setErro(mensagemDeFalha(e));
      setEnviando(false);
    }
  };

  return (
    <div className="bg-background flex min-h-screen items-center justify-center px-4 py-10">
      <div className="border-line bg-surface shadow-card w-full max-w-sm rounded-[var(--wu-radius)] border p-6 min-[700px]:p-8">
        <div className="border-line grid h-10 w-10 place-items-center overflow-hidden rounded-[var(--wu-radius)] border bg-white">
          <img src="/favicon.png" alt="" className="h-full w-full scale-125 object-cover" />
        </div>
        <h1 className="text-foreground mt-4 text-[19px] font-semibold">
          Entrar no painel de custos
        </h1>
        <p className="text-muted-foreground mt-1 mb-6 text-[13px]">
          Veja quanto cada aplicação consumiu de LLM e WhatsApp e quanto isso custou.
        </p>

        <form onSubmit={enviar} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              placeholder="nome@empresa.com.br"
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
                className="text-subtle hover:bg-hover hover:text-foreground absolute top-1/2 right-1.5 -translate-y-1/2 rounded-[var(--wu-radius-sm)] p-1.5"
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
      </div>
    </div>
  );
}
