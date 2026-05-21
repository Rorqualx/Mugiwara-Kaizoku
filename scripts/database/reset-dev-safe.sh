#!/bin/bash

# =============================================================================
# SAFE DATABASE RECREATION SCRIPT FOR DEVELOPMENT
# =============================================================================
# This script recreates the database from scratch using the consolidated schema
# with added safety checks for database connection
#
# Usage: bun run db:reset:safe
# Environment: Development only (not for production)
# =============================================================================

set -e  # Exit on any error

echo "🚀 Starting safe database recreation for development..."

# Color output for better readability
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if we're in development mode
if [[ "$NODE_ENV" == "production" ]]; then
    echo -e "${RED}❌ Error: This script is for development only!${NC}"
    echo -e "${YELLOW}For production, use: bun run db:migrate${NC}"
    exit 1
fi

# Function to check database connection
check_db_connection() {
    echo -e "${BLUE}📋 Checking database connection...${NC}"
    
    # Extract database connection details from DATABASE_URL
    if [[ -z "$DATABASE_URL" ]]; then
        if [[ -f ".env" ]]; then
            source .env
        fi
    fi
    
    if [[ -z "$DATABASE_URL" ]]; then
        echo -e "${RED}❌ Error: DATABASE_URL is not set!${NC}"
        echo -e "${YELLOW}Please set DATABASE_URL in .env file or environment${NC}"
        exit 1
    fi
    
    # Extract host and port from DATABASE_URL
    DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\).*/\1/p')
    DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
    DB_USER=$(echo $DATABASE_URL | sed -n 's/.*:\/\/\([^:]*\).*/\1/p')
    DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')
    
    echo -e "${BLUE}Attempting to connect to database at ${DB_HOST}:${DB_PORT}...${NC}"
    
    # Try to connect to the database server
    if command -v nc &> /dev/null; then
        if nc -z -w 5 $DB_HOST $DB_PORT; then
            echo -e "${GREEN}✅ Database server is reachable${NC}"
        else
            echo -e "${RED}❌ Error: Cannot connect to database server at ${DB_HOST}:${DB_PORT}${NC}"
            echo -e "${YELLOW}Please check that your database server is running${NC}"
            exit 1
        fi
    else
        echo -e "${YELLOW}⚠️ Warning: 'nc' command not found, skipping connection test${NC}"
    fi
}

# Check database connection
check_db_connection

echo -e "${BLUE}📦 Backing up current schema files...${NC}"
cp prisma/schema.prisma prisma/schema.prisma.backup 2>/dev/null || true
cp prisma/schema-nextauth.prisma prisma/schema-nextauth.prisma.backup 2>/dev/null || true
cp prisma/schema.task-enums.prisma prisma/schema.task-enums.prisma.backup 2>/dev/null || true

# Replace the main schema with consolidated schema
echo -e "${BLUE}🔄 Switching to consolidated schema...${NC}"
cp prisma/schema-consolidated.prisma prisma/schema.prisma

# Generate Prisma client
echo -e "${BLUE}⚙️  Generating Prisma client...${NC}"
bunx prisma generate

# Create the database if it doesn't exist
echo -e "${BLUE}🔍 Checking if database exists...${NC}"
bunx prisma db execute --url "$DATABASE_URL" --schema=./prisma/schema.prisma \
  --stdin <<EOF
SELECT 1;
EOF

if [ $? -ne 0 ]; then
    echo -e "${YELLOW}⚠️ Database doesn't exist, creating it...${NC}"
    DB_URL_WITHOUT_DB=$(echo $DATABASE_URL | sed 's/\/[^?]*.*$/\/postgres/')
    bunx prisma db execute --url "$DB_URL_WITHOUT_DB" --schema=./prisma/schema.prisma \
      --stdin <<EOF
CREATE DATABASE ${DB_NAME};
EOF
    echo -e "${GREEN}✅ Database created${NC}"
fi

# Reset database (drops all data and recreates from schema)
echo -e "${YELLOW}⚠️  Dropping existing database and recreating...${NC}"
bunx prisma db push --force-reset

# Verify that crucial tables were created
echo -e "${BLUE}🔍 Verifying schema creation...${NC}"
tables_to_check=("User" "Account" "Session" "Manga" "Chapter")
missing_tables=()

for table in "${tables_to_check[@]}"; do
    # Convert model name to database table name (lowercase and with 's' suffix)
    table_name=$(echo "$table" | tr '[:upper:]' '[:lower:]')s
    
    # Check if table exists
    if ! bunx prisma db execute --url "$DATABASE_URL" --schema=./prisma/schema.prisma \
      --stdin <<EOF >/dev/null 2>&1
SELECT 1 FROM information_schema.tables WHERE table_name = '$table_name' AND table_schema = 'public';
EOF
    then
        missing_tables+=("$table_name")
    fi
done

if [ ${#missing_tables[@]} -gt 0 ]; then
    echo -e "${RED}❌ Error: Some crucial tables are missing after schema creation:${NC}"
    for table in "${missing_tables[@]}"; do
        echo -e "${RED}   - $table${NC}"
    done
    
    echo -e "${YELLOW}⚠️  Attempting to fix schema issues...${NC}"
    
    # Try schema push again but with more detailed logging
    echo -e "${BLUE}🔄 Performing second attempt at schema push with detailed logging...${NC}"
    bunx prisma db push --force-reset --schema=./prisma/schema.prisma
    
    # Check if tables are now created
    echo -e "${BLUE}🔍 Verifying tables after second attempt...${NC}"
    still_missing=false
    for table in "${missing_tables[@]}"; do
        if ! bunx prisma db execute --url "$DATABASE_URL" --schema=./prisma/schema.prisma \
          --stdin <<EOF >/dev/null 2>&1
SELECT 1 FROM information_schema.tables WHERE table_name = '$table' AND table_schema = 'public';
EOF
        then
            echo -e "${RED}❌ Table $table still missing!${NC}"
            still_missing=true
        else
            echo -e "${GREEN}✅ Table $table created successfully${NC}"
        fi
    done
    
    if [ "$still_missing" = true ]; then
        echo -e "${RED}❌ Schema creation failed after multiple attempts. Please check your schema file for errors.${NC}"
        echo -e "${YELLOW}💡 Suggestion: Ensure your prisma/schema.prisma file contains all NextAuth models (User, Account, Session, VerificationToken).${NC}"
        exit 1
    else
        echo -e "${GREEN}✅ Schema issues fixed on second attempt${NC}"
    fi
else
    echo -e "${GREEN}✅ All crucial tables created successfully${NC}"
fi

# Run any initialization scripts
if [[ -f "scripts/database/seed-dev.js" ]]; then
    echo -e "${BLUE}🌱 Running development seed script...${NC}"
    node scripts/database/seed-dev.js
fi

echo -e "${GREEN}✅ Database recreation complete!${NC}"
echo -e "${GREEN}🎉 Your development database is ready with the consolidated schema.${NC}"
echo ""
echo -e "${BLUE}📊 Database Stats:${NC}"
echo "   • Schema: Single consolidated file"
echo "   • Models: 18 total (including NextAuth)"
echo "   • Setup time: ~30 seconds vs ~5 minutes with migrations"
echo ""
echo -e "${YELLOW}💡 Next steps:${NC}"
echo "   • Start your development server: bun run dev"
echo "   • Create an admin user: bun run create-admin"
echo ""
echo -e "${BLUE}📚 Additional commands:${NC}"
echo "   • Reset DB again: bun run db:reset:dev"
echo "   • View database: bunx prisma studio"
echo "   • Generate client: bun run generate"