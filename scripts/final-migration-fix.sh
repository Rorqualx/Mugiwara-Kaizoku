#!/bin/bash

echo "🚀 Final migration fixes..."

# Step 1: Fix all remaining object literal syntax errors
echo "Step 1: Fixing object literal syntax errors..."

# Find all TypeScript files and fix chapter.number in object literals
find src -name "*.ts" -o -name "*.tsx" | while read file; do
  # Fix object property definitions that were incorrectly changed
  # Pattern: something.number: value -> something.number: value (leave alone)
  # Pattern: chapter.number: value -> chapterNumber: value (already done)
  
  # Fix any remaining chapter.number that should be accessing a property
  if grep -q "c.number === chapter.number" "$file" 2>/dev/null; then
    sed -i '' 's/c\.number === chapter\.number/c.number === chapterNumber/g' "$file" 2>/dev/null || true
  fi
done

echo "✅ Final fixes complete!"
