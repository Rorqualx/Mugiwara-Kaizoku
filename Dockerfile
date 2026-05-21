# Kaizoku Multi-Stage Dockerfile
#
# This Dockerfile uses a multi-stage build process to create an optimized
# production image for the Kaizoku manga management application.
#
# Stages:
# 1. Base: Common dependencies and system setup
# 2. Dependencies: Node.js package installation
# 3. Build: Application compilation
# 4. Runner: Final production image
#
# Features:
# - Multi-stage optimization
# - Dependency caching
# - Security considerations
# - Health monitoring
# - User permissions

# syntax = docker/dockerfile:experimental

### BASE STAGE ###
# Sets up common dependencies and system configuration
FROM ghcr.io/linuxserver/baseimage-ubuntu:jammy AS base

# Install Node.js and system dependencies
# - Node.js for running the application
# - Python for FlareSolverr subprocess
# - Chromium for FlareSolverr browser automation
# - System libraries for browser support
# - FFmpeg for audiobook format conversion
# - Utility packages for operations
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get update && \
    apt-get install -y --no-install-recommends \
        nodejs \
        postgresql-client \
        python3 \
        python3-pip \
        python3-venv \
        chromium-browser \
        ffmpeg \
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
        libasound2 \
        dos2unix \
        netcat \
        software-properties-common \
        wget \
        gnupg && \
    # Add Adoptium repository for Java 21
    wget -qO - https://packages.adoptium.net/artifactory/api/gpg/key/public | gpg --dearmor | tee /etc/apt/trusted.gpg.d/adoptium.gpg > /dev/null && \
    echo "deb https://packages.adoptium.net/artifactory/deb jammy main" | tee /etc/apt/sources.list.d/adoptium.list && \
    apt-get update && \
    apt-get install -y temurin-21-jre && \
    npm install -g pnpm@7.33.7 typescript ts-node && \
    # Install FlareSolverr for Cloudflare bypass subprocess
    # NOTE: PyPI flaresolverr is maxed at v3.3.21 - using GitHub source for v3.3.25
    # v3.4.x requires Python 3.10+ which isn't available in Ubuntu Jammy base image
    # For latest version, use sidecar container: ghcr.io/flaresolverr/flaresolverr:latest
    pip3 install --no-cache-dir flaresolverr && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN getent group abc || groupadd -r abc && \
    getent passwd abc || useradd -r -g abc abc

# Copy utility scripts
COPY scripts/wait-for-db.sh /usr/local/bin/wait-for-db.sh
COPY scripts/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/wait-for-db.sh /usr/local/bin/docker-entrypoint.sh && \
    dos2unix /usr/local/bin/wait-for-db.sh /usr/local/bin/docker-entrypoint.sh

### DEPENDENCIES STAGE ###
# Installs and caches Node.js dependencies
FROM base AS deps
WORKDIR /app

# Copy package files and install dependencies
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma/

# Build arguments for environment configuration
ARG NODE_ENV=production
ARG DATABASE_URL

# Set environment variables for build
ENV NODE_ENV=${NODE_ENV}
ENV DATABASE_URL=${DATABASE_URL}

# Install dependencies with pnpm, using cache mount
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --force

### BUILD STAGE ###
# Compiles the application and generates necessary assets
FROM base AS build
WORKDIR /app

# Copy dependencies and source code
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma
COPY . .
COPY moduleResolver.mjs ./

# Set build environment variables
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV NODE_PATH=./node_modules
ENV PATH="/app/node_modules/.bin:${PATH}"

# Generate Prisma client and build Next.js application
RUN npx prisma generate && \
    npx next build && \
    DOCKER=true pnpm install-suwayomi || true

### RUNNER STAGE ###
# Final production image with minimal footprint
FROM base AS runner
WORKDIR /app

# Set runtime environment variables
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    DATABASE_URL="${DATABASE_URL:-postgresql://kaizoku:kaizoku@db:5432/kaizoku}" \
    KAIZOKU_LOG_PATH="/logs" \
    HOME="/config" \
    DOCKER="true"

# Create necessary directories with proper permissions
RUN mkdir -p /logs /config /data /data/Media/Downloads

# Install Bun runtime for unified server execution
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:${PATH}"

# Copy built application from build stage
COPY --from=build /app/next.config.mjs ./
COPY --from=build /app/public ./public
COPY --from=build /app/package.json ./
COPY --from=build /app/tsconfig.json ./
COPY --from=build /app/.next ./.next
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/src ./src
COPY --from=build /app/data/suwayomi-server /data/suwayomi-server

# Set up permissions for non-root user
RUN chown -R abc:abc /app /logs /config /data /data/Media/Downloads

# Create Next.js pages symlink if needed
RUN mkdir -p /app/pages && \
    ln -s /app/src/pages/* /app/pages/ 2>/dev/null || true && \
    chown -R abc:abc /app/pages

# Switch to non-root user for security
USER abc

# Configure health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD nc -z localhost ${KAIZOKU_PORT:-3000} || exit 1

# Set entrypoint for database readiness check
ENTRYPOINT ["/usr/local/bin/wait-for-db.sh", "db"]

# Start unified server (all services + WebSocket)
CMD ["bun", "src/server/index.ts"]
