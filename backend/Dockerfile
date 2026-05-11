# Imagem de produção do API (evita falhas intermitentes do Nixpacks/apt em alguns hosts).
# Coolify: Base Directory = /backend (ou raiz do repo se o serviço apontar só para backend),
# Build Pack = Dockerfile, Dockerfile = backend/Dockerfile (conforme UI).
#
# Não defina NODE_ENV=production durante `npm ci` (senão o Prisma em devDependencies não instala).
FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
# postinstall = prisma generate — precisa do schema antes de `npm ci`
COPY prisma ./prisma
RUN npm ci

COPY src ./src

ENV NODE_ENV=production
ENV PORT=3011

EXPOSE 3011

CMD ["node", "src/index.js"]
