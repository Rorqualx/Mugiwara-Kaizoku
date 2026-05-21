#!/bin/bash

# Utils Directory Cleanup Script
# This script consolidates duplicate utilities and updates imports

set -e

echo "🧹 Starting utils directory cleanup..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if file exists
check_file() {
    if [ ! -f "$1" ]; then
        echo -e "${RED}✗ File not found: $1${NC}"
        return 1
    fi
    return 0
}

# Function to update imports in a file
update_imports() {
    local file=$1
    local old_import=$2
    local new_import=$3
    
    if grep -q "$old_import" "$file" 2>/dev/null; then
        sed -i.bak "s|$old_import|$new_import|g" "$file"
        echo -e "${GREEN}✓ Updated imports in: $file${NC}"
        rm "${file}.bak"
    fi
}

# Function to find and update all imports
update_all_imports() {
    local old_pattern=$1
    local new_import=$2
    
    echo "Updating imports from '$old_pattern' to '$new_import'..."
    
    find src -name "*.ts" -o -name "*.tsx" | while read -r file; do
        update_imports "$file" "$old_pattern" "$new_import"
    done
}

echo ""
echo "📋 Phase 1: Creating backup..."
if [ ! -d "src/utils/.backup" ]; then
    mkdir -p src/utils/.backup
    cp -r src/utils/*.ts src/utils/.backup/ 2>/dev/null || true
    echo -e "${GREEN}✓ Backup created in src/utils/.backup/${NC}"
else
    echo -e "${YELLOW}⚠ Backup already exists${NC}"
fi

echo ""
echo "📋 Phase 2: Updating ID utility imports..."

# Update imports for id-utils
update_all_imports "from ['\"]\.\.\/utils\/idUtils['\"]" "from '../utils/id-utils'"
update_all_imports "from ['\"]\.\.\/\.\.\/utils\/idUtils['\"]" "from '../../utils/id-utils'"
update_all_imports "from ['\"]\.\.\/\.\.\/\.\.\/utils\/idUtils['\"]" "from '../../../utils/id-utils'"
update_all_imports "from ['\"]@\/utils\/idUtils['\"]" "from '@/utils/id-utils'"

# Update imports for id-converters
update_all_imports "from ['\"]\.\.\/utils\/id-converters['\"]" "from '../utils/id-utils'"
update_all_imports "from ['\"]\.\.\/\.\.\/utils\/id-converters['\"]" "from '../../utils/id-utils'"
update_all_imports "from ['\"]@\/utils\/id-converters['\"]" "from '@/utils/id-utils'"

# Update imports for id-conversion
update_all_imports "from ['\"]\.\.\/utils\/id-conversion['\"]" "from '../utils/id-utils'"
update_all_imports "from ['\"]\.\.\/\.\.\/utils\/id-conversion['\"]" "from '../../utils/id-utils'"
update_all_imports "from ['\"]@\/utils\/id-conversion['\"]" "from '@/utils/id-utils'"

echo ""
echo "📋 Phase 3: Updating AsyncResult imports..."

# Update imports for async-result-standard
update_all_imports "from ['\"]\.\.\/utils\/async-result-standard['\"]" "from '../utils/async-result'"
update_all_imports "from ['\"]\.\.\/\.\.\/utils\/async-result-standard['\"]" "from '../../utils/async-result'"
update_all_imports "from ['\"]@\/utils\/async-result-standard['\"]" "from '@/utils/async-result'"

# Update imports for async-result-helpers
update_all_imports "from ['\"]\.\.\/utils\/async-result-helpers['\"]" "from '../utils/async-result'"
update_all_imports "from ['\"]\.\.\/\.\.\/utils\/async-result-helpers['\"]" "from '../../utils/async-result'"
update_all_imports "from ['\"]@\/utils\/async-result-helpers['\"]" "from '@/utils/async-result'"

echo ""
echo "📋 Phase 4: Replacing files with consolidated versions..."

# Replace id-utils.ts with consolidated version
if [ -f "src/utils/id-utils-consolidated.ts" ]; then
    mv src/utils/id-utils.ts src/utils/.backup/id-utils.original.ts 2>/dev/null || true
    mv src/utils/id-utils-consolidated.ts src/utils/id-utils.ts
    echo -e "${GREEN}✓ Replaced id-utils.ts with consolidated version${NC}"
fi

# Replace async-result.ts with consolidated version
if [ -f "src/utils/async-result-consolidated.ts" ]; then
    mv src/utils/async-result.ts src/utils/.backup/async-result.original.ts 2>/dev/null || true
    mv src/utils/async-result-consolidated.ts src/utils/async-result.ts
    echo -e "${GREEN}✓ Replaced async-result.ts with consolidated version${NC}"
fi

echo ""
echo "📋 Phase 5: Removing duplicate files..."

# List of files to remove (duplicates)
DUPLICATE_FILES=(
    "src/utils/idUtils.ts"
    "src/utils/id-converters.ts"
    "src/utils/id-conversion.ts"
    "src/utils/async-result-standard.ts"
    "src/utils/async-result-helpers.ts"
    "src/utils/api-utils-enhanced.ts"
    "src/utils/test-resolution.ts"
    "src/utils/empty-module.ts"
)

for file in "${DUPLICATE_FILES[@]}"; do
    if [ -f "$file" ]; then
        mv "$file" "src/utils/.backup/$(basename $file).removed" 2>/dev/null
        echo -e "${GREEN}✓ Removed duplicate: $file${NC}"
    fi
done

echo ""
echo "📋 Phase 6: Checking for broken imports..."

# Check if any files still import removed modules
REMOVED_MODULES=(
    "idUtils"
    "id-converters"
    "id-conversion"
    "async-result-standard"
    "async-result-helpers"
    "api-utils-enhanced"
    "test-resolution"
    "empty-module"
)

echo "Checking for remaining references to removed modules..."
for module in "${REMOVED_MODULES[@]}"; do
    count=$(grep -r "from.*['\"].*$module['\"]" src --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l || echo "0")
    if [ "$count" -gt 0 ]; then
        echo -e "${YELLOW}⚠ Found $count references to '$module' - may need manual fixing${NC}"
        grep -r "from.*['\"].*$module['\"]" src --include="*.ts" --include="*.tsx" 2>/dev/null | head -5
    fi
done

echo ""
echo "📋 Phase 7: Running TypeScript check..."

# Try to run type check
echo "Running type check (this may take a moment)..."
bun run type-check 2>&1 | head -20 || {
    echo -e "${YELLOW}⚠ TypeScript check found issues - this is expected${NC}"
    echo "You may need to manually fix some imports"
}

echo ""
echo "✨ Cleanup complete!"
echo ""
echo "Summary:"
echo "- Consolidated ID utilities into id-utils.ts"
echo "- Consolidated AsyncResult utilities into async-result.ts"
echo "- Removed duplicate files"
echo "- Updated imports across the codebase"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Review any remaining TypeScript errors"
echo "2. Run 'bun run type-check' to verify"
echo "3. Run tests with 'npm test'"
echo "4. If issues occur, backups are in src/utils/.backup/"
echo ""
echo "To restore backups if needed:"
echo "  cp src/utils/.backup/*.ts src/utils/"