# Build from the monorepo root (required when the host has no Base Directory option):
#   podman build -f backend/Dockerfile -t platform-api:latest .
# Ownkube: Dockerfile path backend/Dockerfile (build context = repo root).
#
# WORKDIR is /srv/backend (not /app) so a platform volume mounted at /app
# cannot hide the image files (symptoms: Cannot find module '/app/server.js').

# Stage 1: Build native modules (better-sqlite3 needs make/g++/python3)
FROM node:20-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    g++ \
    make \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /srv/backend
COPY backend/package*.json ./
RUN npm install --omit=dev

# Stage 2: Production image — only runtime deps, no compilers
FROM node:20-slim

# git is needed at runtime by evaluation worker (clones student repos)
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

WORKDIR /srv/backend

# Copy pre-built node_modules from builder (includes compiled better-sqlite3)
COPY --from=builder /srv/backend/node_modules ./node_modules
COPY backend/ .

RUN mkdir -p temp uploads/logos logs && chmod 755 temp uploads/logos logs \
  && test -f /srv/backend/server.js

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "const port = process.env.PORT || 5000; require('http').get('http://localhost:' + port + '/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)}).on('error', () => process.exit(1))" || exit 1

CMD ["node", "/srv/backend/server.js"]
