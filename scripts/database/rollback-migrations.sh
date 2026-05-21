#!/bin/bash

# =============================================================================
# ROLLBACK TO MIGRATION-BASED SCHEMA
# =============================================================================
# This script restores the original migration-based schema setup
# in case the consolidated schema approach needs to be reverted.
#
# Usage: bun run db:rollback:migrations
# =============================================================================

set -e  # Exit on any error

echo "🔄 Rolling back to migration-based schema setup..."

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${YELLOW}⚠️  This will restore the original migration-based setup${NC}"
echo -e "${YELLOW}⚠️  Any data in the current database will be preserved${NC}"
echo ""
read -p "Continue with rollback? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}Rollback cancelled.${NC}"
    exit 0
fi

echo -e "${BLUE}📦 Restoring original schema files from archive...${NC}"

# Restore original schema files from archive
if [[ -d ".archive/migrations/schema-snapshots/original-schemas" ]]; then
    cp .archive/migrations/schema-snapshots/original-schemas/schema.prisma prisma/schema.prisma
    echo -e "${GREEN}✅ Schema files restored${NC}"
else
    echo -e "${RED}❌ Error: Archive not found!${NC}"
    echo -e "${YELLOW}Archive should be at: .archive/migrations/schema-snapshots/original-schemas${NC}"
    exit 1
fi

# Restore migrations directory
echo -e "${BLUE}📦 Restoring migrations directory...${NC}"
if [[ -d ".archive/migrations/original-migrations" ]]; then
    rm -rf prisma/migrations 2>/dev/null || true
    cp -r .archive/migrations/original-migrations prisma/migrations
    echo -e "${GREEN}✅ Migrations restored${NC}"
else
    echo -e "${RED}❌ Error: Migration archive not found!${NC}"
    echo -e "${YELLOW}Archive should be at: .archive/migrations/original-migrations${NC}"
    exit 1
fi

# Generate Prisma client
echo -e "${BLUE}⚙️  Generating Prisma client...${NC}"
bunx prisma generate

echo -e "${GREEN}✅ Rollback complete!${NC}"
echo -e "${GREEN}🎉 Migration-based schema setup restored.${NC}"
echo ""
echo -e "${BLUE}📊 Restored Setup:${NC}"
echo "   • Schema: Split into 3 files (original structure)"
echo "   • Migrations: 25+ migration files restored"
echo "   • Approach: Migration-based database evolution"
echo ""
echo -e "${YELLOW}💡 Next steps:${NC}"
echo "   • Deploy migrations: bun run migrate"
echo "   • Reset database: bunx prisma migrate reset"
echo "   • Check status: bunx prisma migrate status"
echo ""
echo -e "${BLUE}📚 You can switch back to consolidated schema anytime with:${NC}"
echo "   bun run db:reset:dev"
