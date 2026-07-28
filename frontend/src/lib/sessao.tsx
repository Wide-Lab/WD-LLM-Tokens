import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, type ReactNode } from "react";

import { ApiError, apiDelete, apiGet, apiPost } from "./api";

export interface Usuario {
  id: string;
  email: string;
  nome: string;
  ativo: boolean;
  criado_em: string;
}

interface SessaoContextValue {
  usuario: Usuario | null;
  carregando: boolean;
  entrar: (email: string, senha: string) => Promise<void>;
  sair: () => Promise<void>;
}

const SessaoContext = createContext<SessaoContextValue | null>(null);

export const SESSAO_QUERY_KEY = ["sessao"] as const;

export function SessaoProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const sessao = useQuery({
    queryKey: SESSAO_QUERY_KEY,
    queryFn: async (): Promise<Usuario | null> => {
      try {
        return await apiGet<Usuario>("/v1/sessao");
      } catch (e) {
        // `401` aqui não é falha: é a resposta "ninguém logado", que leva à tela de login.
        // Deixar estourar transformaria o estado normal de visitante num erro de tela.
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
    retry: false,
    staleTime: 5 * 60_000,
  });

  const entrar = async (email: string, senha: string) => {
    const usuario = await apiPost<Usuario>("/v1/sessao", { email, senha });
    queryClient.setQueryData(SESSAO_QUERY_KEY, usuario);
  };

  const sair = async () => {
    try {
      await apiDelete<null>("/v1/sessao");
    } finally {
      // `clear()` porque as outras queries guardam métricas e eventos: sem isto, o próximo
      // login veria por um instante os dados de quem saiu.
      queryClient.clear();
      queryClient.setQueryData(SESSAO_QUERY_KEY, null);
    }
  };

  return (
    <SessaoContext.Provider
      value={{
        usuario: sessao.data ?? null,
        carregando: sessao.isPending,
        entrar,
        sair,
      }}
    >
      {children}
    </SessaoContext.Provider>
  );
}

export function useSessao() {
  const ctx = useContext(SessaoContext);
  if (!ctx) throw new Error("useSessao must be inside SessaoProvider");
  return ctx;
}
