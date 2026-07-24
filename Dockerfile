FROM node:22-slim AS base
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* ./
RUN pnpm install --frozen-lockfile || pnpm install

# Build
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Vite reads .env.production automatically during 'vite build'
# No Docker ARG needed — the key is in .env.production in the repo
RUN pnpm build

# Production
FROM base AS production
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json

# Railway assigns PORT dynamically
CMD ["node", "dist/index.js"]
