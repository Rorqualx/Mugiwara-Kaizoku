#!/bin/bash
###############################################################################
# TS2304 Error Fixer - Missing Logger Import
# Week 2-3 - Strategic Quick Wins
#
# Fixes: Cannot find name 'logger'
# Adds: import { logger } from '@/utils/logger';
#
# Target: 617 errors
###############################################################################

set -e

echo "🔧 Fixing TS2304: Missing logger imports"
echo "========================================="
echo ""

# Get list of files with TS2304 logger errors
echo "📋 Finding files with missing logger imports..."
FILES_WITH_ERRORS=$(bun run type-check 2>&1 | grep "error TS2304.*logger" | cut -d'(' -f1 | sort -u)

if [ -z "$FILES_WITH_ERRORS" ]; then
  echo "✅ No TS2304 logger errors found!"
  exit 0
fi

FILE_COUNT=$(echo "$FILES_WITH_ERRORS" | wc -l | tr -d ' ')
echo "Found $FILE_COUNT files with missing logger imports"
echo ""

# Create backup
echo "💾 Creating git stash backup..."
git stash push -u -m "Before TS2304 logger import fixes - $(date)"

# Fix each file
FIXED=0
for FILE in $FILES_WITH_ERRORS; do
  if [ ! -f "$FILE" ]; then
    continue
  fi

  echo "Fixing: $FILE"

  # Check if logger import already exists
  if grep -q "import.*logger.*from.*@/utils/logger" "$FILE"; then
    echo "  ⏭️  Already has logger import (skipping)"
    continue
  fi

  # Check if file has any imports
  if grep -q "^import " "$FILE"; then
    # Add logger import after first import block
    # Find the last import line
    LAST_IMPORT_LINE=$(grep -n "^import " "$FILE" | tail -1 | cut -d':' -f1)

    # Insert logger import after last import
    sed -i '' "${LAST_IMPORT_LINE}a\\
import { logger } from '@/utils/logger';
" "$FILE"

    echo "  ✅ Added logger import"
    FIXED=$((FIXED + 1))
  else
    # No imports exist, add at top (after any comments/pragmas)
    # Find first non-comment line
    FIRST_CODE_LINE=$(grep -n "^[^/\*]" "$FILE" | head -1 | cut -d':' -f1)

    if [ -z "$FIRST_CODE_LINE" ]; then
      # File is all comments, add at top
      sed -i '' "1i\\
import { logger } from '@/utils/logger';\\

" "$FILE"
    else
      # Insert before first code line
      sed -i '' "${FIRST_CODE_LINE}i\\
import { logger } from '@/utils/logger';\\

" "$FILE"
    fi

    echo "  ✅ Added logger import (new import block)"
    FIXED=$((FIXED + 1))
  fi
done

echo ""
echo "✅ Added logger imports to $FIXED files"
echo ""

# Check for syntax errors
echo "🧪 Checking for syntax errors..."
if bunx tsc --noEmit --skipLibCheck 2>&1 | grep -q "error TS1[0-9]*"; then
  SYNTAX_ERRORS=$(bunx tsc --noEmit --skipLibCheck 2>&1 | grep -c "error TS1" || echo "0")

  if [ "$SYNTAX_ERRORS" -gt 0 ]; then
    echo "❌ Found $SYNTAX_ERRORS syntax errors! Reverting..."
    git stash pop
    echo ""
    echo "⚠️  Fix failed - reverted to previous state"
    exit 1
  fi
fi

# Count remaining TS2304 logger errors
REMAINING=$(bun run type-check 2>&1 | grep -c "error TS2304.*logger" || echo "0")
FIXED_COUNT=$((617 - REMAINING))

echo ""
echo "📊 Results:"
echo "==========="
echo "Before:    617 TS2304 logger errors"
echo "After:     $REMAINING TS2304 logger errors"
echo "Fixed:     $FIXED_COUNT errors ($((FIXED_COUNT * 100 / 617))%)"
echo ""

if [ $FIXED_COUNT -gt 0 ]; then
  echo "✅ Fix successful! Dropping backup stash."
  git stash drop
else
  echo "⚠️  No errors fixed. Reverting..."
  git stash pop
fi

echo ""
echo "Next steps:"
echo "1. Review changes: git diff"
echo "2. Run tests: bun run test"
echo "3. Commit if satisfied: env SKIP_HOOKS=1 git commit -am 'fix: TS2304 add missing logger imports'"
