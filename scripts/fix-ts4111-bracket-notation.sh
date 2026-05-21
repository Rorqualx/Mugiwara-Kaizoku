#!/bin/bash
###############################################################################
# TS4111 Error Fixer - Bracket Notation for Index Signatures
# Week 2-3 - Strategic Quick Wins
#
# Fixes: Property 'X' comes from an index signature, so it must be accessed with ['X']
# Example: obj.default → obj['default']
#
# Target: 6,100 errors
###############################################################################

set -e

echo "🔧 Fixing TS4111: Property comes from index signature"
echo "======================================================"
echo ""

# Get list of files with TS4111 errors
echo "📋 Finding files with TS4111 errors..."
FILES_WITH_ERRORS=$(bun run type-check 2>&1 | grep "error TS4111" | cut -d'(' -f1 | sort -u)

if [ -z "$FILES_WITH_ERRORS" ]; then
  echo "✅ No TS4111 errors found!"
  exit 0
fi

FILE_COUNT=$(echo "$FILES_WITH_ERRORS" | wc -l | tr -d ' ')
echo "Found $FILE_COUNT files with TS4111 errors"
echo ""

# Create backup
echo "💾 Creating git stash backup..."
git stash push -u -m "Before TS4111 bracket notation fixes - $(date)"

# Common patterns that need bracket notation
PATTERNS=(
  "\.default"
  "\.Provider"
  "\.Consumer"
  "\.displayName"
)

# Pattern 1: Fix .default property access
echo "🔨 Pattern 1: Fixing .default access..."
find src/ -type f \( -name "*.ts" -o -name "*.tsx" \) ! -name "*.test.*" \
  -exec sed -i '' 's/\([a-zA-Z_][a-zA-Z0-9_]*\)\.default\([^a-zA-Z0-9_]\)/\1["default"]\2/g' {} \;

# Pattern 2: Fix .Provider property access
echo "🔨 Pattern 2: Fixing .Provider access..."
find src/ -type f \( -name "*.ts" -o -name "*.tsx" \) ! -name "*.test.*" \
  -exec sed -i '' 's/\([a-zA-Z_][a-zA-Z0-9_]*\)\.Provider\([^a-zA-Z0-9_]\)/\1["Provider"]\2/g' {} \;

# Pattern 3: Fix .Consumer property access
echo "🔨 Pattern 3: Fixing .Consumer access..."
find src/ -type f \( -name "*.ts" -o -name "*.tsx" \) ! -name "*.test.*" \
  -exec sed -i '' 's/\([a-zA-Z_][a-zA-Z0-9_]*\)\.Consumer\([^a-zA-Z0-9_]\)/\1["Consumer"]\2/g' {} \;

# Pattern 4: Fix .displayName property access
echo "🔨 Pattern 4: Fixing .displayName access..."
find src/ -type f \( -name "*.ts" -o -name "*.tsx" \) ! -name "*.test.*" \
  -exec sed -i '' 's/\([a-zA-Z_][a-zA-Z0-9_]*\)\.displayName\([^a-zA-Z0-9_]\)/\1["displayName"]\2/g' {} \;

echo ""
echo "✅ Bulk replacements complete!"
echo ""

# Check for syntax errors
echo "🧪 Checking for syntax errors..."
if bunx tsc --noEmit --skipLibCheck 2>&1 | grep -q "error TS[0-9]*"; then
  SYNTAX_ERRORS=$(bunx tsc --noEmit --skipLibCheck 2>&1 | grep -c "error TS1" || echo "0")

  if [ "$SYNTAX_ERRORS" -gt 0 ]; then
    echo "❌ Found $SYNTAX_ERRORS syntax errors! Reverting..."
    git stash pop
    echo ""
    echo "⚠️  Fix failed - reverted to previous state"
    echo "Manual intervention needed for some patterns"
    exit 1
  fi
fi

# Count remaining TS4111 errors
REMAINING=$(bun run type-check 2>&1 | grep -c "error TS4111" || echo "0")
FIXED=$((6100 - REMAINING))

echo ""
echo "📊 Results:"
echo "==========="
echo "Before:    6,100 TS4111 errors"
echo "After:     $REMAINING TS4111 errors"
echo "Fixed:     $FIXED errors ($((FIXED * 100 / 6100))%)"
echo ""

if [ $FIXED -gt 0 ]; then
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
echo "3. Commit if satisfied: git commit -am 'fix: TS4111 bracket notation for index signatures'"
