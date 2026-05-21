#!/bin/bash
###############################################################################
# Redundant Type Cast Cleanup Script
# Phase 2: Remove redundant 'as unknown' intermediate casts
#
# This script fixes:
# - value as unknown as Record<string, unknown>  →  value as Record<string, unknown>
#
# When value is already typed as 'unknown', the intermediate 'as unknown' is redundant
#
# Fixes no-unnecessary-condition violations caused by unnecessary type assertions
###############################################################################

set -e

echo "🔧 Starting redundant cast cleanup..."
echo ""

# Find all TypeScript files in src directory
echo "📂 Finding TypeScript files..."
files=$(find src -type f \( -name "*.ts" -o -name "*.tsx" \) ! -name "*.test.*" ! -path "*/node_modules/*" ! -path "*/.next/*")
file_count=$(echo "$files" | wc -l)
echo "✅ Found $file_count TypeScript files"
echo ""

# Pattern: as unknown as Record<string, unknown>
echo "🔍 Removing redundant 'as unknown as Record<string, unknown>'"
echo "$files" | xargs -I {} perl -i -pe 's/as unknown as Record<string, unknown>/as Record<string, unknown>/g' {}
echo "✅ Done"
echo ""

# Pattern: as unknown as Record<K, V> (generic)
echo "🔍 Removing redundant 'as unknown as Record<...>'"
echo "$files" | xargs -I {} perl -i -pe 's/as unknown as Record</as Record</g' {}
echo "✅ Done"
echo ""

echo "═══════════════════════════════════════"
echo "✨ Redundant cast cleanup complete!"
echo "═══════════════════════════════════════"
echo ""
echo "Next steps:"
echo "1. Review changes: git diff --stat"
echo "2. Check specific files: git diff src/path/to/file.ts"
echo "3. Run type check: bun run type-check"
echo ""
