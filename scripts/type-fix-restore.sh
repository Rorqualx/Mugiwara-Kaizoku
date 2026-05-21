#!/bin/bash
# Type Fix Restore Script - Restores from backup

if [ $# -eq 0 ]; then
    echo "Usage: $0 <backup_directory>"
    echo ""
    echo "Available backups:"
    ls -d .type-fix-backups/backup_* 2>/dev/null || echo "No backups found"
    exit 1
fi

BACKUP_DIR="$1"

if [ ! -d "$BACKUP_DIR" ]; then
    echo "Error: Backup directory not found: $BACKUP_DIR"
    exit 1
fi

echo "Restoring from backup: $BACKUP_DIR"

# Restore each file
for file in $(find "$BACKUP_DIR" -type f -name "*.ts" -o -name "*.tsx"); do
    # Get relative path by removing backup directory prefix
    relative_path=${file#$BACKUP_DIR/}
    
    if [ -f "$relative_path" ]; then
        cp "$file" "$relative_path"
        echo "Restored: $relative_path"
    fi
done

# Show previous error count
if [ -f "$BACKUP_DIR/error_count.txt" ]; then
    echo ""
    echo "Previous error count: $(cat "$BACKUP_DIR/error_count.txt")"
fi

echo ""
echo "Restore complete. Running type check..."
bunx tsc --noEmit 2>&1 | grep "error TS" | wc -l | xargs echo "Current error count:"