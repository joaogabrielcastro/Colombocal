# Coolify: Base Directory = frontend, Build Pack = Dockerfile, Dockerfile = Dockerfile
# Build args opcionais (Coolify → Build Arguments): NEXT_PUBLIC_API_ORIGIN, NEXT_PUBLIC_REQUIRE_LOGIN, …
#
# Não use NODE_ENV=production antes de `npm ci` (Tailwind/TS ficam em devDependencies).

FROM node:22-bookworm-slim AS base
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_API_ORIGIN
ARG NEXT_PUBLIC_REQUIRE_LOGIN
ARG NEXT_PUBLIC_UI_HIDE_ADVANCED
ENV NEXT_PUBLIC_API_ORIGIN=$NEXT_PUBLIC_API_ORIGIN
ENV NEXT_PUBLIC_REQUIRE_LOGIN=$NEXT_PUBLIC_REQUIRE_LOGIN
ENV NEXT_PUBLIC_UI_HIDE_ADVANCED=$NEXT_PUBLIC_UI_HIDE_ADVANCED

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3010
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3010
CMD ["node", "server.js"]
