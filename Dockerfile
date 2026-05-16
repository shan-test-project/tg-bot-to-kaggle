FROM node:24-alpine AS base
RUN npm install -g pnpm@latest
WORKDIR /app

# ── Install dependencies ──────────────────────────────────────────────────────
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY artifacts/api-server/package.json ./artifacts/api-server/
COPY artifacts/kaggle-dashboard/package.json ./artifacts/kaggle-dashboard/
COPY lib/api-spec/package.json ./lib/api-spec/
COPY lib/api-client-react/package.json ./lib/api-client-react/
COPY lib/api-zod/package.json ./lib/api-zod/
COPY lib/db/package.json ./lib/db/
COPY scripts/package.json ./scripts/
RUN pnpm install --frozen-lockfile --ignore-scripts

# ── Build frontend ────────────────────────────────────────────────────────────
FROM deps AS build-frontend
COPY . .
ENV PORT=3000
ENV BASE_PATH=/
ENV NODE_ENV=production
RUN pnpm --filter @workspace/kaggle-dashboard run build

# ── Build API server ──────────────────────────────────────────────────────────
FROM deps AS build-api
COPY . .
ENV NODE_ENV=production
RUN pnpm --filter @workspace/api-server run build

# ── Final runtime image ───────────────────────────────────────────────────────
FROM node:24-alpine AS runner
RUN npm install -g pnpm@latest
WORKDIR /app

# Copy built API server
COPY --from=build-api /app/artifacts/api-server/dist ./artifacts/api-server/dist

# Copy built frontend (served as static files by API server)
COPY --from=build-frontend /app/artifacts/kaggle-dashboard/dist/public ./artifacts/kaggle-dashboard/dist/public

# Copy only production deps for api-server
COPY --from=build-api /app/node_modules ./node_modules
COPY --from=build-api /app/package.json ./package.json

# Persistent settings directory — mount a volume here in production
RUN mkdir -p /app/data && chmod 777 /app/data

EXPOSE 8080
ENV PORT=8080
ENV NODE_ENV=production
ENV DATA_DIR=/app/data

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://localhost:8080/api/healthz || exit 1

CMD ["node", "--enable-source-maps", "artifacts/api-server/dist/index.mjs"]
