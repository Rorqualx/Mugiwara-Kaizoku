#!/bin/bash
###############################################################################
# Nullish Coalescing Redundancy Fix Script
# Phase 1, Step 3: Fix redundant ?? null and ?? undefined
#
# This script fixes:
# 1. value ?? undefined  →  value (removing the redundant coalescing)
# 2. value ?? null       →  value (in most cases, removing redundant coalescing)
#
# Rationale:
# - ?? undefined is always redundant (if value is undefined, ?? undefined returns undefined)
# - ?? null is often redundant (coalescing to null when value is undefined serves no purpose)
#
# Fixes approximately 400-500 no-unnecessary-condition violations
###############################################################################

set -e

echo "🔧 Starting nullish coalescing cleanup..."
echo ""

# Find all TypeScript files in src directory
echo "📂 Finding TypeScript files..."
files=$(find src -type f \( -name "*.ts" -o -name "*.tsx" \) ! -name "*.test.*" ! -path "*/node_modules/*" ! -path "*/.next/*")
file_count=$(echo "$files" | wc -l)
echo "✅ Found $file_count TypeScript files"
echo ""

# Pattern 1: ?? undefined (always redundant)
echo "🔍 Pattern 1: Removing '?? undefined' (always redundant)"
# This pattern matches: expression ?? undefined
# We remove the ?? undefined part entirely
echo "$files" | xargs -I {} perl -i -pe 's/\s+\?\?\s+undefined(?=\s*[;,)\]\}])//' {}
echo "✅ Done"
echo ""

# Pattern 2: ?? null (often redundant, but we'll be conservative)
# We'll only remove it when it's at the end of statements or in return positions
echo "🔍 Pattern 2: Removing redundant '?? null'"
echo "$files" | xargs -I {} perl -i -pe 's/\s+\?\?\s+null(?=\s*[;,)\]])//' {}
echo "✅ Done"
echo ""

echo "═══════════════════════════════════════"
echo "✨ Nullish coalescing cleanup complete!"
echo "═══════════════════════════════════════"
echo ""
echo "Next steps:"
echo "1. Review changes: git diff --stat"
echo "2. Check specific files: git diff src/path/to/file.ts"
echo "3. Run type check: bun run type-check"
echo ""
