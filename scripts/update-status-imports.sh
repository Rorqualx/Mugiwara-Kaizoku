#!/bin/bash

# Script to update all MangaStatus imports to MangaPublicationStatus
# Date: August 30, 2025

echo "Updating MangaStatus imports to MangaPublicationStatus..."

# Update imports that import MangaStatus
find src -type f -name "*.ts" -o -name "*.tsx" | while read file; do
  # Update import statements
  sed -i '' "s/import.*{.*MangaStatus[^}]*}/&/g; s/MangaStatus,/MangaPublicationStatus,/g; s/MangaStatus }/MangaPublicationStatus }/g; s/ MangaStatus / MangaPublicationStatus /g" "$file"
  
  # Update MangaStatusValue to MangaPublicationStatusValue
  sed -i '' "s/MangaStatusValue/MangaPublicationStatusValue/g" "$file"
  
  # Update references to MangaStatus enum values
  sed -i '' "s/MangaStatus\./MangaPublicationStatus\./g" "$file"
  
  # Update type annotations from MangaStatus to MangaPublicationStatusValue
  sed -i '' "s/: MangaStatus\[\]/: MangaPublicationStatusValue\[\]/g" "$file"
  sed -i '' "s/: MangaStatus>/: MangaPublicationStatusValue>/g" "$file"
  sed -i '' "s/: MangaStatus |/: MangaPublicationStatusValue |/g" "$file"
done

echo "Update complete!"
echo "Files may need manual review for edge cases."