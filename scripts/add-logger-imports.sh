#!/bin/bash
# Add Logger Imports Script
# Week 1 Day 2 - Technical Debt Resolution
#
# Automatically adds logger imports to files that use logger but don't import it

echo "🔍 Finding files that need logger imports..."

COUNT=0

# Find TypeScript files that use logger but don't import it
while IFS= read -r file; do
  # Skip if file already imports logger
  if grep -q "import.*logger.*from.*logger" "$file" || grep -q "import.*{.*logger.*}.*from" "$file"; then
    continue
  fi

  # Skip test files for now
  if [[ "$file" == *.test.* ]] || [[ "$file" == *__tests__* ]]; then
    continue
  fi

  # Add import at the top of the file (after existing imports)
  # Find the last import line
  LAST_IMPORT_LINE=$(grep -n "^import" "$file" | tail -1 | cut -d: -f1)

  if [ -n "$LAST_IMPORT_LINE" ]; then
    # Insert after last import
    sed -i '' "${LAST_IMPORT_LINE}a\\
import { logger } from '@/utils/logger';
" "$file"
    echo "  ✅ Added logger import to: $file"
    COUNT=$((COUNT + 1))
  else
    # No imports yet, add at the beginning
    sed -i '' "1i\\
import { logger } from '@/utils/logger';\\

" "$file"
    echo "  ✅ Added logger import to: $file (at top)"
    COUNT=$((COUNT + 1))
  fi
done < <(grep -rl "logger\.(info|debug|warn|error)" src/ 2>/dev/null | grep -E '\.(ts|tsx)$' | grep -v "logger.ts" | grep -v ".test." | grep -v "__tests__")

echo ""
echo "📊 Added logger imports to $COUNT files"
echo ""
echo "Next: Run 'bun run lint --fix' to organize imports"
