#!/bin/bash

echo "🔧 Removing duplicate imports..."

files=(
  "src/api/base/MetadataProvider.ts"
  "src/api/metadataProviders/adapters/anilistAdapter.ts"
  "src/api/metadataProviders/adapters/comicvineAdapter.ts"
  "src/api/metadataProviders/adapters/fandomAdapter.ts"
  "src/api/metadataProviders/adapters/unifiedParserAdapter.ts"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    # Remove the duplicate import added at line 1
    sed -i '' '1d' "$file" 2>/dev/null || true
    echo "  Fixed: $file"
  fi
done

echo "✅ Duplicate imports removed!"
