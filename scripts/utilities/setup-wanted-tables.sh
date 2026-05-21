#!/bin/bash
# Setup script for Wanted functionality database tables
# This script ensures the wanted tables are created properly

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Setting up Wanted functionality database tables...${NC}"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}Error: Must run from project root directory${NC}"
    exit 1
fi

# Generate Prisma client
echo -e "${GREEN}Generating Prisma client...${NC}"
bunx prisma generate

# Push schema to database (development mode)
echo -e "${GREEN}Pushing schema to database...${NC}"
bunx prisma db push

# Verify tables were created
echo -e "${GREEN}Verifying wanted tables...${NC}"

# Check if tables exist using Prisma
bunx prisma db execute --stdin <<EOF
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('WantedItem', 'DownloadHistory', 'Blocklist')
ORDER BY table_name;
EOF

echo -e "${GREEN}✅ Wanted functionality database setup complete!${NC}"
echo -e "${YELLOW}You can now use the wanted pages at:${NC}"
echo "  - /wanted/missing    - View missing items"
echo "  - /wanted/downloads  - View recent downloads"
echo "  - /wanted/history    - View download history"
echo "  - /wanted/blocklist  - Manage blocklist"
