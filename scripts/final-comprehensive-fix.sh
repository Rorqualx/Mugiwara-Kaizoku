#!/bin/bash

echo "🚀 Final comprehensive migration fix..."

# Step 1: Remove ALL duplicate MangaPublicationStatus enum declarations
echo "Step 1: Removing duplicate MangaPublicationStatus enums..."
files=(
  "src/api/base/MetadataProvider.ts"
  "src/api/metadataProviders/adapters/anilistAdapter.ts"
  "src/api/metadataProviders/adapters/comicvineAdapter.ts"
  "src/api/metadataProviders/adapters/fandomAdapter.ts"
  "src/api/metadataProviders/adapters/unifiedParserAdapter.ts"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    # Remove any local enum declarations but ensure import exists
    sed -i '' '/^export enum MangaPublicationStatus {/,/^}/d' "$file" 2>/dev/null || true
    sed -i '' '/^enum MangaPublicationStatus {/,/^}/d' "$file" 2>/dev/null || true
    
    # Ensure import exists
    if ! grep -q "import.*MangaPublicationStatus.*from.*canonical" "$file" 2>/dev/null; then
      # Add import at the top of the file after the first import statement
      sed -i '' '1a\
import { MangaPublicationStatus } from "@/types/canonical/shared-types";
' "$file" 2>/dev/null || true
    fi
    
    echo "  Fixed: $file"
  fi
done

# Step 2: Fix export type issues in base/index.ts
echo "Step 2: Fixing export type issues..."
if [ -f "src/api/base/index.ts" ]; then
  # Convert re-exports to use export type
  sed -i '' 's/export {/export type {/g' "src/api/base/index.ts" 2>/dev/null || true
  echo "  Fixed: src/api/base/index.ts"
fi

echo "✅ Final comprehensive fix complete!"
