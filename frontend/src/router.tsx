import { QueryCache, QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { ApiError } from "./lib/api";
import { SESSAO_QUERY_KEY } from "./lib/sessao";

export const getRouter = () => {
  // Sessão que vence no meio do uso volta como `401` em qualquer query — métricas, eventos,
  // filtros. Zerar a sessão aqui, num lugar só, faz o porteiro do `__root` mandar para o login;
  // sem isto cada tela precisaria tratar o próprio `401`.
  const queryCache = new QueryCache({
    onError: (error) => {
      if (error instanceof ApiError && error.status === 401) {
        queryClient.setQueryData(SESSAO_QUERY_KEY, null);
      }
    },
  });

  const queryClient = new QueryClient({
    queryCache,
    defaultOptions: { queries: { retry: false } },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
