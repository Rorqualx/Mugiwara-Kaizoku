#!/bin/bash

# Check application setting from database
# Usage: check-db-setting.sh <setting-key>

SETTING_KEY=$1

if [ -z "$SETTING_KEY" ]; then
    echo "false"
    exit 0
fi

# Extract database connection info from DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
    # Try to load from .env if not in environment
    if [ -f .env ]; then
        export $(cat .env | grep DATABASE_URL | xargs)
    fi
fi

if [ -z "$DATABASE_URL" ]; then
    echo "false"
    exit 0
fi

# Parse DATABASE_URL
# Format: postgresql://username:password@host:port/database
DB_USER=$(echo $DATABASE_URL | sed -n 's/.*\/\/\([^:]*\):.*/\1/p')
DB_PASS=$(echo $DATABASE_URL | sed -n 's/.*\/\/[^:]*:\([^@]*\)@.*/\1/p')
DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')

# Default to localhost and standard port if not specified
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}

# Query the database for the setting
RESULT=$(PGPASSWORD=$DB_PASS psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "SELECT value FROM settings WHERE key = '$SETTING_KEY' LIMIT 1;" 2>/dev/null | tr -d ' \n')

# If no result or error, return false
if [ -z "$RESULT" ]; then
    echo "false"
else
    echo "$RESULT"
fi
