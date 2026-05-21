#!/bin/bash

# Comprehensive Import Fix Script
# This script fixes all malformed imports and syntax errors in TypeScript files

echo "🔧 Starting comprehensive import fix..."

# Function to fix a single file
fix_file() {
  local file="$1"
  
  if [ ! -f "$file" ]; then
    return
  fi
  
  # Create backup
  cp "$file" "$file.bak-$(date +%s)"
  
  # Fix malformed export type statements
  sed -i '' -E 's/export type \{ import \{ \} from [^;]+;/export type {/' "$file"
  
  # Fix malformed import statements with hanging identifiers
  sed -i '' -E 's/^([[:space:]]*)import \{ ([^}]+) \} from '\''@\/utils\/async'\'';/\1/' "$file"
  
  # Fix import statements that have been split incorrectly
  sed -i '' -E 's/import \{[[:space:]]*import \{/import {/' "$file"
  
  # Fix double imports on same line
  sed -i '' -E 's/} from[^;]+;[[:space:]]*import \{/, /' "$file"
  
  # Fix @/types/canonical imports to use relative paths
  sed -i '' -E "s|from '@/types/canonical'|from '../../types/canonical'|g" "$file"
  sed -i '' -E "s|from \"@/types/canonical\"|from '../../types/canonical'|g" "$file"
  
  # Fix @/utils/async imports to use relative paths
  sed -i '' -E "s|from '@/utils/async'|from '../../utils/async-result'|g" "$file"
  sed -i '' -E "s|from \"@/utils/async\"|from '../../utils/async-result'|g" "$file"
  
  # Fix hanging export statements
  sed -i '' -E 's/^([[:space:]]*)export type \{ ([^}]*) \} from '\''\.\/types'\'';/\1export type { \2 };/' "$file"
  
  # Remove empty import statements
  sed -i '' -E 's/import \{\s*\} from [^;]+;//g' "$file"
  
  # Fix malformed destructuring in function parameters
  sed -i '' -E 's/import \{ ([^}]+) \}\}: ([^)]+)\)/\1}: \2)/' "$file"
  
  echo "✅ Fixed: $file"
}

# Files to fix
FILES=(
  "src/api/metadataProviders/adapters/__tests__/suwayomiAdapter.test.ts"
  "src/api/metadataProviders/anilist/__tests__/pagination.test.ts"
  "src/api/metadataProviders/anilist/__tests__/sorting.test.ts"
  "src/api/metadataProviders/anilistClient.ts"
  "src/api/metadataProviders/fandomClient.ts"
  "src/api/notifications/index.ts"
  "src/api/utils/errorHandling.ts"
  "src/api/utils/index.ts"
  "src/components/addLibrary.tsx"
  "src/components/addManga/AddMangaModal.tsx"
  "src/components/addManga/components/core/ProviderBadge.tsx"
  "src/components/addManga/components/display/MetadataPreview.tsx"
  "src/components/addManga/components/display/ProviderResults.tsx"
  "src/components/addManga/components/display/VolumeChapterTable.tsx"
  "src/components/addManga/components/fields/FieldSelector.tsx"
  "src/components/addManga/components/index.ts"
  "src/components/addManga/components/media/BannerGallery.tsx"
  "src/components/addManga/components/media/ChapterCoversGallery.tsx"
  "src/components/addManga/components/media/ImageGallery.tsx"
  "src/components/addManga/components/media/VolumeCoversGallery.tsx"
)

# Process each file
for file in "${FILES[@]}"; do
  fix_file "$file"
done

echo "📊 Done! Run 'bun run type-check' to verify fixes"
