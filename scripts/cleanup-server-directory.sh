#!/bin/bash

# Server Directory Cleanup Script
# Safe cleanup of identified duplicates and legacy files

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SERVER_DIR="$PROJECT_ROOT/src/server"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Server Directory Cleanup Script ===${NC}"
echo "This script will safely clean up duplicates and legacy files"
echo ""

# Function to safely remove files
safe_remove() {
    local file="$1"
    if [ -f "$file" ]; then
        echo -e "${YELLOW}Removing: $file${NC}"
        rm -f "$file"
        echo -e "${GREEN}✓ Removed${NC}"
    else
        echo -e "${RED}✗ File not found: $file${NC}"
    fi
}

# Function to check if file is imported
check_imports() {
    local file="$1"
    local basename=$(basename "$file" .ts)
    local dirname=$(dirname "$file")
    
    echo "Checking for imports of $basename..."
    if grep -r "$basename" "$PROJECT_ROOT/src" --include="*.ts" --include="*.tsx" --exclude-dir=".git" | grep -v "$file" | grep -q .; then
        echo -e "${RED}⚠️  Warning: File is still being imported${NC}"
        return 1
    else
        echo -e "${GREEN}✓ No imports found${NC}"
        return 0
    fi
}

# Phase 1: Remove .tmp files
echo -e "\n${GREEN}Phase 1: Removing temporary files${NC}"
echo "----------------------------------------"

TMP_FILES=(
    "$SERVER_DIR/api/__tests__/api.test.ts.tmp"
    "$SERVER_DIR/api/__tests__/integration/manga.test.ts.tmp"
    "$SERVER_DIR/api/services/performanceService.ts.tmp"
    "$SERVER_DIR/parsers/__tests__/core/DataNormalizer.test.ts.tmp"
    "$SERVER_DIR/parsers/__tests__/fixtures/testData.ts.tmp"
    "$SERVER_DIR/services/combined/combinedMetadataExtractor.ts.tmp"
)

for file in "${TMP_FILES[@]}"; do
    safe_remove "$file"
done

# Phase 2: Check for duplicate notification service
echo -e "\n${GREEN}Phase 2: Checking duplicate notification services${NC}"
echo "----------------------------------------"

OLD_NOTIFICATION="$SERVER_DIR/services/notification/NotificationService.ts"
NEW_NOTIFICATION="$SERVER_DIR/services/notifications/NotificationService.ts"

if [ -f "$OLD_NOTIFICATION" ] && [ -f "$NEW_NOTIFICATION" ]; then
    echo "Found duplicate notification services:"
    echo "  Old: $OLD_NOTIFICATION"
    echo "  New: $NEW_NOTIFICATION"
    
    if check_imports "$OLD_NOTIFICATION"; then
        echo -e "${YELLOW}Would remove old notification directory: $SERVER_DIR/services/notification/${NC}"
        echo "(Skipping actual removal - uncomment to enable)"
        # rm -rf "$SERVER_DIR/services/notification/"
    else
        echo -e "${RED}Old notification service is still in use, skipping removal${NC}"
    fi
fi

# Phase 3: Check TRPC router duplicates
echo -e "\n${GREEN}Phase 3: Analyzing TRPC router structure${NC}"
echo "----------------------------------------"

if [ -d "$SERVER_DIR/trpc/router" ] && [ -d "$SERVER_DIR/trpc/routers" ]; then
    echo "Found both router directories:"
    echo "  Old: $SERVER_DIR/trpc/router/"
    echo "  New: $SERVER_DIR/trpc/routers/"
    
    # Count files in each
    OLD_COUNT=$(find "$SERVER_DIR/trpc/router" -name "*.ts" | wc -l)
    NEW_COUNT=$(find "$SERVER_DIR/trpc/routers" -name "*.ts" | wc -l)
    
    echo "  Old directory has $OLD_COUNT files"
    echo "  New directory has $NEW_COUNT files"
    
    # List potential duplicates
    echo -e "\n${YELLOW}Potential duplicate routers:${NC}"
    for file in "$SERVER_DIR/trpc/router"/*.ts; do
        basename_file=$(basename "$file")
        if [ -f "$SERVER_DIR/trpc/routers/$basename_file" ]; then
            echo "  - $basename_file exists in both directories"
        fi
    done
fi

# Phase 4: Check manga router variants
echo -e "\n${GREEN}Phase 4: Checking manga router variants${NC}"
echo "----------------------------------------"

MANGA_ROUTERS=(
    "$SERVER_DIR/trpc/routers/manga.ts"
    "$SERVER_DIR/trpc/routers/manga-unified.ts"
    "$SERVER_DIR/trpc/routers/unified-manga.ts"
)

echo "Found manga router variants:"
for router in "${MANGA_ROUTERS[@]}"; do
    if [ -f "$router" ]; then
        echo "  ✓ $(basename "$router")"
        # Check which one is actively used
        import_count=$(grep -r "$(basename "$router" .ts)" "$PROJECT_ROOT/src" --include="*.ts" --include="*.tsx" | wc -l)
        echo "    Import count: $import_count"
    fi
done

# Phase 5: Database client analysis
echo -e "\n${GREEN}Phase 5: Database client exports${NC}"
echo "----------------------------------------"

DB_CLIENTS=(
    "$SERVER_DIR/db/client.ts"
    "$SERVER_DIR/db/prisma.ts"
)

for client in "${DB_CLIENTS[@]}"; do
    if [ -f "$client" ]; then
        echo "Found: $client"
        import_count=$(grep -r "from.*$(basename $(dirname "$client"))/$(basename "$client" .ts)" "$PROJECT_ROOT/src" --include="*.ts" --include="*.tsx" | wc -l)
        echo "  Import count: $import_count"
    fi
done

# Phase 6: Config service analysis
echo -e "\n${GREEN}Phase 6: Config service proliferation${NC}"
echo "----------------------------------------"

CONFIG_COUNT=$(find "$SERVER_DIR" -name "configService.ts" | wc -l)
echo "Found $CONFIG_COUNT configService.ts files"

if [ "$CONFIG_COUNT" -gt 20 ]; then
    echo -e "${YELLOW}⚠️  High number of config services detected${NC}"
    echo "Consider consolidation to central config service"
fi

# Summary
echo -e "\n${GREEN}=== Cleanup Summary ===${NC}"
echo "----------------------------------------"
echo "✓ Temporary files removed: ${#TMP_FILES[@]}"
echo "⚠️  Manual review needed for:"
echo "  - TRPC router consolidation"
echo "  - Manga router variants"
echo "  - Config service consolidation"
echo ""
echo -e "${YELLOW}Note: This script performs safe cleanup only.${NC}"
echo -e "${YELLOW}Additional manual consolidation may be needed.${NC}"

# Generate cleanup verification report
echo -e "\n${GREEN}Generating verification report...${NC}"

REPORT_FILE="$PROJECT_ROOT/docs/server-cleanup-verification.md"
cat > "$REPORT_FILE" << EOF
# Server Cleanup Verification Report

*Generated: $(date)*

## Cleanup Actions Performed

### Temporary Files Removed
$(for file in "${TMP_FILES[@]}"; do
    if [ ! -f "$file" ]; then
        echo "- ✓ $(basename "$file")"
    else
        echo "- ✗ $(basename "$file") (still exists)"
    fi
done)

### Remaining Issues for Manual Review

1. **TRPC Router Structure**
   - Old directory: \`src/server/trpc/router/\` ($OLD_COUNT files)
   - New directory: \`src/server/trpc/routers/\` ($NEW_COUNT files)
   - Action needed: Consolidate to single structure

2. **Manga Router Variants**
$(for router in "${MANGA_ROUTERS[@]}"; do
    if [ -f "$router" ]; then
        import_count=\$(grep -r "\$(basename "\$router" .ts)" "\$PROJECT_ROOT/src" --include="*.ts" --include="*.tsx" | wc -l)
        echo "   - \`$(basename "$router")\` (imports: $import_count)"
    fi
done)
   - Action needed: Consolidate to single implementation

3. **Config Services**
   - Total found: $CONFIG_COUNT files
   - Action needed: Review for consolidation opportunities

## Next Steps

1. Review and consolidate TRPC routers
2. Merge manga router implementations
3. Update all import paths
4. Run tests to verify no breakage

## Verification Commands

\`\`\`bash
# Verify no tmp files remain
find src/server -name "*.tmp" -o -name "*.bak"

# Check for broken imports
bun run type-check

# Run tests
npm test
\`\`\`
EOF

echo -e "${GREEN}✓ Verification report saved to: $REPORT_FILE${NC}"

echo -e "\n${GREEN}=== Cleanup Complete ===${NC}"
echo "Please review the verification report and proceed with manual consolidation as needed."