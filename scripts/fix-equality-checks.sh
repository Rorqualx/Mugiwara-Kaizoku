#!/bin/bash
###############################################################################
# Null/Undefined Equality Check Cleanup Script
# Phase 2: Simplify === null || === undefined checks
#
# This script fixes:
# - value === null || value === undefined  →  value == null
# - value === undefined || value === null  →  value == null
#
# The == null operator checks for both null and undefined, making explicit
# checks for both redundant
#
# Fixes no-unnecessary-condition violations
###############################################################################

set -e

echo "🔧 Starting equality check cleanup..."
echo ""

# Find all TypeScript files in src directory
echo "📂 Finding TypeScript files..."
files=$(find src -type f \( -name "*.ts" -o -name "*.tsx" \) ! -name "*.test.*" ! -path "*/node_modules/*" ! -path "*/.next/*")
file_count=$(echo "$files" | wc -l)
echo "✅ Found $file_count TypeScript files"
echo ""

# Pattern 1: value === null || value === undefined
echo "🔍 Pattern 1: Fixing 'value === null || value === undefined'"
echo "$files" | xargs -I {} perl -i -pe 's/\b(\w+(?:\[[^\]]+\])?(?:\.\w+|\?\.\w+)*)\s+===\s+null\s+\|\|\s+\1\s+===\s+undefined\b/$1 == null/g' {}
echo "✅ Done"
echo ""

# Pattern 2: value === undefined || value === null
echo "🔍 Pattern 2: Fixing 'value === undefined || value === null'"
echo "$files" | xargs -I {} perl -i -pe 's/\b(\w+(?:\[[^\]]+\])?(?:\.\w+|\?\.\w+)*)\s+===\s+undefined\s+\|\|\s+\1\s+===\s+null\b/$1 == null/g' {}
echo "✅ Done"
echo ""

echo "═══════════════════════════════════════"
echo "✨ Equality check cleanup complete!"
echo "═══════════════════════════════════════"
echo ""
echo "Next steps:"
echo "1. Review changes: git diff --stat"
echo "2. Check specific files: git diff src/path/to/file.ts"
echo "3. Run type check: bun run type-check"
echo ""
