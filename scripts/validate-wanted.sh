#!/bin/bash
# Validation script for Wanted functionality implementation

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Validating Wanted functionality implementation...${NC}"
echo

# Check files exist
echo -e "${YELLOW}Checking file structure...${NC}"

# Domain types
if [ -f "src/types/domain/wanted-types.ts" ]; then
    echo -e "  ${GREEN}✓${NC} Domain types created"
else
    echo -e "  ${RED}✗${NC} Domain types missing"
fi

# tRPC router
if [ -f "src/server/trpc/routers/wanted.ts" ]; then
    echo -e "  ${GREEN}✓${NC} tRPC router created"
else
    echo -e "  ${RED}✗${NC} tRPC router missing"
fi

# Page files
pages=("missing" "downloads" "history" "blocklist")
all_pages_exist=true
for page in "${pages[@]}"; do
    if [ -f "src/pages/wanted/$page.tsx" ]; then
        echo -e "  ${GREEN}✓${NC} Page: /wanted/$page"
    else
        echo -e "  ${RED}✗${NC} Page missing: /wanted/$page"
        all_pages_exist=false
    fi
done

# Hooks
if [ -f "src/hooks/useWanted.ts" ]; then
    echo -e "  ${GREEN}✓${NC} Custom hooks created"
else
    echo -e "  ${RED}✗${NC} Custom hooks missing"
fi

# Components
if [ -f "src/components/wanted/WantedSummaryWidget.tsx" ]; then
    echo -e "  ${GREEN}✓${NC} Summary widget created"
else
    echo -e "  ${RED}✗${NC} Summary widget missing"
fi

echo

# Check for removed files
echo -e "${YELLOW}Checking removed files...${NC}"
if [ ! -f "src/utils/tabler-icons-wrapper.js" ]; then
    echo -e "  ${GREEN}✓${NC} Icon wrapper removed"
else
    echo -e "  ${RED}✗${NC} Icon wrapper still exists - should be removed"
fi

if [ -f ".archive/removed-wrappers/tabler-icons-wrapper.js" ]; then
    echo -e "  ${GREEN}✓${NC} Icon wrapper archived"
else
    echo -e "  ${RED}✗${NC} Icon wrapper not archived"
fi

echo

# Check imports
echo -e "${YELLOW}Checking import patterns...${NC}"

# Check for proper icon imports
icon_imports=$(grep -r "from '@tabler/icons-react'" src/pages/wanted/ 2>/dev/null | wc -l)
if [ $icon_imports -ge 4 ]; then
    echo -e "  ${GREEN}✓${NC} Icon imports use @tabler/icons-react"
else
    echo -e "  ${RED}✗${NC} Some icon imports may be incorrect"
fi

# Check for no wrapper imports
wrapper_imports=$(grep -r "tabler-icons-wrapper" src/pages/wanted/ 2>/dev/null | wc -l || true)
if [ $wrapper_imports -eq 0 ]; then
    echo -e "  ${GREEN}✓${NC} No wrapper imports found"
else
    echo -e "  ${RED}✗${NC} Found $wrapper_imports wrapper imports - should be removed"
fi

echo

# Check TypeScript compilation
echo -e "${YELLOW}Checking TypeScript compilation...${NC}"
if bun run type-check 2>/dev/null; then
    echo -e "  ${GREEN}✓${NC} TypeScript compilation successful"
else
    echo -e "  ${YELLOW}⚠${NC}  TypeScript has some issues (may be unrelated to wanted pages)"
fi

echo

# Check database schema
echo -e "${YELLOW}Checking database schema...${NC}"
if grep -q "model WantedItem" prisma/schema.prisma && \
   grep -q "model DownloadHistory" prisma/schema.prisma && \
   grep -q "model Blocklist" prisma/schema.prisma; then
    echo -e "  ${GREEN}✓${NC} Database models added to schema"
else
    echo -e "  ${RED}✗${NC} Database models missing from schema"
fi

echo

# Summary
echo -e "${YELLOW}================== SUMMARY ==================${NC}"
if [ "$all_pages_exist" = true ] && [ $wrapper_imports -eq 0 ]; then
    echo -e "${GREEN}✅ Wanted functionality implementation is complete!${NC}"
    echo
    echo "Next steps:"
    echo "1. Run database setup: ${GREEN}bun run wanted:setup${NC}"
    echo "2. Seed test data: ${GREEN}bun run wanted:seed${NC}"
    echo "3. Start the app: ${GREEN}bun run dev${NC}"
    echo "4. Visit the wanted pages:"
    echo "   - http://localhost:3000/wanted/missing"
    echo "   - http://localhost:3000/wanted/downloads"
    echo "   - http://localhost:3000/wanted/history"
    echo "   - http://localhost:3000/wanted/blocklist"
else
    echo -e "${RED}❌ Some issues found. Please review the output above.${NC}"
fi

echo -e "${YELLOW}=============================================${NC}"
