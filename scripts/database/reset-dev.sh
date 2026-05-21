#!/bin/bash

# =============================================================================
# DATABASE RECREATION SCRIPT FOR DEVELOPMENT
# =============================================================================
# This script recreates the database from scratch using the consolidated schema
# instead of running migrations. Perfect for development environments.
#
# Usage: bun run db:reset:dev
# Environment: Development only (not for production)
# =============================================================================

set -e  # Exit on any error

echo "🚀 Starting database recreation for development..."

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

echo -e "${BLUE}📋 Checking environment...${NC}"

# Backup the current schema files
echo -e "${BLUE}📦 Backing up current schema files...${NC}"
cp prisma/schema.prisma prisma/schema.prisma.backup 2>/dev/null || true
cp prisma/schema-nextauth.prisma prisma/schema-nextauth.prisma.backup 2>/dev/null || true
cp prisma/schema.task-enums.prisma prisma/schema.task-enums.prisma.backup 2>/dev/null || true

# Replace the main schema with consolidated schema
echo -e "${BLUE}🔄 Switching to consolidated schema...${NC}"
cp prisma/schema-consolidated.prisma prisma/schema.prisma

# Validate schema first
echo -e "${BLUE}🔍 Validating schema...${NC}"
if ! bunx prisma validate; then
    echo -e "${RED}❌ Schema validation failed!${NC}"
    echo -e "${YELLOW}⚠️ Please check your schema for errors.${NC}"
    exit 1
fi

# Check for NextAuth models in schema
echo -e "${BLUE}🔍 Checking for NextAuth models...${NC}"
missing_models=()
for model in "Account" "Session" "User" "VerificationToken"; do
    if ! grep -q "model $model {" prisma/schema.prisma; then
        missing_models+=("$model")
    fi
done

if [ ${#missing_models[@]} -gt 0 ]; then
    echo -e "${RED}❌ Warning: Missing NextAuth models in schema:${NC}"
    for model in "${missing_models[@]}"; do
        echo -e "${RED}   - $model${NC}"
    done
    echo -e "${YELLOW}⚠️ This will likely cause the 'Account table not found' error!${NC}"
    
    echo -e "${BLUE}🔄 Attempting to fix by adding NextAuth schema...${NC}"
    if [ -f "prisma/schema-nextauth.prisma" ]; then
        # Create a temp file with combined schema
        cat prisma/schema.prisma > prisma/temp-schema.prisma
        echo "" >> prisma/temp-schema.prisma
        echo "// NextAuth models added automatically" >> prisma/temp-schema.prisma
        grep -A 100 "model User {" prisma/schema-nextauth.prisma >> prisma/temp-schema.prisma
        
        # Replace the schema with the combined version
        mv prisma/temp-schema.prisma prisma/schema.prisma
        echo -e "${GREEN}✅ NextAuth models added to schema${NC}"
    else
        echo -e "${RED}❌ Could not find schema-nextauth.prisma to fix the issue${NC}"
        echo -e "${YELLOW}⚠️ Consider using db:reset:safe instead${NC}"
    fi
fi

# Generate Prisma client
echo -e "${BLUE}⚙️  Generating Prisma client...${NC}"
bunx prisma generate

# Reset database (drops all data and recreates from schema)
echo -e "${YELLOW}⚠️  Dropping existing database and recreating...${NC}"

# Use direct SQL approach for NextAuth tables
echo -e "${BLUE}🚀 Using direct SQL approach for NextAuth tables (more reliable)${NC}"

# Clean database with force reset but no schema creation yet
bunx prisma db push --force-reset --accept-data-loss

# Create NextAuth tables directly with SQL
echo -e "${BLUE}🔧 Creating NextAuth tables with direct SQL...${NC}"
bunx prisma db execute --stdin <<EOF
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

echo -e "${GREEN}✅ NextAuth tables created successfully${NC}"

# Now create remaining tables with Prisma push
echo -e "${BLUE}🔧 Creating remaining tables with Prisma...${NC}"
bunx prisma db push

# Verify crucial tables were created
echo -e "${BLUE}🔍 Verifying crucial tables...${NC}"
crucial_tables=("accounts" "users" "sessions" "manga" "chapter" "library")
missing_tables=false

for table in "${crucial_tables[@]}"; do
    if ! bunx prisma db execute --stdin <<EOF >/dev/null 2>&1
SELECT 1 FROM information_schema.tables WHERE table_name = '$table' AND table_schema = 'public';
EOF
    then
        echo -e "${RED}❌ Missing table: $table${NC}"
        missing_tables=true
    fi
done

if [ "$missing_tables" = true ]; then
    echo -e "${YELLOW}⚠️ Some crucial tables are still missing. Try:${NC}"
    echo -e "${YELLOW}   bun run db:fix-account${NC}"
    echo -e "${YELLOW}   For a more comprehensive fix with additional verification${NC}"
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
