#!/bin/bash
###############################################################################
# Comprehensive Pattern Fix Script
# Find and fix remaining easy patterns across the codebase
###############################################################################

set -e

echo "🔧 Starting comprehensive pattern cleanup..."
echo ""

files=$(find src -type f \( -name "*.ts" -o -name "*.tsx" \) ! -name "*.test.*" ! -path "*/node_modules/*" ! -path "*/.next/*")

# Pattern: Remove ?? null where it's clearly redundant (at end of chains)
echo "🔍 Pattern 1: Simplifying ?? null at end of statements"
echo "$files" | xargs -I {} perl -i -pe 's/(\w+(?:\.\w+|\?\.\w+)*)\s+\?\?\s+null\s*([;,\)])/$1$2/g' {}
echo "✅ Done"
echo ""

echo "═══════════════════════════════════════"
echo "✨ Pattern cleanup complete!"
echo "═══════════════════════════════════════"
