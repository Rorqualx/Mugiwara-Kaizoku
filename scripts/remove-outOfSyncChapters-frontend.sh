#!/bin/bash

# Script to remove outOfSyncChapters references from frontend code
# Part of the migration from Task/OutOfSyncChapter to Job system

echo "Removing outOfSyncChapters references from frontend files..."

# Remove outOfSyncChapters from MangaWithRelations type definitions
find src -name "*.ts" -o -name "*.tsx" | xargs grep -l "outOfSyncChapters: true" | while read file; do
  echo "Updating $file - removing outOfSyncChapters from includes..."
  sed -i '' '/outOfSyncChapters: true/d' "$file"
done

# Remove outOfSyncChapters property assignments (set to empty array)
find src -name "*.ts" -o -name "*.tsx" | xargs grep -l "outOfSyncChapters: \[\]" | while read file; do
  echo "Updating $file - removing outOfSyncChapters empty array assignments..."
  sed -i '' '/outOfSyncChapters: \[\],$/d' "$file"
  sed -i '' '/outOfSyncChapters: \[\]$/d' "$file"
done

# Remove outOfSyncChapters from state interfaces
find src -name "*.ts" -o -name "*.tsx" | xargs grep -l "outOfSyncChapters:" | while read file; do
  echo "Checking $file for outOfSyncChapters in interfaces..."
  # Remove lines that define outOfSyncChapters in interfaces
  sed -i '' '/^[[:space:]]*outOfSyncChapters: Record<.*>;.*$/d' "$file"
  sed -i '' '/^[[:space:]]*outOfSyncChapters: Chapter\[\];.*$/d' "$file"
  sed -i '' '/^[[:space:]]*outOfSyncChapters: any\[\];.*$/d' "$file"
  sed -i '' '/^[[:space:]]*outOfSyncChapters\?:/d' "$file"
done

# Remove outOfSyncChapters from destructuring
find src -name "*.ts" -o -name "*.tsx" | xargs grep -l "{ *outOfSyncChapters" | while read file; do
  echo "Updating $file - removing outOfSyncChapters from destructuring..."
  # Remove outOfSyncChapters from destructuring patterns
  sed -i '' 's/, *outOfSyncChapters//g' "$file"
  sed -i '' 's/outOfSyncChapters, *//g' "$file"
done

# Remove outOfSyncChapters property access
find src -name "*.ts" -o -name "*.tsx" | xargs grep -l "\.outOfSyncChapters" | while read file; do
  echo "Checking $file for outOfSyncChapters property access..."
  # Comment out lines that only check outOfSyncChapters length
  sed -i '' 's/\(.*\)\.outOfSyncChapters\.length/\/\/ Out-of-sync now tracked via Job system - \1/' "$file"
  # Replace hasOutOfSyncChapters checks with false
  sed -i '' 's/hasOutOfSyncChapters(.*)/false/' "$file"
done

# Remove addOutOfSyncChapters and removeOutOfSyncChapters function calls
find src -name "*.ts" -o -name "*.tsx" | xargs grep -l "addOutOfSyncChapters\|removeOutOfSyncChapters" | while read file; do
  echo "Updating $file - removing add/removeOutOfSyncChapters calls..."
  # Comment out these function calls
  sed -i '' 's/^[[:space:]]*addOutOfSyncChapters/\/\/ Out-of-sync now tracked via Job system - addOutOfSyncChapters/' "$file"
  sed -i '' 's/^[[:space:]]*removeOutOfSyncChapters/\/\/ Out-of-sync now tracked via Job system - removeOutOfSyncChapters/' "$file"
done

# Update syncSlice.ts specifically
if [ -f "src/store/syncSlice.ts" ]; then
  echo "Updating src/store/syncSlice.ts..."
  # Remove outOfSyncChapters from state
  sed -i '' '/outOfSyncChapters: Record<number, Chapter\[\]>/d' "src/store/syncSlice.ts"
  sed -i '' '/outOfSyncChapters: {},/d' "src/store/syncSlice.ts"
  # Comment out add/removeOutOfSyncChapters functions
  sed -i '' '/addOutOfSyncChapters: /,/^[[:space:]]*},$/s/^/\/\/ /' "src/store/syncSlice.ts"
  sed -i '' '/removeOutOfSyncChapters: /,/^[[:space:]]*},$/s/^/\/\/ /' "src/store/syncSlice.ts"
fi

# Update useFilteredManga.ts hook
if [ -f "src/hooks/useFilteredManga.ts" ]; then
  echo "Updating src/hooks/useFilteredManga.ts..."
  # Remove hasOutOfSync filter logic
  sed -i '' 's/hasOutOfSync?: boolean;/\/\/ Out-of-sync now tracked via Job system/' "src/hooks/useFilteredManga.ts"
  # Replace outOfSyncChapters checks with empty array
  sed -i '' 's/hasOutOfSyncChapters(manga) && manga\.outOfSyncChapters/[]/' "src/hooks/useFilteredManga.ts"
fi

echo "Frontend cleanup complete!"
echo "Note: Some files may need manual review for complex outOfSyncChapters logic"
echo "Run 'bun run typecheck' to verify no TypeScript errors remain"