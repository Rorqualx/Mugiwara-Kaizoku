#!/bin/bash

# =============================================================================
# POSTGRES PERMISSIONS FIX SCRIPT
# =============================================================================
# This script fixes permission issues with PostgreSQL for the Kaizoku application
# It grants necessary permissions to the user specified in DATABASE_URL
# =============================================================================

set -e  # Exit on any error

# Color output for better readability
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔄 Starting PostgreSQL Permissions Fix${NC}"

# Load environment variables
if [ -f ".env" ]; then
    source .env
    echo -e "${GREEN}✅ Loaded environment from .env file${NC}"
else
    echo -e "${RED}❌ No .env file found. Creating basic one...${NC}"
    cat > .env << EOF
DATABASE_URL=postgresql://kaizoku:kaizoku@localhost:5432/kaizoku
AUTH_SECRET=developmentsecret123
NEXTAUTH_SECRET=developmentsecret123
AUTH_URL=http://localhost:3000
NEXTAUTH_URL=http://localhost:3000
NODE_ENV=development
NEXT_TELEMETRY_DISABLED=1
EOF
    source .env
    echo -e "${GREEN}✅ Created and loaded basic .env file${NC}"
fi

# Extract database connection info
DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')
DB_USER=$(echo $DATABASE_URL | sed -n 's/.*:\/\/\([^:]*\).*/\1/p')
DB_URL_WITHOUT_DB=$(echo $DATABASE_URL | sed 's/\/[^?]*.*$/\/postgres/')

echo -e "${BLUE}📊 Database Information:${NC}"
echo -e "${BLUE}📊 Database Name: ${GREEN}$DB_NAME${NC}"
echo -e "${BLUE}📊 Database User: ${GREEN}$DB_USER${NC}"

# Function to run SQL as superuser
run_as_superuser() {
    local sql=$1
    local db=${2:-postgres}
    
    for superuser in postgres $(whoami) root; do
        echo -e "${BLUE}🔑 Trying with superuser: $superuser${NC}"
        if psql -h localhost -U "$superuser" -d "$db" -c "SELECT 1;" >/dev/null 2>&1; then
            echo -e "${GREEN}✅ Connected as superuser: $superuser${NC}"
            if psql -h localhost -U "$superuser" -d "$db" -c "$sql"; then
                return 0
            fi
            return 1
        fi
    done
    
    return 1
}

# Fix database permissions
echo -e "${BLUE}🔧 Fixing database permissions...${NC}"

# 1. Create database if it doesn't exist
echo -e "${BLUE}🔧 Ensuring database exists...${NC}"
run_as_superuser "CREATE DATABASE $DB_NAME WITH OWNER = $DB_USER;" || {
    echo -e "${YELLOW}⚠️ Database may already exist, continuing...${NC}"
}

# 2. Ensure user exists and has password
echo -e "${BLUE}🔧 Ensuring user exists...${NC}"
run_as_superuser "DO \$\$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '$DB_USER') THEN
        CREATE USER $DB_USER WITH PASSWORD 'kaizoku';
    END IF;
END
\$\$;" || {
    echo -e "${RED}❌ Failed to ensure user exists${NC}"
    exit 1
}

# 3. Grant proper permissions
echo -e "${BLUE}🔧 Granting permissions...${NC}"
# Grant connect privilege
run_as_superuser "GRANT CONNECT ON DATABASE $DB_NAME TO $DB_USER;"

# Connect to the database for the rest of the commands
echo -e "${BLUE}🔧 Connecting to database $DB_NAME...${NC}"

# Grant schema privileges
run_as_superuser "GRANT ALL ON SCHEMA public TO $DB_USER;" "$DB_NAME"

# Grant table privileges (for existing tables)
run_as_superuser "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO $DB_USER;" "$DB_NAME"
run_as_superuser "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO $DB_USER;" "$DB_NAME"
run_as_superuser "GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO $DB_USER;" "$DB_NAME"

# Set default privileges for future tables
run_as_superuser "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO $DB_USER;" "$DB_NAME"
run_as_superuser "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO $DB_USER;" "$DB_NAME"
run_as_superuser "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON FUNCTIONS TO $DB_USER;" "$DB_NAME" || {
    echo -e "${RED}❌ Failed to grant permissions${NC}"
    exit 1
}

echo -e "${GREEN}✅ PostgreSQL permissions fixed successfully${NC}"
echo -e "${BLUE}ℹ️ Try running your build or dev command again now${NC}"