#!/bin/bash
# Phase 2: Fix Import Paths

echo "========================================="
echo "Phase 2: Fixing Import Paths"
echo "========================================="

# Get initial error count
INITIAL_ERRORS=$(bunx tsc --noEmit 2>&1 | grep "error TS" | wc -l)
echo "Initial error count: $INITIAL_ERRORS"

# Track changes
CHANGED_FILES=0

# Function to update imports in a file
update_imports() {
    local file=$1
    local temp_file="${file}.tmp"
    local changed=false
    
    # Create temp file with updated imports
    sed -E \
        -e "s|from ['\"]@/types/domain['\"]|from '@/types/domain/index'|g" \
        -e "s|from ['\"]\.\./(\.\./)*/types/domain['\"]|from '@/types/domain/index'|g" \
        -e "s|from ['\"]@/types/canonical['\"];.*// Duplicate|from '@/types/canonical';|g" \
        "$file" > "$temp_file"
    
    # Check if file changed
    if ! diff -q "$file" "$temp_file" > /dev/null 2>&1; then
        mv "$temp_file" "$file"
        changed=true
        ((CHANGED_FILES++))
        echo "  Updated: $file"
    else
        rm "$temp_file"
    fi
}

echo ""
echo "Updating imports in TypeScript files..."
echo "---------------------------------------"

# Update imports in all TypeScript files
find src -name "*.ts" -o -name "*.tsx" | while read file; do
    update_imports "$file"
done

echo ""
echo "✅ Updated $CHANGED_FILES files"

# Special handling for commonly broken imports
echo ""
echo "Fixing specific import issues..."
echo "--------------------------------"

# Fix MangaEntity and ChapterEntity imports
find src -name "*.ts" -o -name "*.tsx" -exec grep -l "MangaEntity\|ChapterEntity" {} \; | while read file; do
    # Skip type definition files
    if [[ ! "$file" =~ "types/canonical" ]] && [[ ! "$file" =~ "types/domain" ]] && [[ ! "$file" =~ "type-registry" ]]; then
        # Check if they're importing these types
        if grep -E "import.*\{.*MangaEntity.*\}" "$file" > /dev/null 2>&1; then
            # Add import if not present
            if ! grep "from '@/types/domain/index'" "$file" > /dev/null 2>&1; then
                # Add import at the top of imports section
                sed -i.bak "0,/^import/s|import|import { MangaEntity, ChapterEntity } from '@/types/domain/index';\nimport|" "$file"
                rm "${file}.bak"
                echo "  Added domain import to: $file"
            fi
        fi
    fi
done

# Check error count
NEW_ERRORS=$(bunx tsc --noEmit 2>&1 | grep "error TS" | wc -l)
echo ""
echo "Results:"
echo "--------"
echo "Initial errors: $INITIAL_ERRORS"
echo "Current errors: $NEW_ERRORS"
echo "Files changed: $CHANGED_FILES"

DIFF=$((NEW_ERRORS - INITIAL_ERRORS))
if [ $DIFF -gt 100 ]; then
    echo "⚠️ Warning: Errors increased by $DIFF (threshold: 100)"
    echo "Consider rolling back if this is unexpected"
else
    echo "✅ Phase 2 complete successfully"
fi

# Save state
echo "$NEW_ERRORS" > .phase2-error-count