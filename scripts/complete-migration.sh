#!/bin/bash

echo "🚀 Completing final migration..."

# Step 1: Remove duplicate MangaPublicationStatus declarations in adapters
echo "Step 1: Removing duplicate MangaPublicationStatus declarations..."
files=(
  "src/api/base/MetadataProvider.ts"
  "src/api/metadataProviders/adapters/anilistAdapter.ts"
  "src/api/metadataProviders/adapters/comicvineAdapter.ts"
  "src/api/metadataProviders/adapters/fandomAdapter.ts"
  "src/api/metadataProviders/adapters/unifiedParserAdapter.ts"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    # Remove local enum declarations but keep imports
    sed -i '' '/^export enum MangaPublicationStatus {/,/^}/d' "$file" 2>/dev/null || true
    sed -i '' '/^enum MangaPublicationStatus {/,/^}/d' "$file" 2>/dev/null || true
    echo "  Cleaned: $file"
  fi
done

# Step 2: Fix string literals in baseKapowarrAdapter.ts
echo "Step 2: Fixing string literals in baseKapowarrAdapter..."
sed -i '' 's/status: "ONGOING"/status: MangaPublicationStatus.ONGOING/g' src/api/metadataProviders/adapters/baseKapowarrAdapter.ts 2>/dev/null || true

# Step 3: Fix ChapterStatus assignments to MangaPublicationStatus
echo "Step 3: Fixing ChapterStatus to MangaPublicationStatus mismatches..."
sed -i '' 's/status: ChapterStatus\.PENDING/status: MangaPublicationStatus.PENDING/g' src/api/metadataProviders/adapters/comicvineAdapter.ts 2>/dev/null || true
sed -i '' 's/status: ChapterStatus\.PENDING/status: MangaPublicationStatus.PENDING/g' src/api/metadataProviders/adapters/fandomAdapter.ts 2>/dev/null || true

# Step 4: Fix export type issues in base/index.ts
echo "Step 4: Fixing export type issues..."
sed -i '' 's/export type {/export {/g' src/api/base/index.ts 2>/dev/null || true

# Step 5: Fix string literals in validation files
echo "Step 5: Fixing string literals in validation files..."
validation_files=(
  "src/utils/validation/domain-guards.ts"
  "src/utils/validation/domain-type-guards.ts"
  "src/utils/validation/enhanced-type-guards.ts"
)

for file in "${validation_files[@]}"; do
  if [ -f "$file" ]; then
    # Replace string literals with enum values
    sed -i '' "s/'ONGOING'/MangaPublicationStatus.ONGOING/g" "$file" 2>/dev/null || true
    sed -i '' "s/'COMPLETED'/MangaPublicationStatus.COMPLETED/g" "$file" 2>/dev/null || true
    sed -i '' "s/'CANCELLED'/MangaPublicationStatus.CANCELLED/g" "$file" 2>/dev/null || true
    sed -i '' "s/'HIATUS'/MangaPublicationStatus.HIATUS/g" "$file" 2>/dev/null || true
    sed -i '' "s/'UNKNOWN'/MangaPublicationStatus.UNKNOWN/g" "$file" 2>/dev/null || true
    sed -i '' "s/'PENDING'/MangaPublicationStatus.PENDING/g" "$file" 2>/dev/null || true
    sed -i '' "s/'ACTIVE'/MangaPublicationStatus.ACTIVE/g" "$file" 2>/dev/null || true
    sed -i '' "s/'ERROR'/MangaPublicationStatus.ERROR/g" "$file" 2>/dev/null || true
    sed -i '' "s/'DELETED'/MangaPublicationStatus.DELETED/g" "$file" 2>/dev/null || true
    sed -i '' "s/'NOT_YET_PUBLISHED'/MangaPublicationStatus.NOT_YET_PUBLISHED/g" "$file" 2>/dev/null || true
    
    # Same for double quotes
    sed -i '' 's/"ONGOING"/MangaPublicationStatus.ONGOING/g' "$file" 2>/dev/null || true
    sed -i '' 's/"COMPLETED"/MangaPublicationStatus.COMPLETED/g' "$file" 2>/dev/null || true
    sed -i '' 's/"CANCELLED"/MangaPublicationStatus.CANCELLED/g' "$file" 2>/dev/null || true
    sed -i '' 's/"HIATUS"/MangaPublicationStatus.HIATUS/g' "$file" 2>/dev/null || true
    sed -i '' 's/"UNKNOWN"/MangaPublicationStatus.UNKNOWN/g' "$file" 2>/dev/null || true
    sed -i '' 's/"PENDING"/MangaPublicationStatus.PENDING/g' "$file" 2>/dev/null || true
    sed -i '' 's/"ACTIVE"/MangaPublicationStatus.ACTIVE/g' "$file" 2>/dev/null || true
    sed -i '' 's/"ERROR"/MangaPublicationStatus.ERROR/g' "$file" 2>/dev/null || true
    sed -i '' 's/"DELETED"/MangaPublicationStatus.DELETED/g' "$file" 2>/dev/null || true
    sed -i '' 's/"NOT_YET_PUBLISHED"/MangaPublicationStatus.NOT_YET_PUBLISHED/g' "$file" 2>/dev/null || true
    
    # Fix ChapterStatus literals
    sed -i '' 's/"UNAVAILABLE"/ChapterStatus.UNAVAILABLE/g' "$file" 2>/dev/null || true
    sed -i '' 's/"DOWNLOADING"/ChapterStatus.DOWNLOADING/g' "$file" 2>/dev/null || true
    sed -i '' 's/"DOWNLOADED"/ChapterStatus.DOWNLOADED/g' "$file" 2>/dev/null || true
    sed -i '' 's/"FAILED"/ChapterStatus.FAILED/g' "$file" 2>/dev/null || true
    sed -i '' 's/"MISSING"/ChapterStatus.MISSING/g' "$file" 2>/dev/null || true
    
    echo "  Fixed: $file"
  fi
done

echo "✅ Migration complete!"
