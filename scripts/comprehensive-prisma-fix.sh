#!/bin/bash

# Script to comprehensively fix Prisma enum imports
# Finds all files with enum errors and fixes them

echo "🔍 Finding all files with Prisma enum value usage errors..."

# Get list of all files with enum value usage errors
bunx tsc --noEmit 2>&1 | grep "cannot be used as a value" | sed "s/\(.*\.tsx*\).*/\1/" | sort -u > /tmp/enum-error-files.txt

echo "Found $(wc -l < /tmp/enum-error-files.txt) files with enum value usage"

# For each file, convert type imports back to regular imports for enums
while read -r file; do
  if [ -f "$file" ]; then
    # Check if file has import type from @prisma/client
    if grep -q "import type.*@prisma/client" "$file"; then
      echo "Fixing $file..."

      # Use sed to convert import type to import for Prisma client
      # This handles the case where enums are used as values
      sed -i '' 's/import type {\([^}]*\)} from '\''@prisma\/client'\''/import {\1} from '\''@prisma\/client'\''/g' "$file"
    fi
  fi
done < /tmp/enum-error-files.txt

echo "✅ Fixed all files with enum value usage"
echo ""
echo "🔍 Now checking for mixed imports that need separation..."

# Find files that have both Prisma imports and might need separation
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec grep -l "@prisma/client" {} \; | while read -r file; do
  # Check if file imports both Prisma (runtime) and enums
  if grep -q "import.*Prisma.*from.*@prisma/client" "$file" && grep -q "import.*\(Status\|Type\|Role\).*from.*@prisma/client" "$file"; then
    echo "Checking $file for mixed imports..."
    # This file might need manual review
    echo "  - May need manual review: $file"
  fi
done

echo ""
echo "✨ Done! Running TypeScript check to verify..."
bunx tsc --noEmit 2>&1 | head -5

ERROR_COUNT=$(bunx tsc --noEmit 2>&1 | wc -l)
echo ""
echo "📊 Total TypeScript errors: $ERROR_COUNT"