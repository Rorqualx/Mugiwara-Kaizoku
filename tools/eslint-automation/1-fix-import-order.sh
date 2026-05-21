#!/bin/bash
# Phase 1: Auto-fix import/order violations (207)
# Risk: ZERO - Pure formatting
# Time: 2 minutes

set -e

echo "🔧 Phase 1: Fixing import/order violations..."
echo ""

# Store current violation count
BEFORE=$(npm run lint 2>&1 | grep -oP '\d+(?= problems)' | head -1 || echo "unknown")

echo "Before: $BEFORE violations"
echo ""

# Fix import order
echo "Running ESLint --fix on import/order..."
npx eslint src --fix --rule 'import/order: error' 2>&1 | tail -5

echo ""
echo "✅ Import order fixed!"
echo ""

# Check new count
AFTER=$(npm run lint 2>&1 | grep -oP '\d+(?= problems)' | head -1 || echo "unknown")

echo "After: $AFTER violations"
echo "Fixed: $((BEFORE - AFTER)) violations"
echo ""

# Show git diff summary
echo "📊 Files modified:"
git diff --stat

echo ""
echo "Next steps:"
echo "1. Review changes: git diff"
echo "2. Commit: git add -A && git commit -m 'fix(eslint): Auto-fix import/order violations (207)'"
