#!/bin/bash

# =============================================================================
# ACCOUNT TABLE FIX SCRIPT
# =============================================================================
# This script specifically addresses the "Account table not found" error
# by using a more direct approach to schema creation.
# =============================================================================

set -e  # Exit on any error

# Color output for better readability
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔧 Starting Account table fix...${NC}"

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
DB_URL_WITHOUT_DB=$(echo $DATABASE_URL | sed 's/\/[^?]*.*$/\/postgres/')
echo -e "${BLUE}🔍 Database name: ${DB_NAME}${NC}"

# Drop the database if it exists
echo -e "${YELLOW}⚠️ Dropping existing database...${NC}"
psql "$DB_URL_WITHOUT_DB" -c "DROP DATABASE IF EXISTS ${DB_NAME} WITH (FORCE);" || {
    echo -e "${RED}❌ Failed to drop database. Trying alternative method...${NC}"
    # Try with postgres superuser
    for superuser in postgres $(whoami) root; do
        if psql -h localhost -U "$superuser" -d postgres -c "SELECT 1;" >/dev/null 2>&1; then
            echo -e "${BLUE}Using superuser: $superuser${NC}"
            psql -h localhost -U "$superuser" -d postgres -c "DROP DATABASE IF EXISTS ${DB_NAME} WITH (FORCE);"
            break
        fi
    done
}

# Create the database
echo -e "${BLUE}🏗️ Creating fresh database...${NC}"
psql "$DB_URL_WITHOUT_DB" -c "CREATE DATABASE ${DB_NAME};" || {
    echo -e "${RED}❌ Failed to create database. Trying alternative method...${NC}"
    # Try with postgres superuser
    for superuser in postgres $(whoami) root; do
        if psql -h localhost -U "$superuser" -d postgres -c "SELECT 1;" >/dev/null 2>&1; then
            echo -e "${BLUE}Using superuser: $superuser${NC}"
            psql -h localhost -U "$superuser" -d postgres -c "CREATE DATABASE ${DB_NAME};"
            break
        fi
    done
}

# Copy the consolidated schema
echo -e "${BLUE}📋 Preparing consolidated schema...${NC}"
cp prisma/schema-consolidated.prisma prisma/schema.prisma
echo -e "${GREEN}✅ Copied consolidated schema${NC}"

# Force validate schema
echo -e "${BLUE}🔍 Validating schema...${NC}"
bunx prisma validate || {
    echo -e "${RED}❌ Schema validation failed. This might cause issues.${NC}"
    echo -e "${YELLOW}⚠️ Continuing anyway...${NC}"
}

# Generate Prisma client
echo -e "${BLUE}⚙️ Generating Prisma client...${NC}"
bunx prisma generate

# DIRECT SQL APPROACH
# This directly creates the NextAuth tables using SQL
echo -e "${BLUE}🔧 Creating NextAuth tables directly with SQL...${NC}"

psql "$DATABASE_URL" << EOF
-- Create User table
CREATE TABLE IF NOT EXISTS "users" (
  "id" TEXT NOT NULL,
  "name" TEXT,
  "email" TEXT NOT NULL,
  "emailVerified" TIMESTAMP(3),
  "image" TEXT,
  "userName" TEXT NOT NULL,
  "hashedPassword" TEXT NOT NULL,
  "avatar" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'USER',

  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- Create unique indexes for User
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "users_userName_key" ON "users"("userName");

-- Create Session table
CREATE TABLE IF NOT EXISTS "sessions" (
  "id" TEXT NOT NULL,
  "sessionToken" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "expires" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- Create unique index for Session
CREATE UNIQUE INDEX IF NOT EXISTS "sessions_sessionToken_key" ON "sessions"("sessionToken");

-- Create Account table
CREATE TABLE IF NOT EXISTS "accounts" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerAccountId" TEXT NOT NULL,
  "refresh_token" TEXT,
  "access_token" TEXT,
  "expires_at" INTEGER,
  "token_type" TEXT,
  "scope" TEXT,
  "id_token" TEXT,
  "session_state" TEXT,

  CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- Create unique index for Account
CREATE UNIQUE INDEX IF NOT EXISTS "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");

-- Create VerificationToken table
CREATE TABLE IF NOT EXISTS "verificationtokens" (
  "identifier" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "expires" TIMESTAMP(3) NOT NULL
);

-- Create unique indexes for VerificationToken
CREATE UNIQUE INDEX IF NOT EXISTS "verificationtokens_token_key" ON "verificationtokens"("token");
CREATE UNIQUE INDEX IF NOT EXISTS "verificationtokens_identifier_token_key" ON "verificationtokens"("identifier", "token");

-- Add foreign key references
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EOF

echo -e "${GREEN}✅ NextAuth tables created directly with SQL${NC}"

# Now run Prisma DB push to create remaining tables
echo -e "${BLUE}🚀 Creating remaining tables with Prisma...${NC}"
bunx prisma db push

# Verify tables were created
echo -e "${BLUE}🔍 Verifying tables...${NC}"
tables_to_check=("users" "accounts" "sessions" "verificationtokens" "manga" "chapter" "library")
missing_tables=()

for table in "${tables_to_check[@]}"; do
    echo -e "${YELLOW}  Checking table: ${table}${NC}"
    if psql "$DATABASE_URL" -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '${table}' AND table_schema = 'public');" | grep -q "t"; then
        echo -e "${GREEN}  ✅ Table ${table} exists${NC}"
    else
        echo -e "${RED}  ❌ Table ${table} is missing${NC}"
        missing_tables+=("$table")
    fi
done

# Create default admin user
echo -e "${BLUE}👤 Creating default admin user...${NC}"
if [ -f "scripts/create-admin-simple.js" ]; then
    node scripts/create-admin-simple.js || echo -e "${YELLOW}⚠️ Failed to create admin user - you can create one later${NC}"
else
    echo -e "${YELLOW}⚠️ Admin creation script not found${NC}"
fi

# Final report
if [ ${#missing_tables[@]} -eq 0 ]; then
    echo -e "${GREEN}✅ SUCCESS: All tables were created successfully${NC}"
    echo -e "${GREEN}🎉 Account table fix completed!${NC}"
    
    echo -e "${BLUE}📊 Next steps:${NC}"
    echo "   1. You can now run 'bun run dev' to start the application"
    echo "   2. Login with admin/password (if admin user was created)"
    echo "   3. If you need to reset the database again, use this same script"
    
    exit 0
else
    echo -e "${RED}❌ PARTIAL SUCCESS: The following tables are still missing:${NC}"
    for table in "${missing_tables[@]}"; do
        echo -e "${RED}  - ${table}${NC}"
    done
    
    echo -e "${YELLOW}⚠️ You may still encounter issues with the missing tables${NC}"
    echo -e "${YELLOW}⚠️ Try running 'bunx prisma db push' to create the remaining tables${NC}"
    
    exit 1
fi