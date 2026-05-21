#!/bin/bash
###############################################################################
# Array.isArray Redundant Check Cleanup Script
# Fix redundant truthiness checks before Array.isArray()
#
# This script fixes patterns like:
# - if (value && Array.isArray(value))  →  if (Array.isArray(value))
#
# Array.isArray() already returns false for null/undefined, so the truthiness
# check is redundant and causes unnecessary-condition violations.
#
# Fixes no-unnecessary-condition violations
###############################################################################

set -e

echo "🔧 Starting Array.isArray redundant check cleanup..."
echo ""

# Find all TypeScript files in src directory
echo "📂 Finding TypeScript files..."
files=$(find src -type f \( -name "*.ts" -o -name "*.tsx" \))
file_count=$(echo "$files" | wc -l)
echo "✅ Found $file_count TypeScript files"
echo ""

# Pattern: value && Array.isArray(value)
echo "🔍 Fixing 'value && Array.isArray(value)' patterns"
echo "$files" | while read -r file; do
  # Match: (variableName) && Array.isArray(\1)
  perl -i -pe 's/\b(\w+)\s+&&\s+Array\.isArray\(\1\)/Array.isArray($1)/g' "$file"
done
echo "✅ Done"
echo ""

echo "═══════════════════════════════════════"
echo "✨ Array.isArray cleanup complete!"
echo "═══════════════════════════════════════"
echo ""
echo "Next steps:"
echo "1. Review changes: git diff --stat"
echo "2. Check specific files: git diff src/path/to/file.ts"
echo "3. Run type check: bun run type-check"
echo ""
