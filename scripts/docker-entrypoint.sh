#!/bin/bash
# =============================================================================
# DOCKER ENTRYPOINT SCRIPT
# =============================================================================
# This script runs inside the Docker container as the entrypoint
# It handles database setup and application startup
# =============================================================================

set -e  # Exit on any error

# Color output for better readability
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🐳 Starting Kaizoku in Docker container${NC}"

# Check environment
if [[ "$NODE_ENV" == "production" ]]; then
  echo -e "${YELLOW}Production mode detected - using migration-based setup${NC}"
  
  # In production, use the migration-based approach
  echo -e "${BLUE}🔄 Running migrations...${NC}"
  bunx prisma migrate deploy
  
  # Start the unified server (all services + WebSocket)
  echo -e "${GREEN}✅ Database setup complete. Starting application...${NC}"
  exec bun src/server/index.ts
else
  echo -e "${YELLOW}Development mode detected - using schema recreation${NC}"
  
  # In development, use the schema recreation approach
  echo -e "${BLUE}📋 Setting up development database...${NC}"
  
  # Ensure we're using the consolidated schema
  if [[ -f "prisma/schema-consolidated.prisma" ]]; then
    echo -e "${BLUE}🔄 Using consolidated schema...${NC}"
    cp prisma/schema-consolidated.prisma prisma/schema.prisma
  fi
  
  # Generate Prisma client
  echo -e "${BLUE}⚙️  Generating Prisma client...${NC}"
  bunx prisma generate
  
  # Reset database (drops all data and recreates from schema)
  echo -e "${YELLOW}⚠️  Recreating database from schema...${NC}"
  bunx prisma db push --force-reset
  
  # Run the development seed script
  echo -e "${BLUE}🌱 Running development seed script...${NC}"
  node scripts/database/seed-dev.js
  
  # Start the application in development mode
  echo -e "${GREEN}✅ Development database setup complete. Starting application...${NC}"
  bun run dev
fi