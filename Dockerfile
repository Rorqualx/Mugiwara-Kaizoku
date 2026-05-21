# Mugiwara-Kaizoku Dockerfile
#
# Clean multi-stage Bun-based build. FlareSolverr is NOT bundled — run
# `ghcr.io/flaresolverr/flaresolverr:latest` as a sidecar container if you
# need Cloudflare bypass (see docker-compose.yml).
#
# Stages:
#   base   — Ubuntu 22.04 + system deps + Java 21 (Suwayomi) + Bun
#   deps   — `bun install --frozen-lockfile`
#   build  — Prisma client + `next build`
#   runner — Slim final image, non-root user

# syntax=docker/dockerfile:1.7

###############################################################################
# Base stage
###############################################################################
FROM ubuntu:22.04 AS base

ENV DEBIAN_FRONTEND=noninteractive \
    LANG=C.UTF-8

# Core system dependencies (small layer, rarely changes)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        curl \
        ca-certificates \
        gnupg \
        wget \
        netcat \
        postgresql-client \
        ffmpeg \
        dos2unix \
        unzip && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Adoptium Temurin Java 21 — required by the bundled Suwayomi engine
RUN wget -qO - https://packages.adoptium.net/artifactory/api/gpg/key/public | gpg --dearmor > /etc/apt/trusted.gpg.d/adoptium.gpg && \
    echo "deb https://packages.adoptium.net/artifactory/deb jammy main" > /etc/apt/sources.list.d/adoptium.list && \
    apt-get update && \
    apt-get install -y --no-install-recommends temurin-21-jre && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Bun runtime + package manager
RUN curl -fsSL https://bun.sh/install | bash && \
    ln -sf /root/.bun/bin/bun /usr/local/bin/bun && \
    ln -sf /root/.bun/bin/bunx /usr/local/bin/bunx
ENV PATH="/root/.bun/bin:${PATH}"

###############################################################################
# Dependencies stage
###############################################################################
FROM base AS deps
WORKDIR /app

COPY package.json bun.lock ./
COPY prisma ./prisma/

RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile

###############################################################################
# Build stage
###############################################################################
FROM base AS build
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production

RUN bun run generate && bun run build

###############################################################################
# Runner stage
###############################################################################
FROM base AS runner
WORKDIR /app

# Non-root app user
RUN useradd -m -u 1000 app && \
    mkdir -p /logs /config /data && \
    chown -R app:app /app /logs /config /data

# Entrypoint + helper scripts
COPY scripts/database/wait-for-db.sh /usr/local/bin/wait-for-db.sh
COPY scripts/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/wait-for-db.sh /usr/local/bin/docker-entrypoint.sh && \
    dos2unix /usr/local/bin/wait-for-db.sh /usr/local/bin/docker-entrypoint.sh

# Application artifacts from the build stage (owned by app user)
COPY --from=build --chown=app:app /app/next.config.mjs ./
COPY --from=build --chown=app:app /app/public ./public
COPY --from=build --chown=app:app /app/package.json ./
COPY --from=build --chown=app:app /app/tsconfig.json ./
COPY --from=build --chown=app:app /app/.next ./.next
COPY --from=build --chown=app:app /app/prisma ./prisma
COPY --from=build --chown=app:app /app/prisma.config.ts ./prisma.config.ts
COPY --from=build --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/src ./src

USER app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    DOCKER=true \
    KAIZOKU_LOG_PATH=/logs \
    HOME=/config

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD nc -z localhost ${KAIZOKU_PORT:-3000} || exit 1

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["bun", "src/server/index.ts"]
