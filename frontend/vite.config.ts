import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ command }) => ({
  plugins: [
    tailwindcss(),
    // Resolve o alias `@/*` a partir do tsconfig — uma fonte só para o caminho.
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      // Redireciona a entrada de servidor do TanStack Start para src/server.ts,
      // nosso wrapper de erro do SSR. O nitro constrói a partir dela.
      server: { entry: "server" },
    }),
    // O nitro só entra no build: é ele que empacota o `.output/server` que o container roda.
    // `node-server` é o alvo daqui; `NITRO_PRESET` ainda sobrescreve se um dia precisar de outro.
    ...(command === "build" ? [nitro({ defaultPreset: "node-server" })] : []),
    viteReact(),
  ],
  resolve: {
    // Uma cópia só de cada um: React duplicado quebra os hooks, e QueryClient
    // duplicado faz o cache do painel virar dois caches que não se enxergam.
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },
  server: {
    port: 8080,
    // Em produção quem faz isto é o nginx de borda; no `vite dev` não há nginx, e sem o proxy
    // o painel chamaria `/api` no próprio dev server e levaria 404. Mesma origem também é o
    // que permite ao browser guardar o cookie de sessão durante o desenvolvimento.
    proxy: { "/api": "http://localhost:8000" },
  },
}));
