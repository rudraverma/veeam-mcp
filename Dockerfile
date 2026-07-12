# CyberHawk Veeam MCP — container image
# Build:  docker build -t cyberhawk-veeam-mcp .
# Run:    docker run --rm -i --env-file .env cyberhawk-veeam-mcp

# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json tsconfig.json esbuild.config.js ./
RUN npm install
COPY src/ ./src/
RUN npm run build

# ── Runtime stage ────────────────────────────────────────────────────────────
FROM node:22-alpine
WORKDIR /app

COPY --from=builder /app/build ./build
COPY package*.json ./
RUN npm install --omit=dev && \
    addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup && \
    chown -R appuser:appgroup /app
USER appuser

ENV NODE_ENV=production

# MCP speaks JSON-RPC over stdio.
ENTRYPOINT ["node", "build/index.js"]
