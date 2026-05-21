# Mugiwara-Kaizoku Dockerfile
#
# Single-container image with bundled PostgreSQL. FlareSolverr is NOT
# bundled (yet — Phase C); run `ghcr.io/flaresolverr/flaresolverr:latest`
# as a sidecar if you need Cloudflare bypass.
#
# Stages:
#   base   — Ubuntu 22.04 + system deps + PostgreSQL 15 + Java 21 + Bun
#   deps   — `bun install --frozen-lockfile`
#   build  — Prisma client + `next build`
#   runner — Slim final image; entrypoint runs as root, drops to `app`

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
        ffmpeg \
        dos2unix \
        unzip \
        gosu \
        openssl && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# PostgreSQL 15 — bundled DB server + client. Postgres-15 isn't in the
# Ubuntu 22.04 default repos, so we add the official PGDG repo first.
# The postgres process runs as the `postgres` system user; the entrypoint
# orchestrates init + startup.
RUN install -d /usr/share/postgresql-common/pgdg && \
    curl -fsSL -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
        https://www.postgresql.org/media/keys/ACCC4CF8.asc && \
    echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt jammy-pgdg main" \
        > /etc/apt/sources.list.d/pgdg.list && \
    apt-get update && \
    apt-get install -y --no-install-recommends \
        postgresql-15 \
        postgresql-client-15 && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*
ENV PATH="/usr/lib/postgresql/15/bin:${PATH}"

# Adoptium Temurin Java 21 — required by the bundled Suwayomi engine
RUN wget -qO - https://packages.adoptium.net/artifactory/api/gpg/key/public | gpg --dearmor > /etc/apt/trusted.gpg.d/adoptium.gpg && \
    echo "deb https://packages.adoptium.net/artifactory/deb jammy main" > /etc/apt/sources.list.d/adoptium.list && \
    apt-get update && \
    apt-get install -y --no-install-recommends temurin-21-jre && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Bun runtime + package manager — installed globally to /usr/local so all
# users (including the unprivileged `app` user) can execute it.
RUN curl -fsSL https://bun.sh/install -o /tmp/bun-install.sh && \
    BUN_INSTALL=/usr/local bash /tmp/bun-install.sh && \
    rm /tmp/bun-install.sh && \
    chmod 755 /usr/local/bin/bun /usr/local/bin/bunx

###############################################################################
# Dependencies stage
###############################################################################
FROM base AS deps
WORKDIR /app

COPY package.json bun.lock ./
COPY prisma ./prisma/
# Workspace packages (mangadex-ts-client is referenced as workspace:* in package.json)
COPY packages ./packages

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

# Non-root app user (UID 1000). The entrypoint stays root to manage postgres,
# then drops to this user via gosu when launching the app.
RUN useradd -m -u 1000 app && \
    mkdir -p /logs /config /data /data/postgres && \
    chown -R app:app /app /logs /config && \
    chown -R postgres:postgres /data/postgres && \
    chown app:app /data

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

# Entrypoint runs as root so it can chown volume mounts and start postgres
# as the postgres user; the app process is launched via `gosu app` inside.

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    DOCKER=true \
    KAIZOKU_LOG_PATH=/logs \
    HOME=/config \
    PGDATA=/data/postgres

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD nc -z localhost ${KAIZOKU_PORT:-3000} || exit 1

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["bun", "src/server/index.ts"]
