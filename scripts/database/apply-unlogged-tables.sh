#!/bin/bash
set -e

# Apply UNLOGGED cache tables migration
# This script ensures UNLOGGED tables exist after prisma db push
# which drops them since they're not tracked in schema.prisma

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }

# Migration files to apply (in order - WebSocket depends on sessions_cache from redis-like)
REDIS_MIGRATION="prisma/migrations/20250925_redis_like_optimization/migration.sql"
WEBSOCKET_MIGRATION="prisma/migrations/20251108_websocket_distributed_infrastructure/migration.sql"

# Get database credentials from environment or use defaults
DB_HOST="${PGHOST:-localhost}"
DB_PORT="${PGPORT:-5432}"
DB_USER="${PGUSER:-kaizoku}"
DB_NAME="${PGDATABASE:-kaizoku}"
DB_PASSWORD="${PGPASSWORD:-kaizoku}"

apply_migration() {
    local migration_file="$1"
    local migration_name="$2"

    if [ ! -f "$migration_file" ]; then
        log_warning "$migration_name migration not found at: $migration_file"
        return 1
    fi

    log_info "Applying $migration_name..."

    if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$migration_file" > /dev/null 2>&1; then
        log_success "$migration_name applied successfully"
        return 0
    else
        log_warning "Failed to apply $migration_name (may already exist)"
        return 1
    fi
}

log_info "Applying UNLOGGED cache tables migrations..."

# Apply Redis-like cache tables first (includes sessions_cache required by WebSocket)
apply_migration "$REDIS_MIGRATION" "Redis-like cache tables"

# Apply WebSocket distributed infrastructure tables (depends on sessions_cache)
apply_migration "$WEBSOCKET_MIGRATION" "WebSocket distributed infrastructure"

log_success "UNLOGGED tables migration complete"
log_info "Tables created: cache_unified, sessions_cache, hot_data_cache, jobs_volatile,"
log_info "               websocket_connections, websocket_servers, channel_subscriptions,"
log_info "               rate_limits, presence_tracking, message_routing"
