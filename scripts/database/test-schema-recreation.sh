#!/bin/bash

# =============================================================================
# SCHEMA RECREATION TEST SCRIPT
# =============================================================================
# This script tests if the schema recreation process works correctly
# It focuses specifically on the Account table issue
# =============================================================================

set -e  # Exit on any error

# Color output for better readability
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔍 Starting schema recreation test...${NC}"

# Verify environment
if [ -z "$DATABASE_URL" ]; then
    if [ -f ".env" ]; then
        echo -e "${YELLOW}ℹ️ Loading environment from .env file${NC}"
        source .env
    else
        echo -e "${RED}❌ Error: DATABASE_URL not set and no .env file found${NC}"
        exit 1
    fi
fi

echo -e "${BLUE}🔄 Using database URL: ${DATABASE_URL}${NC}"

# Step 1: Drop the current database to start fresh
echo -e "${YELLOW}⚠️ Dropping existing database...${NC}"
DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')
DB_URL_WITHOUT_DB=$(echo $DATABASE_URL | sed 's/\/[^?]*.*$/\/postgres/')

# Drop the database if it exists
echo -e "${BLUE}🗑️ Dropping database ${DB_NAME} if it exists...${NC}"
bunx prisma db execute --url "$DB_URL_WITHOUT_DB" --stdin <<EOF
DROP DATABASE IF EXISTS ${DB_NAME} WITH (FORCE);
EOF

# Recreate the database
echo -e "${BLUE}🏗️ Creating fresh database ${DB_NAME}...${NC}"
bunx prisma db execute --url "$DB_URL_WITHOUT_DB" --stdin <<EOF
CREATE DATABASE ${DB_NAME};
EOF

# Step 2: Copy the consolidated schema
echo -e "${BLUE}📋 Using consolidated schema...${NC}"
cp prisma/schema-consolidated.prisma prisma/schema.prisma

# Step 3: Generate the Prisma client
echo -e "${BLUE}⚙️ Generating Prisma client...${NC}"
bunx prisma generate

# Step 4: Create the database schema using the schema push approach
echo -e "${BLUE}🚀 Creating database schema...${NC}"
bunx prisma db push

# Step 5: Verify that all tables are created, especially the Account table
echo -e "${BLUE}🔍 Verifying tables...${NC}"
tables_to_check=("users" "accounts" "sessions" "verificationtokens" "manga" "chapter" "metadata")
missing_tables=()

for table in "${tables_to_check[@]}"; do
    echo -e "${YELLOW}  Checking table: ${table}${NC}"
    if bunx prisma db execute --stdin <<EOF | grep -q "1 row"
    SELECT 1 FROM information_schema.tables WHERE table_name = '${table}' AND table_schema = 'public';
EOF
    then
        echo -e "${GREEN}  ✅ Table ${table} exists${NC}"
    else
        echo -e "${RED}  ❌ Table ${table} is missing${NC}"
        missing_tables+=("$table")
    fi
done

# Report test results
if [ ${#missing_tables[@]} -eq 0 ]; then
    echo -e "${GREEN}✅ SUCCESS: All tables were created successfully${NC}"
    echo -e "${GREEN}🎉 Schema recreation test passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ FAILURE: The following tables are missing:${NC}"
    for table in "${missing_tables[@]}"; do
        echo -e "${RED}  - ${table}${NC}"
    done
    echo -e "${RED}❌ Schema recreation test failed!${NC}"
    exit 1
fi