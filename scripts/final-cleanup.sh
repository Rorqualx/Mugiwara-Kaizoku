#!/bin/bash

echo "🚀 Final cleanup of MangaStatus references..."

# Step 1: Replace remaining MangaStatus with MangaPublicationStatus
echo "Step 1: Replacing remaining MangaStatus references..."
find src -name "*.ts" -o -name "*.tsx" | while read file; do
  # Skip files that already have the correct import
  if grep -q "MangaPublicationStatus" "$file" 2>/dev/null; then
    # Replace MangaStatus that isn't part of MangaPublicationStatus
    sed -i '' 's/\([^n]\)MangaStatus\b/\1MangaPublicationStatus/g' "$file" 2>/dev/null || true
    sed -i '' 's/^MangaStatus\b/MangaPublicationStatus/g' "$file" 2>/dev/null || true
  else
    # Simple replacement for files without any status references yet
    sed -i '' 's/\bMangaStatus\b/MangaPublicationStatus/g' "$file" 2>/dev/null || true
  fi
done

# Step 2: Remove duplicate enum definitions
echo "Step 2: Removing duplicate MangaStatus enum definitions..."
files=(
  "src/types/canonical/status.types.ts"
  "src/types/prisma-exports.ts"
  "src/server/parsers/core/DataNormalizer.ts"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    # Remove enum MangaStatus blocks
    sed -i '' '/^export enum MangaStatus {/,/^}/d' "$file" 2>/dev/null || true
    sed -i '' '/^enum MangaStatus {/,/^}/d' "$file" 2>/dev/null || true
    echo "  Cleaned: $file"
  fi
done

# Step 3: Fix imports in files that need it
echo "Step 3: Fixing imports..."
files_needing_import=(
  "src/types/canonical/status.types.ts"
  "src/types/prisma-exports.ts"
  "src/server/parsers/core/DataNormalizer.ts"
  "src/server/parsers/utils/typeConverters.ts"
)

for file in "${files_needing_import[@]}"; do
  if [ -f "$file" ]; then
    if ! grep -q "import.*MangaPublicationStatus.*from" "$file" 2>/dev/null; then
      # Add import at the top after first import or at beginning
      sed -i '' '1a\
import { MangaPublicationStatus } from "@/types/canonical/shared-types";
' "$file" 2>/dev/null || true
      echo "  Added import to: $file"
    fi
  fi
done

# Step 4: Remove backward compatibility exports
echo "Step 4: Removing backward compatibility exports..."
sed -i '' '/export type { MangaStatus }/d' src/types/canonical/manga.types.ts 2>/dev/null || true
sed -i '' '/export { MangaStatus }/d' src/types/clientTypes.ts 2>/dev/null || true

echo "✅ Final cleanup complete!"
