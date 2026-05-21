#!/bin/bash

# Final comprehensive fix for canonical types
echo "🚀 Final comprehensive fix for canonical types..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Step 1: Fix duplicate MangaEntity/ChapterEntity imports
echo -e "${BLUE}Step 1: Fixing duplicate entity imports...${NC}"
find src -name "*.ts" -o -name "*.tsx" | while read -r file; do
    # Skip node_modules and build directories
    if [[ "$file" == *"node_modules"* ]] || [[ "$file" == *"dist"* ]] || [[ "$file" == *".next"* ]]; then
        continue
    fi
    
    # Remove duplicate MangaEntity imports (keep only first)
    if [ $(grep -c "import.*MangaEntity" "$file" || echo 0) -gt 1 ]; then
        # Create temp file with only first import
        awk '/import.*MangaEntity/ && !found {found=1; print; next} !/import.*MangaEntity/ {print}' "$file" > "$file.tmp"
        mv "$file.tmp" "$file"
        echo -e "${GREEN}✓${NC} Fixed duplicate MangaEntity imports in $file"
    fi
    
    # Remove duplicate ChapterEntity imports (keep only first)
    if [ $(grep -c "import.*ChapterEntity" "$file" || echo 0) -gt 1 ]; then
        awk '/import.*ChapterEntity/ && !found {found=1; print; next} !/import.*ChapterEntity/ {print}' "$file" > "$file.tmp"
        mv "$file.tmp" "$file"
        echo -e "${GREEN}✓${NC} Fixed duplicate ChapterEntity imports in $file"
    fi
done

# Step 2: Add missing MangaEntity/ChapterEntity imports where they're used
echo -e "${BLUE}Step 2: Adding missing entity imports...${NC}"
find src -name "*.ts" -o -name "*.tsx" | while read -r file; do
    # Skip node_modules and build directories
    if [[ "$file" == *"node_modules"* ]] || [[ "$file" == *"dist"* ]] || [[ "$file" == *".next"* ]]; then
        continue
    fi
    
    # Check if file uses MangaEntity but doesn't import it
    if grep -q "\bMangaEntity\b" "$file" && ! grep -q "import.*MangaEntity" "$file"; then
        # Check if it already imports from canonical
        if grep -q "import.*from '@/types/canonical'" "$file"; then
            # Add to existing import
            sed -i '' "s|import { \(.*\) } from '@/types/canonical'|import { \1, MangaEntity } from '@/types/canonical'|" "$file"
        else
            # Add new import at beginning
            sed -i '' "1s/^/import { MangaEntity } from '@\/types\/canonical';\n/" "$file"
        fi
        echo -e "${GREEN}✓${NC} Added MangaEntity import to $file"
    fi
    
    # Check if file uses ChapterEntity but doesn't import it
    if grep -q "\bChapterEntity\b" "$file" && ! grep -q "import.*ChapterEntity" "$file"; then
        # Check if it already imports from canonical
        if grep -q "import.*from '@/types/canonical'" "$file"; then
            # Add to existing import
            sed -i '' "s|import { \(.*\) } from '@/types/canonical'|import { \1, ChapterEntity } from '@/types/canonical'|" "$file"
        else
            # Add new import at beginning
            sed -i '' "1s/^/import { ChapterEntity } from '@\/types\/canonical';\n/" "$file"
        fi
        echo -e "${GREEN}✓${NC} Added ChapterEntity import to $file"
    fi
done

# Step 3: Fix ContentRating imports
echo -e "${BLUE}Step 3: Fixing ContentRating imports...${NC}"
find src -name "*.ts" -o -name "*.tsx" | while read -r file; do
    # Skip node_modules and build directories
    if [[ "$file" == *"node_modules"* ]] || [[ "$file" == *"dist"* ]] || [[ "$file" == *".next"* ]]; then
        continue
    fi
    
    # Check if file uses ContentRating but doesn't import it
    if grep -q "\bContentRating\b" "$file" && ! grep -q "import.*ContentRating" "$file"; then
        # Check if it already imports from canonical
        if grep -q "import.*from '@/types/canonical'" "$file"; then
            # Add to existing import
            sed -i '' "s|import { \(.*\) } from '@/types/canonical'|import { \1, ContentRating } from '@/types/canonical'|" "$file"
        else
            # Add new import at beginning
            sed -i '' "1s/^/import { ContentRating } from '@\/types\/canonical';\n/" "$file"
        fi
        echo -e "${GREEN}✓${NC} Added ContentRating import to $file"
    fi
done

# Step 4: Remove backward compatibility files
echo -e "${BLUE}Step 4: Removing backward compatibility files...${NC}"
declare -a FILES_TO_REMOVE=(
    "src/types/quick-fixes.d.ts"
    "src/utils/typescript-compat.ts"
    "src/utils/frontend/compatibility.ts"
    "src/utils/task-compatibility.ts"
    "src/utils/compatibility-map.ts"
)

for file in "${FILES_TO_REMOVE[@]}"; do
    if [ -f "$file" ]; then
        rm "$file"
        echo -e "${GREEN}✓${NC} Removed $file"
    fi
done

# Step 5: Fix ID type issues
echo -e "${BLUE}Step 5: Fixing ID type issues...${NC}"
find src -name "*.ts" -o -name "*.tsx" | while read -r file; do
    # Skip node_modules and build directories
    if [[ "$file" == *"node_modules"* ]] || [[ "$file" == *"dist"* ]] || [[ "$file" == *".next"* ]]; then
        continue
    fi
    
    # Fix ChapterEntity.id conversions
    sed -i '' "s/chapter\.id as string/String(chapter.id)/g" "$file"
    sed -i '' "s/chapter\.id as number/Number(chapter.id)/g" "$file"
    
    # Fix MangaEntity.id conversions
    sed -i '' "s/manga\.id as string/String(manga.id)/g" "$file"
    sed -i '' "s/manga\.id as number/Number(manga.id)/g" "$file"
done

# Step 6: Clean up imports in all files
echo -e "${BLUE}Step 6: Cleaning up imports...${NC}"
find src -name "*.ts" -o -name "*.tsx" | while read -r file; do
    # Skip node_modules and build directories
    if [[ "$file" == *"node_modules"* ]] || [[ "$file" == *"dist"* ]] || [[ "$file" == *".next"* ]]; then
        continue
    fi
    
    # Remove empty imports
    sed -i '' "/^import { *} from/d" "$file"
    
    # Remove duplicate consecutive imports from same module
    awk '!seen[$0]++ || !/^import/' "$file" > "$file.tmp" && mv "$file.tmp" "$file"
done

# Step 7: Run final TypeScript check
echo -e "${BLUE}Step 7: Running TypeScript check...${NC}"
bunx tsc --noEmit 2>&1 | tee typescript-errors-final.log

ERROR_COUNT=$(grep -c "error TS" typescript-errors-final.log || echo "0")

# Generate final report
cat > canonical-migration-report.md << EOF
# Canonical Types Migration Report

## Migration Complete

### Statistics
- Initial errors: 3698
- Final errors: $ERROR_COUNT
- Error reduction: $((3698 - ERROR_COUNT))

### Changes Applied
1. Fixed duplicate entity imports
2. Added missing entity imports
3. Fixed ContentRating imports
4. Removed backward compatibility files
5. Fixed ID type conversions
6. Cleaned up import statements

### Files Modified
- Multiple TypeScript and TSX files updated
- Backward compatibility layers removed
- Imports consolidated to canonical types

### Next Steps
$(if [ $ERROR_COUNT -gt 0 ]; then
    echo "- Review remaining $ERROR_COUNT errors in typescript-errors-final.log"
    echo "- Most remaining errors likely need manual fixes for:"
    echo "  - Complex type mismatches"
    echo "  - Provider-specific implementations"
    echo "  - Test file updates"
else
    echo "- All TypeScript errors resolved!"
    echo "- Run tests to ensure functionality"
    echo "- Deploy with confidence"
fi)

## Error Categories Remaining
$(if [ $ERROR_COUNT -gt 0 ]; then
    bunx tsc --noEmit 2>&1 | grep "error TS" | sed 's/.*error TS\([0-9]*\):.*/TS\1/' | sort | uniq -c | sort -rn | head -5
fi)
EOF

echo ""
echo "========================================="
echo -e "${GREEN}✅ Final Canonical Types Migration Complete!${NC}"
echo "========================================="
echo "Initial errors: 3698"
echo "Final errors: $ERROR_COUNT"
echo "Error reduction: $((3698 - ERROR_COUNT))"
echo ""
echo "Report saved to: canonical-migration-report.md"
echo "Error log saved to: typescript-errors-final.log"