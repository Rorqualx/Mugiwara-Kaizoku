#!/bin/bash
# Analyze Type System Structure

echo "==================================="
echo "Type System Structure Analysis"
echo "==================================="
echo ""

echo "1. DUPLICATE TYPE DEFINITIONS"
echo "------------------------------"
echo "Files defining MangaEntity:"
grep -l "MangaEntity" --include="*.ts" --include="*.tsx" -r src/types 2>/dev/null | head -10

echo ""
echo "Files defining ChapterEntity:"
grep -l "ChapterEntity" --include="*.ts" --include="*.tsx" -r src/types 2>/dev/null | head -10

echo ""
echo "2. TYPE IMPORT SOURCES"
echo "----------------------"
echo "Imports from @/types/domain:"
grep -h "from '@/types/domain" --include="*.ts" --include="*.tsx" -r src | wc -l | xargs echo "  Count:"

echo "Imports from @/types/canonical:"
grep -h "from '@/types/canonical" --include="*.ts" --include="*.tsx" -r src | wc -l | xargs echo "  Count:"

echo "Imports from ../domain:"
grep -h "from '\.\./domain" --include="*.ts" --include="*.tsx" -r src | wc -l | xargs echo "  Count:"

echo ""
echo "3. CIRCULAR DEPENDENCIES"
echo "------------------------"
echo "Files importing from index.ts:"
grep -l "from '@/types/canonical'" --include="*.ts" --include="*.tsx" -r src/types/canonical 2>/dev/null | head -5

echo ""
echo "4. TYPE CONFLICTS"
echo "-----------------"
echo "Multiple MangaStatus definitions:"
grep -l "enum MangaStatus\|export.*MangaStatus" --include="*.ts" -r src | head -10

echo ""
echo "5. MISSING TYPE EXPORTS"
echo "------------------------"
bunx tsc --noEmit 2>&1 | grep "TS2305" | grep -oE "'[^']+'" | sort | uniq | head -20

echo ""
echo "6. TYPE FILE STATISTICS"
echo "------------------------"
echo "Total .ts files: $(find src -name "*.ts" | wc -l)"
echo "Total .tsx files: $(find src -name "*.tsx" | wc -l)"
echo "Files in types/: $(find src/types -name "*.ts" | wc -l)"
echo "Files in types/canonical/: $(find src/types/canonical -name "*.ts" | wc -l)"
echo "Files in types/domain/: $(find src/types/domain -name "*.ts" 2>/dev/null | wc -l)"

echo ""
echo "7. ERROR DISTRIBUTION BY FILE"
echo "------------------------------"
bunx tsc --noEmit 2>&1 | grep "error TS" | cut -d'(' -f1 | sort | uniq -c | sort -rn | head -10