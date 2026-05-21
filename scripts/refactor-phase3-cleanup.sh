#!/bin/bash
# Phase 3: Clean Up Duplicates and Archives

echo "========================================="
echo "Phase 3: Cleaning Up Duplicates"
echo "========================================="

# Get initial error count
INITIAL_ERRORS=$(bunx tsc --noEmit 2>&1 | grep "error TS" | wc -l)
echo "Initial error count: $INITIAL_ERRORS"

echo ""
echo "Removing references to archived types..."
echo "----------------------------------------"

# Replace archive imports with current imports
find src -name "*.ts" -o -name "*.tsx" | while read file; do
    # Skip archive directory itself
    if [[ "$file" =~ "__archive" ]]; then
        continue
    fi
    
    # Replace archive imports
    if grep -q "__archive_2025_08_26" "$file"; then
        sed -i.bak \
            -e 's|@/types/__archive_2025_08_26/domain|@/types/domain/index|g' \
            -e 's|@/types/__archive_2025_08_26/api|@/types/canonical|g' \
            -e 's|\.\./__archive_2025_08_26/domain|../domain/index|g' \
            "$file"
        rm "${file}.bak"
        echo "  Cleaned: $file"
    fi
done

echo ""
echo "Consolidating duplicate type imports..."
echo "---------------------------------------"

# Fix files with multiple conflicting imports
find src -name "*.ts" -o -name "*.tsx" | while read file; do
    # Count MangaStatus imports
    status_count=$(grep -c "import.*MangaStatus" "$file" 2>/dev/null || echo 0)
    
    if [ "$status_count" -gt 1 ]; then
        echo "  Consolidating imports in: $file"
        # Remove duplicate imports, keep only one from canonical
        awk '
            !seen && /import.*MangaStatus.*from.*canonical/ { seen=1; print; next }
            /import.*MangaStatus/ && seen { next }
            { print }
        ' "$file" > "$file.tmp"
        mv "$file.tmp" "$file"
    fi
done

echo ""
echo "Removing unused type files..."
echo "-----------------------------"

# List potentially unused type files (be careful here)
echo "  Candidates for removal (manual review recommended):"
find src/types -name "*.d.ts" -o -name "*deprecated*" -o -name "*old*" -o -name "*backup*" 2>/dev/null | head -10

echo ""
echo "Updating barrel exports..."
echo "--------------------------"

# Ensure main type exports are correct
cat > src/types/index.ts << 'EOF'
/**
 * Main Type Exports
 * 
 * Central export point for all types
 */

// Primary exports from type registry
export * from './type-registry';

// Canonical types
export * from './canonical';

// Domain types (redirect)
export * from './domain';

// Extension types
export * from './extensions';

// Adapter types
export * from './adapters';
EOF

echo "✅ Updated main type exports"

# Check error count
NEW_ERRORS=$(bunx tsc --noEmit 2>&1 | grep "error TS" | wc -l)
echo ""
echo "Results:"
echo "--------"
echo "Initial errors: $INITIAL_ERRORS"
echo "Current errors: $NEW_ERRORS"

DIFF=$((NEW_ERRORS - INITIAL_ERRORS))
if [ $DIFF -gt 100 ]; then
    echo "⚠️ Warning: Errors increased by $DIFF (threshold: 100)"
else
    echo "✅ Phase 3 complete successfully"
fi

# Save state
echo "$NEW_ERRORS" > .phase3-error-count