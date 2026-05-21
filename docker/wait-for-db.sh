#!/bin/sh
# Script to wait for PostgreSQL to be ready
# This is the consolidated version used across the project

set -e

host="${1:-localhost}"
port="${2:-5432}"
shift 2 2>/dev/null || true

# First try using pg_isready if available (better approach)
if command -v pg_isready > /dev/null 2>&1; then
  echo "Waiting for PostgreSQL at $host:$port using pg_isready..."
  
  for i in $(seq 1 30); do
    if pg_isready -h "$host" -p "$port" > /dev/null 2>&1; then
      echo "PostgreSQL is ready!"
      exec "$@"
    fi
    echo -n "."
    sleep 1
  done
  
  echo ""
  echo "Error: PostgreSQL did not become ready within 30 seconds"
  exit 1
else
  # Fallback to nc if pg_isready is not available
  echo "Waiting for PostgreSQL at $host:$port using nc..."
  
  until nc -z -v -w30 "$host" "$port"; do
    echo "Waiting for database connection..."
    sleep 1
  done
  
  echo "Database is up and running!"
  exec "$@"
fi
