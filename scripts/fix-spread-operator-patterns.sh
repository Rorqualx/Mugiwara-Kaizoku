#!/bin/bash
###############################################################################
# Spread Operator Pattern Cleanup Script
# Fix !== undefined && patterns in spread operators
#
# This script fixes patterns like:
# - ...(value !== undefined && { key: value })  →  ...(value != null && { key: value })
#
# Using != null is more concise and handles both null and undefined
#
# Fixes no-unnecessary-condition violations
###############################################################################

set -e

echo "🔧 Starting spread operator pattern cleanup..."
echo ""

# Find all TypeScript files in src directory
echo "📂 Finding TypeScript files..."
files=$(find src -type f \( -name "*.ts" -o -name "*.tsx" \) ! -name "*.test.*" ! -path "*/node_modules/*" ! -path "*/.next/*")
file_count=$(echo "$files" | wc -l)
echo "✅ Found $file_count TypeScript files"
echo ""

# Pattern: !== undefined && in spread operators
echo "🔍 Fixing '!== undefined &&' patterns"
echo "$files" | while read -r file; do
  perl -i -pe 's/!== undefined &&/!= null \&\&/g' "$file"
done
echo "✅ Done"
echo ""

echo "═══════════════════════════════════════"
echo "✨ Spread operator cleanup complete!"
echo "═══════════════════════════════════════"
echo ""
echo "Next steps:"
echo "1. Review changes: git diff --stat"
echo "2. Check specific files: git diff src/path/to/file.ts"
echo "3. Run type check: bun run type-check"
echo ""
