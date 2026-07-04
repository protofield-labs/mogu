# syntax=docker/dockerfile:1

# --- deps: install dependencies with pnpm ---
FROM node:24.18.0-slim AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.9.0 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# --- build: compile the Next.js app (standalone output) ---
FROM node:24.18.0-slim AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.9.0 --activate
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# --- runner: minimal runtime image ---
FROM node:24.18.0-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
# Bind to all interfaces so Cloud Run health checks and traffic reach the app.
ENV HOSTNAME=0.0.0.0

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=build /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
