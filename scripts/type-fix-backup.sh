#!/bin/bash
# Type Fix Backup Script - Creates backups before making type fixes

BACKUP_DIR=".type-fix-backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_SUBDIR="$BACKUP_DIR/backup_$TIMESTAMP"

# Create backup directory
mkdir -p "$BACKUP_SUBDIR"

# Files that will be modified
FILES_TO_BACKUP=(
    "src/types/canonical/index.ts"
    "src/types/canonical/provider.types.ts"
    "src/types/canonical/chapter.types.ts"
    "src/types/canonical/manga.types.ts"
    "src/types/canonical/calendar.types.ts"
    "src/types/extensions/comicvine.types.ts"
    "src/api/base/MetadataProvider.ts"
    "src/api/base/index.ts"
    "src/api/metadataProviders/comicvineClient.ts"
)

echo "Creating backup at $BACKUP_SUBDIR"

# Backup each file
for file in "${FILES_TO_BACKUP[@]}"; do
    if [ -f "$file" ]; then
        # Create directory structure in backup
        mkdir -p "$BACKUP_SUBDIR/$(dirname "$file")"
        cp "$file" "$BACKUP_SUBDIR/$file"
        echo "Backed up: $file"
    fi
done

# Save current TypeScript error count
echo "Counting current TypeScript errors..."
bunx tsc --noEmit 2>&1 | grep "error TS" | wc -l > "$BACKUP_SUBDIR/error_count.txt"

echo "Backup complete at: $BACKUP_SUBDIR"
echo "Error count saved to: $BACKUP_SUBDIR/error_count.txt"
echo ""
echo "To restore from this backup, run:"
echo "  ./scripts/type-fix-restore.sh $BACKUP_SUBDIR"