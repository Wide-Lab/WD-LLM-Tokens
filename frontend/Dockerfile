FROM oven/bun:1-debian AS deps

WORKDIR /app

COPY package.json bun.lock bunfig.toml ./
RUN bun install --frozen-lockfile

FROM oven/bun:1-debian AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# O `@lovable.dev/vite-tanstack-config` roda o nitro com preset `cloudflare-module` por padrão —
# um Worker, que não sobe em container. `NITRO_PRESET` é justamente o override que a auto-detecção
# do nitro respeita, então o alvo muda aqui **sem tocar no `vite.config.ts`**: o build da Lovable
# continua saindo Cloudflare, e só o daqui sai node.
ENV NITRO_PRESET=node-server
RUN bun run build

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production \
    PORT=3000

WORKDIR /app

# A imagem node já traz o usuário não-root `node` (UID 1000); reusamos ele.
COPY --from=builder --chown=node:node /app/.output ./.output

USER node

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
