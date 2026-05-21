#!/bin/bash

# Final Utils Directory Cleanup Script
# This script completes the consolidation of utilities

set -e

echo "🧹 Finalizing utils directory cleanup..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo ""
echo "📋 Phase 1: Moving consolidated files..."

# Move logging consolidation
if [ -f "src/utils/logging-consolidated.ts" ]; then
    # Backup current logging module
    if [ ! -d "src/utils/logging/.backup" ]; then
        mkdir -p src/utils/logging/.backup
    fi
    cp -r src/utils/logging/*.ts src/utils/logging/.backup/ 2>/dev/null || true
    
    # Replace with consolidated version
    mv src/utils/logging-consolidated.ts src/utils/logging/index.ts
    echo -e "${GREEN}✓ Replaced logging/index.ts with consolidated version${NC}"
    
    # Remove redundant files
    for file in logger.ts standardLogger.ts unified-logger.ts; do
        if [ -f "src/utils/logging/$file" ]; then
            mv "src/utils/logging/$file" "src/utils/logging/.backup/"
            echo -e "${GREEN}✓ Removed redundant: logging/$file${NC}"
        fi
    done
fi

echo ""
echo "📋 Phase 2: Removing test utilities from production..."

# Move test files to test directory
TEST_FILES=(
    "databaseTest.ts"
    "admin-debug.ts"
    "test-resolution.ts"
)

for file in "${TEST_FILES[@]}"; do
    if [ -f "src/utils/$file" ]; then
        if [ ! -d "src/test/utils" ]; then
            mkdir -p src/test/utils
        fi
        mv "src/utils/$file" "src/test/utils/$file"
        echo -e "${GREEN}✓ Moved to test: $file${NC}"
    fi
done

# Move converter examples
if [ -d "src/utils/converters/examples" ]; then
    if [ ! -d "src/test/examples/converters" ]; then
        mkdir -p src/test/examples/converters
    fi
    mv src/utils/converters/examples/* src/test/examples/converters/ 2>/dev/null || true
    rmdir src/utils/converters/examples 2>/dev/null || true
    echo -e "${GREEN}✓ Moved converter examples to test directory${NC}"
fi

# Move test metadata converter
if [ -f "src/utils/converters/test-metadata-converter.ts" ]; then
    mv "src/utils/converters/test-metadata-converter.ts" "src/test/utils/"
    echo -e "${GREEN}✓ Moved test-metadata-converter to test directory${NC}"
fi

echo ""
echo "📋 Phase 3: Updating logger imports..."

# Update imports from various logger files to unified logging
find src -name "*.ts" -o -name "*.tsx" | while read -r file; do
    # Update serverLogger imports
    sed -i.bak "s|from ['\"]\.\..*\/serverLogger['\"]|from '../utils/logging'|g" "$file" 2>/dev/null || true
    sed -i.bak "s|from ['\"]\.\..*\/clientLogger['\"]|from '../utils/logging'|g" "$file" 2>/dev/null || true
    sed -i.bak "s|from ['\"]\.\..*\/utils\/logger['\"]|from '../utils/logging'|g" "$file" 2>/dev/null || true
    
    # Clean up backup files
    rm "${file}.bak" 2>/dev/null || true
done

echo ""
echo "📋 Phase 4: Removing obsolete logger files..."

OBSOLETE_LOGGERS=(
    "src/utils/logger.ts"
    "src/utils/clientLogger.ts"
    "src/utils/serverLogger.ts"
    "src/utils/server-logger.ts"
    "src/utils/debug-logger.ts"
    "src/utils/system-event-logger.ts"
)

for file in "${OBSOLETE_LOGGERS[@]}"; do
    if [ -f "$file" ]; then
        mv "$file" "src/utils/.backup/$(basename $file).removed" 2>/dev/null
        echo -e "${GREEN}✓ Removed obsolete: $(basename $file)${NC}"
    fi
done

echo ""
echo "📋 Phase 5: Cleaning up empty stub files..."

STUB_FILES=(
    "src/utils/tabler-icons-empty.js"
    "src/utils/tabler-icons-minimal.js"
    "src/utils/pino-browser-shim.js"
)

for file in "${STUB_FILES[@]}"; do
    if [ -f "$file" ]; then
        mv "$file" "src/utils/.backup/$(basename $file).removed" 2>/dev/null
        echo -e "${GREEN}✓ Removed stub: $(basename $file)${NC}"
    fi
done

echo ""
echo "📋 Phase 6: Directory structure report..."

echo "Current utils structure:"
find src/utils -type f -name "*.ts" -o -name "*.tsx" 2>/dev/null | wc -l | xargs echo "Total TypeScript files:"
find src/utils -type f -name "*.js" 2>/dev/null | wc -l | xargs echo "Total JavaScript files:"

echo ""
echo "✨ Cleanup complete!"
echo ""
echo "Summary of changes:"
echo "- Consolidated logging into src/utils/logging/index.ts"
echo "- Moved test utilities to src/test/utils/"
echo "- Removed obsolete logger implementations"
echo "- Cleaned up stub files"
echo "- Updated imports across codebase"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Run 'bun run type-check' to verify"
echo "2. Run 'npm test' to ensure tests pass"
echo "3. Review any remaining TypeScript errors"
echo "4. Commit the changes"
echo ""
echo "Backups are available in:"
echo "- src/utils/.backup/"
echo "- src/utils/logging/.backup/"