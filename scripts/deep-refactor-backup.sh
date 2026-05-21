#!/bin/bash
# Deep Refactoring Backup Script - Comprehensive backup before structural changes

BACKUP_DIR=".type-refactor-backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_SUBDIR="$BACKUP_DIR/deep_backup_$TIMESTAMP"

echo "================================================"
echo "Creating DEEP REFACTORING backup at $BACKUP_SUBDIR"
echo "================================================"

# Create backup directory
mkdir -p "$BACKUP_SUBDIR"

# Backup all TypeScript files
echo "Backing up all TypeScript files..."
find src -name "*.ts" -o -name "*.tsx" | while read file; do
    mkdir -p "$BACKUP_SUBDIR/$(dirname "$file")"
    cp "$file" "$BACKUP_SUBDIR/$file"
done

# Count files backed up
FILE_COUNT=$(find "$BACKUP_SUBDIR" -type f | wc -l)

# Save current state information
echo "Saving current state information..."
{
    echo "Backup Date: $(date)"
    echo "Files Backed Up: $FILE_COUNT"
    echo "Current Branch: $(git branch --show-current)"
    echo "Last Commit: $(git log -1 --oneline)"
    echo ""
    echo "TypeScript Errors by Type:"
    bunx tsc --noEmit 2>&1 | grep -oE "TS[0-9]{4}" | sort | uniq -c | sort -rn | head -20
    echo ""
    echo "Total Error Count: $(bunx tsc --noEmit 2>&1 | grep "error TS" | wc -l)"
} > "$BACKUP_SUBDIR/backup_info.txt"

# Create restore script specific to this backup
cat > "$BACKUP_SUBDIR/restore.sh" << 'EOF'
#!/bin/bash
# Auto-generated restore script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
echo "Restoring from $SCRIPT_DIR..."

# Restore all files
for file in $(find "$SCRIPT_DIR/src" -type f); do
    relative_path=${file#$SCRIPT_DIR/}
    cp "$file" "$relative_path"
    echo "Restored: $relative_path"
done

echo "Restore complete!"
echo "Running type check..."
bunx tsc --noEmit 2>&1 | grep "error TS" | wc -l | xargs echo "Current error count:"
EOF
chmod +x "$BACKUP_SUBDIR/restore.sh"

echo ""
echo "✅ Backup complete!"
echo "📁 Location: $BACKUP_SUBDIR"
echo "📊 Files backed up: $FILE_COUNT"
echo "🔧 To restore, run: $BACKUP_SUBDIR/restore.sh"
echo ""

# Save backup location for easy access
echo "$BACKUP_SUBDIR" > .last-deep-backup