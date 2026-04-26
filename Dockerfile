FROM node:22-slim AS base
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile || pnpm install

# Build
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Vite inlines VITE_* env vars at build time, so we need them as build args.
# Railway passes all service env vars as Docker build args automatically.
ARG VITE_CLERK_PUBLISHABLE_KEY
ENV VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY

# Build client (Vite) and server (esbuild)
RUN pnpm build

# Production
FROM base AS production
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json

# Railway assigns PORT dynamically — don't hardcode EXPOSE
CMD ["node", "dist/index.js"]
