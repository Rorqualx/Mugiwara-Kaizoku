#!/bin/bash

# =============================================================================
# DATABASE AUTO-REPAIR SCRIPT
# =============================================================================
# This script detects database schema errors and automatically repairs them
# by recreating the database with the latest schema.
# 
# It can be triggered:
# 1. Directly by the user
# 2. Automatically via error detection in other scripts
# 3. As part of the build process
# =============================================================================

set -e  # Exit on any error

# Color output for better readability
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔄 Starting Database Auto-Repair${NC}"

# Function to extract error details from error message
extract_error_details() {
    local error_message="$1"
    local table_pattern="table .* does not exist"
    local column_pattern="column .* does not exist"
    
    if [[ $error_message =~ $table_pattern ]]; then
        # Extract table name
        local table_name=$(echo "$error_message" | sed -n 's/.*table "\([^"]*\)" does not exist.*/\1/p')
        if [ -z "$table_name" ]; then
            table_name=$(echo "$error_message" | sed -n 's/.*table \([^ ]*\) does not exist.*/\1/p')
        fi
        echo "table:$table_name"
    elif [[ $error_message =~ $column_pattern ]]; then
        # Extract column and table name
        local column_name=$(echo "$error_message" | sed -n 's/.*column "\([^"]*\)" does not exist.*/\1/p')
        local table_name=$(echo "$error_message" | sed -n 's/.*of relation "\([^"]*\)".*/\1/p')
        if [ -z "$column_name" ]; then
            column_name=$(echo "$error_message" | sed -n 's/.*column \([^ ]*\) does not exist.*/\1/p')
        fi
        echo "column:$column_name:$table_name"
    else
        echo "unknown"
    fi
}

# Function to check schema for entity
verify_schema_entity() {
    local entity_type="$1"
    local entity_name="$2"
    local table_name="$3"
    
    echo -e "${BLUE}🔍 Verifying $entity_type '$entity_name' in schema...${NC}"
    
    if [ "$entity_type" = "table" ]; then
        # Check if model exists in schema
        local model_pattern="model [A-Za-z]+ {"
        local models=$(grep -E "$model_pattern" prisma/schema.prisma | sed 's/model \([^ ]*\) {/\1/')
        
        # Try to match table name to model (accounting for pluralization)
        local found=false
        for model in $models; do
            # Convert model name to lowercase
            local model_lower=$(echo "$model" | tr '[:upper:]' '[:lower:]')
            
            # Check singular and plural forms
            if [ "$model_lower" = "$entity_name" ] || [ "${model_lower}s" = "$entity_name" ]; then
                found=true
                echo -e "${GREEN}✅ Found matching model: $model${NC}"
                break
            fi
        done
        
        if [ "$found" = false ]; then
            echo -e "${RED}❌ No matching model found for table: $entity_name${NC}"
            return 1
        fi
    elif [ "$entity_type" = "column" ]; then
        # Find the model corresponding to the table
        local model_pattern="model [A-Za-z]+ {"
        local models=$(grep -E "$model_pattern" prisma/schema.prisma | sed 's/model \([^ ]*\) {/\1/')
        
        # Try to match table name to model
        local target_model=""
        for model in $models; do
            # Convert model name to lowercase
            local model_lower=$(echo "$model" | tr '[:upper:]' '[:lower:]')
            
            # Check singular and plural forms
            if [ "$model_lower" = "$table_name" ] || [ "${model_lower}s" = "$table_name" ]; then
                target_model="$model"
                break
            fi
        done
        
        if [ -z "$target_model" ]; then
            echo -e "${RED}❌ No matching model found for table: $table_name${NC}"
            return 1
        fi
        
        # Now check if the field exists in the model
        local model_start=$(grep -n "model $target_model {" prisma/schema.prisma | cut -d':' -f1)
        local next_model=$(tail -n +$((model_start+1)) prisma/schema.prisma | grep -n "model " | head -1 | cut -d':' -f1)
        
        if [ -z "$next_model" ]; then
            next_model=$(wc -l < prisma/schema.prisma)
        else
            next_model=$((model_start + next_model))
        fi
        
        local model_content=$(sed -n "${model_start},${next_model}p" prisma/schema.prisma)
        
        # Check if field exists
        if echo "$model_content" | grep -q "$entity_name"; then
            echo -e "${GREEN}✅ Found field '$entity_name' in model: $target_model${NC}"
        else
            echo -e "${RED}❌ Field '$entity_name' not found in model: $target_model${NC}"
            return 1
        fi
    fi
    
    return 0
}

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

# Check if error message was provided
ERROR_MESSAGE=""
FORCE_REPAIR=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        --error)
            ERROR_MESSAGE="$2"
            shift 2
            ;;
        --force)
            FORCE_REPAIR=true
            shift
            ;;
        *)
            echo -e "${RED}❌ Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

# If no error message is provided, check if we should force repair
if [ -z "$ERROR_MESSAGE" ] && [ "$FORCE_REPAIR" = true ]; then
    echo -e "${YELLOW}⚠️ Forced repair requested${NC}"
    
    # Ensure we have a consolidated schema
    if [ ! -f "prisma/schema-consolidated.prisma" ]; then
        echo -e "${RED}❌ No consolidated schema found! Cannot perform repair.${NC}"
        exit 1
    fi
    
    # Copy consolidated schema
    echo -e "${BLUE}📋 Using consolidated schema...${NC}"
    cp prisma/schema-consolidated.prisma prisma/schema.prisma
    
    # Recreate the database
    echo -e "${YELLOW}⚠️ Recreating database with latest schema...${NC}"
    
    # Drop the database if it exists
    echo -e "${BLUE}🗑️ Dropping database ${DB_NAME} if it exists...${NC}"
    psql "$DB_URL_WITHOUT_DB" -c "DROP DATABASE IF EXISTS ${DB_NAME} WITH (FORCE);" || {
        echo -e "${YELLOW}⚠️ Could not drop database. Trying alternative method...${NC}"
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
        echo -e "${YELLOW}⚠️ Could not create database. Trying alternative method...${NC}"
        for superuser in postgres $(whoami) root; do
            if psql -h localhost -U "$superuser" -d postgres -c "SELECT 1;" >/dev/null 2>&1; then
                echo -e "${BLUE}Using superuser: $superuser${NC}"
                psql -h localhost -U "$superuser" -d postgres -c "CREATE DATABASE ${DB_NAME};"
                break
            fi
        done
    }
    
    # Run the fix-account-table.sh script if it exists
    if [ -f "scripts/database/fix-account-table.sh" ]; then
        echo -e "${BLUE}🔧 Running Account table fix script...${NC}"
        bash scripts/database/fix-account-table.sh
        exit_code=$?
        if [ $exit_code -ne 0 ]; then
            echo -e "${RED}❌ Account table fix script failed with exit code $exit_code${NC}"
            echo -e "${YELLOW}⚠️ Trying alternative repair method...${NC}"
        else
            echo -e "${GREEN}✅ Database repaired successfully${NC}"
            exit 0
        fi
    fi
    
    # Direct SQL approach for NextAuth tables
    echo -e "${BLUE}🔧 Creating NextAuth tables with direct SQL...${NC}"
    bunx prisma db execute --stdin <<EOF
-- Set schema to public
SET search_path TO public;

-- Create User table
CREATE TABLE IF NOT EXISTS public."users" (
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
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON public."users"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "users_userName_key" ON public."users"("userName");

-- Create Session table
CREATE TABLE IF NOT EXISTS public."sessions" (
  "id" TEXT NOT NULL,
  "sessionToken" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "expires" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- Create unique index for Session
CREATE UNIQUE INDEX IF NOT EXISTS "sessions_sessionToken_key" ON public."sessions"("sessionToken");

-- Create Account table
CREATE TABLE IF NOT EXISTS public."accounts" (
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
CREATE UNIQUE INDEX IF NOT EXISTS "accounts_provider_providerAccountId_key" ON public."accounts"("provider", "providerAccountId");

-- Create VerificationToken table
CREATE TABLE IF NOT EXISTS public."verificationtokens" (
  "identifier" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "expires" TIMESTAMP(3) NOT NULL
);

-- Create unique indexes for VerificationToken
CREATE UNIQUE INDEX IF NOT EXISTS "verificationtokens_token_key" ON public."verificationtokens"("token");
CREATE UNIQUE INDEX IF NOT EXISTS "verificationtokens_identifier_token_key" ON public."verificationtokens"("identifier", "token");

-- Add foreign key references
ALTER TABLE public."sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE public."accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EOF
    
    echo -e "${GREEN}✅ NextAuth tables created successfully${NC}"
    
    # Now create remaining tables with Prisma push
    echo -e "${BLUE}🔧 Creating remaining tables with Prisma...${NC}"
    bunx prisma db push
    
    echo -e "${GREEN}✅ Database repaired successfully${NC}"
    exit 0
fi

# If we have an error message, analyze it
if [ -n "$ERROR_MESSAGE" ]; then
    echo -e "${BLUE}🔍 Analyzing error message: ${NC}"
    echo -e "${YELLOW}$ERROR_MESSAGE${NC}"
    
    # Extract error details
    ERROR_DETAILS=$(extract_error_details "$ERROR_MESSAGE")
    echo -e "${BLUE}🔍 Extracted error details: $ERROR_DETAILS${NC}"
    
    # Check if we could extract meaningful details
    if [ "$ERROR_DETAILS" = "unknown" ]; then
        echo -e "${YELLOW}⚠️ Could not identify specific error type. Performing full repair...${NC}"
        # Trigger full repair
        exec "$0" --force
        exit 0
    fi
    
    # Check if we need to update the schema
    ENTITY_TYPE=$(echo "$ERROR_DETAILS" | cut -d':' -f1)
    ENTITY_NAME=$(echo "$ERROR_DETAILS" | cut -d':' -f2)
    TABLE_NAME=$(echo "$ERROR_DETAILS" | cut -d':' -f3)
    
    # Verify if entity exists in schema
    if ! verify_schema_entity "$ENTITY_TYPE" "$ENTITY_NAME" "$TABLE_NAME"; then
        echo -e "${RED}❌ The $ENTITY_TYPE '$ENTITY_NAME' was not found in the schema!${NC}"
        echo -e "${YELLOW}⚠️ This could indicate a schema definition issue or missing model/field.${NC}"
        echo -e "${YELLOW}⚠️ Please check your schema.prisma file and update it if needed.${NC}"
        exit 1
    fi
    
    # If we get here, the entity exists in schema but not in database
    echo -e "${GREEN}✅ The $ENTITY_TYPE '$ENTITY_NAME' exists in the schema but not in the database.${NC}"
    echo -e "${BLUE}🔄 Triggering database recreation to sync with schema...${NC}"
    
    # Trigger full repair
    exec "$0" --force
    exit 0
fi

echo -e "${YELLOW}⚠️ No error message provided. Use --error \"error message\" or --force to trigger repair${NC}"
echo -e "${YELLOW}⚠️ Example: ./scripts/database/auto-repair.sh --error \"table \\\"Account\\\" does not exist\"${NC}"
exit 1