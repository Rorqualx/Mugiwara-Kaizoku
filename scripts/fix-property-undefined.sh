#!/bin/bash
###############################################################################
# Property Undefined Cleanup Script
# Phase 2: Remove ?? undefined from object property assignments
#
# This script fixes patterns like:
# - property: value ?? undefined  →  property: value
#
# In object literal assignments, ?? undefined is redundant because undefined
# is the natural default when a value is not provided.
#
# Fixes no-unnecessary-condition violations
###############################################################################

set -e

echo "🔧 Starting property undefined cleanup..."
echo ""

# Find all TypeScript files in src directory
echo "📂 Finding TypeScript files..."
files=$(find src -type f \( -name "*.ts" -o -name "*.tsx" \) ! -name "*.test.*" ! -path "*/node_modules/*" ! -path "*/.next/*")
file_count=$(echo "$files" | wc -l)
echo "✅ Found $file_count TypeScript files"
echo ""

# Pattern: property: value ?? undefined (in object literals)
echo "🔍 Removing '?? undefined' from object property assignments"
# Match patterns like: property: expression ?? undefined,
# where the undefined is followed by comma or closing brace
echo "$files" | xargs -I {} perl -i -pe 's/:\s*([^,}]+)\s*\?\?\s*undefined(?=[,}])/:  $1/g' {}
echo "✅ Done"
echo ""

echo "═══════════════════════════════════════"
echo "✨ Property undefined cleanup complete!"
echo "═══════════════════════════════════════"
echo ""
echo "Next steps:"
echo "1. Review changes: git diff --stat"
echo "2. Check specific files: git diff src/path/to/file.ts"
echo "3. Run type check: bun run type-check"
echo ""
