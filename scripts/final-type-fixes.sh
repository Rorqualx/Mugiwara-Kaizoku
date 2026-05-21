#!/bin/bash

echo "🔧 Applying final type fixes..."

# Step 1: Replace remaining MangaStatus references
echo "Step 1: Fixing remaining MangaStatus references..."
find src -name "*.ts" -not -path "*/archived-types-*" -not -path "*/.backup/*" | while read file; do
  # Replace MangaStatus with MangaPublicationStatus (excluding import statements)
  sed -i '' 's/\bMangaStatus\b/MangaPublicationStatus/g' "$file" 2>/dev/null || true
done

# Step 2: Fix AsyncResult generic parameters
echo "Step 2: Fixing AsyncResult type parameters..."
find src -name "*.ts" | while read file; do
  # Fix AsyncResult with single type parameter
  sed -i '' 's/AsyncResult<\([^,>]*\)>/AsyncResult<\1, Error>/g' "$file" 2>/dev/null || true
  # Remove duplicate Error parameters
  sed -i '' 's/, Error, Error>/, Error>/g' "$file" 2>/dev/null || true
  sed -i '' 's/, Error, Error, Error>/, Error>/g' "$file" 2>/dev/null || true
done

# Step 3: Fix undefined chapterNumber
echo "Step 3: Fixing undefined chapterNumber variables..."
find src -name "*.ts" | while read file; do
  # Replace standalone chapterNumber references
  if grep -q "Cannot find name 'chapterNumber'" "$file" 2>/dev/null; then
    sed -i '' 's/\bchapterNumber\b/chapter.number/g' "$file" 2>/dev/null || true
  fi
done

# Step 4: Clean up duplicate imports
echo "Step 4: Cleaning up duplicate imports..."
find src -name "*.ts" | while read file; do
  # Remove duplicate MangaPublicationStatus imports
  awk '!seen[$0]++ || !/import.*MangaPublicationStatus/' "$file" > "$file.tmp" && mv "$file.tmp" "$file" 2>/dev/null || true
done

# Step 5: Fix ChapterStatus enum values
echo "Step 5: Ensuring ChapterStatus values are correct..."
find src -name "*.ts" | while read file; do
  # Fix UNAVAILABLE -> MISSING for ChapterStatus
  sed -i '' 's/ChapterStatus\.UNAVAILABLE/ChapterStatus.MISSING/g' "$file" 2>/dev/null || true
done

echo "✅ Final type fixes applied!"
echo ""
echo "Next step: Run bun run type-check to verify"