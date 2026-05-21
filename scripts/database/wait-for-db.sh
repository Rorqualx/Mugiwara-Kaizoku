#!/bin/bash
# =============================================================================
# WAIT FOR DATABASE SCRIPT
# =============================================================================
# This script waits for the database to be ready before starting the app
# It's used in Docker Compose to ensure database is up before app connects
# =============================================================================

set -e

host="$1"
shift
cmd="$@"

until PGPASSWORD=kaizoku psql -h "$host" -U "kaizoku" -d "kaizoku" -c '\q'; do
  >&2 echo "🔄 Postgres is unavailable - sleeping"
  sleep 1
done

>&2 echo "✅ Postgres is up - executing command"
exec $cmd