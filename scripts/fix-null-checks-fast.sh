#!/bin/bash
###############################################################################
# Fast Automated Null Check Cleanup Script
# Phase 1, Step 2: Fix redundant null/undefined checks
#
# This script fixes the following patterns:
# 1. value !== undefined && value !== null  →  value != null
# 2. value !== null && value !== undefined  →  value != null
#
# Fixes approximately 600-800 no-unnecessary-condition violations
###############################################################################

set -e

echo "🔧 Starting null check cleanup..."
echo ""

# Find all TypeScript files in src directory
echo "📂 Finding TypeScript files..."
files=$(find src -type f \( -name "*.ts" -o -name "*.tsx" \) ! -name "*.test.*" ! -path "*/node_modules/*" ! -path "*/.next/*")
file_count=$(echo "$files" | wc -l)
echo "✅ Found $file_count TypeScript files"
echo ""

# Pattern 1: value !== undefined && value !== null
echo "🔍 Pattern 1: Fixing 'value !== undefined && value !== null'"
echo "$files" | xargs -I {} perl -i -pe 's/\b(\w+(?:\[[^\]]+\])?(?:\.\w+|\?\.\w+)*)\s+!==\s+undefined\s+&&\s+\1\s+!==\s+null\b/$1 != null/g' {}
echo "✅ Done"
echo ""

# Pattern 2: value !== null && value !== undefined
echo "🔍 Pattern 2: Fixing 'value !== null && value !== undefined'"
echo "$files" | xargs -I {} perl -i -pe 's/\b(\w+(?:\[[^\]]+\])?(?:\.\w+|\?\.\w+)*)\s+!==\s+null\s+&&\s+\1\s+!==\s+undefined\b/$1 != null/g' {}
echo "✅ Done"
echo ""

# Pattern 3: value != undefined && value != null (loose equality)
echo "🔍 Pattern 3: Fixing 'value != undefined && value != null'"
echo "$files" | xargs -I {} perl -i -pe 's/\b(\w+(?:\[[^\]]+\])?(?:\.\w+|\?\.\w+)*)\s+!=\s+undefined\s+&&\s+\1\s+!=\s+null\b/$1 != null/g' {}
echo "✅ Done"
echo ""

# Pattern 4: value != null && value != undefined
echo "🔍 Pattern 4: Fixing 'value != null && value != undefined'"
echo "$files" | xargs -I {} perl -i -pe 's/\b(\w+(?:\[[^\]]+\])?(?:\.\w+|\?\.\w+)*)\s+!=\s+null\s+&&\s+\1\s+!=\s+undefined\b/$1 != null/g' {}
echo "✅ Done"
echo ""

echo "═══════════════════════════════════════"
echo "✨ Null check cleanup complete!"
echo "═══════════════════════════════════════"
echo ""
echo "Next steps:"
echo "1. Review changes: git diff --stat"
echo "2. Review specific files: git diff src/path/to/file.ts"
echo "3. Run type check: bun run type-check"
echo ""
