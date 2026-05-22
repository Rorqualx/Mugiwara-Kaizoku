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

# Google Chrome + GUI libraries — required by the bundled FlareSolverr
# subprocess (flaresolverr-go) which the app downloads + manages itself
# at boot. The UI's "Cloudflare bypass" toggle controls autoStart.
# Using google-chrome-stable from Google's apt repo because Ubuntu 22.04's
# chromium-browser is a snap shim that doesn't work in containers.
# amd64-only — Google does not ship an arm64 Linux build.
RUN curl -fsSL https://dl.google.com/linux/linux_signing_key.pub | \
        gpg --dearmor > /etc/apt/trusted.gpg.d/google-chrome.gpg && \
    echo "deb [arch=amd64 signed-by=/etc/apt/trusted.gpg.d/google-chrome.gpg] https://dl.google.com/linux/chrome/deb/ stable main" \
        > /etc/apt/sources.list.d/google-chrome.list && \
    apt-get update && \
    apt-get install -y --no-install-recommends \
        google-chrome-stable \
        libglib2.0-0 \
        libnss3 \
        libatk1.0-0 \
        libatk-bridge2.0-0 \
        libcups2 \
        libdrm2 \
        libxcb1 \
        libxkbcommon0 \
        libxcomposite1 \
        libxdamage1 \
        libxfixes3 \
        libxrandr2 \
        libgbm1 \
        libpango-1.0-0 \
        libcairo2 \
        libasound2 && \
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
# Base stage uses the standard (AVX2) Bun for fast build-time work; the
# runner stage replaces this with bun-baseline so the runtime image runs
# on any x86_64 CPU (older Xeons, virtualized hosts without AVX2).
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

# Swap the AVX2 bun (inherited from `base`) for bun-baseline so the
# runtime image runs on any x86_64 CPU. Build-time bun stays untouched
# in the build/deps stages (they already produced their artifacts).
ARG BUN_VERSION=bun-v1.3.0
RUN curl -fsSL "https://github.com/oven-sh/bun/releases/download/${BUN_VERSION}/bun-linux-x64-baseline.zip" -o /tmp/bun-baseline.zip && \
    unzip -q -o /tmp/bun-baseline.zip -d /tmp && \
    install -m 0755 /tmp/bun-linux-x64-baseline/bun /usr/local/bin/bun && \
    ln -sf /usr/local/bin/bun /usr/local/bin/bunx && \
    rm -rf /tmp/bun-baseline.zip /tmp/bun-linux-x64-baseline

# Non-root app user (UID 1000). The entrypoint stays root to manage postgres,
# then drops to this user via gosu when launching the app. All persistent
# state lives under /config (single user-mounted directory). /library is
# the bind-mount path for the user's manga files.
RUN useradd -m -u 1000 app && \
    mkdir -p /config /library && \
    chown -R app:app /app /config /library

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
COPY --from=build --chown=app:app /app/packages ./packages
COPY --from=build --chown=app:app /app/src ./src

# Entrypoint runs as root so it can chown volume mounts and start postgres
# as the postgres user; the app process is launched via `gosu app` inside.

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    DOCKER=true \
    KAIZOKU_LOG_PATH=/config/logs \
    HOME=/config \
    PGDATA=/config/postgres \
    MANGA_FILES_DIR=/library

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD nc -z localhost ${KAIZOKU_PORT:-3000} || exit 1

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["bun", "src/server/index.ts"]
