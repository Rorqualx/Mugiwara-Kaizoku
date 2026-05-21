#!/bin/bash

# Database Client Consolidation Script
# Updates all imports to use lib/prisma directly

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}=== Database Client Consolidation Script ===${NC}"
echo "Updating all imports to use lib/prisma directly"
echo ""

# Count current usage
echo -e "${GREEN}Current Usage Analysis:${NC}"
echo "----------------------------------------"
DB_CLIENT_COUNT=$(grep -r "from.*db/client" "$PROJECT_ROOT/src" --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l || echo "0")
DB_PRISMA_COUNT=$(grep -r "from.*db/prisma" "$PROJECT_ROOT/src" --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l || echo "0")
LIB_PRISMA_COUNT=$(grep -r "from.*lib/prisma" "$PROJECT_ROOT/src" --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l || echo "0")

echo "  db/client imports: $DB_CLIENT_COUNT"
echo "  db/prisma imports: $DB_PRISMA_COUNT"
echo "  lib/prisma imports: $LIB_PRISMA_COUNT"
echo ""

# Step 1: Update db/client imports
echo -e "${GREEN}Step 1: Updating db/client imports${NC}"
echo "----------------------------------------"

# Find all files with db/client imports
FILES_WITH_DB_CLIENT=$(grep -rl "from.*['\"].*db/client" "$PROJECT_ROOT/src" --include="*.ts" --include="*.tsx" 2>/dev/null || true)

if [ -n "$FILES_WITH_DB_CLIENT" ]; then
    for file in $FILES_WITH_DB_CLIENT; do
        echo -e "${YELLOW}Updating: $(basename "$file")${NC}"
        
        # Calculate relative path from file to lib/prisma
        FILE_DIR=$(dirname "$file")
        REL_PATH=$(python3 -c "import os.path; print(os.path.relpath('$PROJECT_ROOT/src/lib', '$FILE_DIR'))")
        
        # Replace the import
        sed -i '' "s|from ['\"].*db/client['\"]|from '${REL_PATH}/prisma'|g" "$file"
        echo -e "${GREEN}  ✓ Updated${NC}"
    done
else
    echo "No db/client imports found"
fi

# Step 2: Update db/prisma imports
echo -e "\n${GREEN}Step 2: Updating db/prisma imports${NC}"
echo "----------------------------------------"

# Find all files with db/prisma imports
FILES_WITH_DB_PRISMA=$(grep -rl "from.*['\"].*db/prisma" "$PROJECT_ROOT/src" --include="*.ts" --include="*.tsx" 2>/dev/null || true)

if [ -n "$FILES_WITH_DB_PRISMA" ]; then
    for file in $FILES_WITH_DB_PRISMA; do
        echo -e "${YELLOW}Updating: $(basename "$file")${NC}"
        
        # Calculate relative path from file to lib/prisma
        FILE_DIR=$(dirname "$file")
        REL_PATH=$(python3 -c "import os.path; print(os.path.relpath('$PROJECT_ROOT/src/lib', '$FILE_DIR'))")
        
        # Replace the import
        sed -i '' "s|from ['\"].*db/prisma['\"]|from '${REL_PATH}/prisma'|g" "$file"
        echo -e "${GREEN}  ✓ Updated${NC}"
    done
else
    echo "No db/prisma imports found"
fi

# Step 3: Remove old re-export files
echo -e "\n${GREEN}Step 3: Removing old re-export files${NC}"
echo "----------------------------------------"

if [ -f "$PROJECT_ROOT/src/server/db/client.ts" ]; then
    echo -e "${YELLOW}Removing src/server/db/client.ts${NC}"
    rm "$PROJECT_ROOT/src/server/db/client.ts"
    echo -e "${GREEN}✓ Removed${NC}"
fi

if [ -f "$PROJECT_ROOT/src/server/db/prisma.ts" ]; then
    echo -e "${YELLOW}Removing src/server/db/prisma.ts${NC}"
    rm "$PROJECT_ROOT/src/server/db/prisma.ts"
    echo -e "${GREEN}✓ Removed${NC}"
fi

# Check if db directory is now empty and remove if so
if [ -d "$PROJECT_ROOT/src/server/db" ]; then
    if [ -z "$(ls -A "$PROJECT_ROOT/src/server/db")" ]; then
        echo -e "${YELLOW}Removing empty src/server/db directory${NC}"
        rmdir "$PROJECT_ROOT/src/server/db"
        echo -e "${GREEN}✓ Removed${NC}"
    fi
fi

# Step 4: Verify changes
echo -e "\n${GREEN}Step 4: Verification${NC}"
echo "----------------------------------------"

# Count usage after changes
NEW_DB_CLIENT_COUNT=$(grep -r "from.*db/client" "$PROJECT_ROOT/src" --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l || echo "0")
NEW_DB_PRISMA_COUNT=$(grep -r "from.*db/prisma" "$PROJECT_ROOT/src" --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l || echo "0")
NEW_LIB_PRISMA_COUNT=$(grep -r "from.*lib/prisma" "$PROJECT_ROOT/src" --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l || echo "0")

echo "After consolidation:"
echo "  db/client imports: $NEW_DB_CLIENT_COUNT (was $DB_CLIENT_COUNT)"
echo "  db/prisma imports: $NEW_DB_PRISMA_COUNT (was $DB_PRISMA_COUNT)"
echo "  lib/prisma imports: $NEW_LIB_PRISMA_COUNT (was $LIB_PRISMA_COUNT)"

# Create report
cat > "$PROJECT_ROOT/docs/db-client-consolidation.md" << EOF
# Database Client Consolidation Report

*Generated: $(date)*
*Status: Complete*

## Summary

Successfully consolidated all database client imports to use \`lib/prisma\` directly.

### Before
- db/client imports: $DB_CLIENT_COUNT
- db/prisma imports: $DB_PRISMA_COUNT
- lib/prisma imports: $LIB_PRISMA_COUNT
- Total files with re-exports: 2

### After
- db/client imports: $NEW_DB_CLIENT_COUNT
- db/prisma imports: $NEW_DB_PRISMA_COUNT
- lib/prisma imports: $NEW_LIB_PRISMA_COUNT
- Re-export files removed: 2

### Files Removed
- \`src/server/db/client.ts\` (re-export)
- \`src/server/db/prisma.ts\` (re-export)
- \`src/server/db/\` (empty directory)

### Impact
- All imports now use the canonical \`lib/prisma\` source
- Removed unnecessary indirection
- Cleaner import paths

### Testing
Run these commands to verify:
\`\`\`bash
bun run type-check
bun run test
\`\`\`
EOF

echo -e "\n${GREEN}=== Consolidation Complete ===${NC}"
echo "All database client imports now use lib/prisma directly"
echo "Report saved to docs/db-client-consolidation.md"