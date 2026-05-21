#!/bin/bash

# Script to migrate frontend from Task system to Job system
# This updates imports in TypeScript/JavaScript files

echo "Starting frontend migration from Task to Job system..."

# Function to update imports in a file
update_imports() {
    local file="$1"

    # Replace direct Prisma imports of TaskStatus/TaskType with our compatibility layer
    sed -i '' "s/import { TaskStatus, TaskType } from '@prisma\/client'/import { TaskStatus, TaskType } from '..\/utils\/task-validation'/g" "$file"
    sed -i '' "s/import { TaskStatus } from '@prisma\/client'/import { TaskStatus } from '..\/utils\/task-validation'/g" "$file"
    sed -i '' "s/import { TaskType } from '@prisma\/client'/import { TaskType } from '..\/utils\/task-validation'/g" "$file"

    # Handle other imports that might include Task/OutOfSyncChapter
    sed -i '' "s/, Task,/, /g" "$file"
    sed -i '' "s/, Task }/ }/g" "$file"
    sed -i '' "s/{ Task,/{ /g" "$file"
    sed -i '' "s/{ Task }/{ }/g" "$file"

    sed -i '' "s/, OutOfSyncChapter,/, /g" "$file"
    sed -i '' "s/, OutOfSyncChapter }/ }/g" "$file"
    sed -i '' "s/{ OutOfSyncChapter,/{ /g" "$file"
    sed -i '' "s/{ OutOfSyncChapter }/{ }/g" "$file"

    # Fix relative paths based on depth
    if [[ "$file" == *"/src/pages/"* ]]; then
        sed -i '' "s/'..\/utils\/task-validation'/'..\/..\/utils\/task-validation'/g" "$file"
    elif [[ "$file" == *"/src/hooks/"* ]]; then
        sed -i '' "s/'..\/utils\/task-validation'/'..\/utils\/task-validation'/g" "$file"
    elif [[ "$file" == *"/src/components/"* ]]; then
        if [[ "$file" == *"/src/components/tasks/"* ]] || [[ "$file" == *"/src/components/sync/"* ]]; then
            sed -i '' "s/'..\/utils\/task-validation'/'..\/..\/utils\/task-validation'/g" "$file"
        else
            sed -i '' "s/'..\/utils\/task-validation'/'..\/utils\/task-validation'/g" "$file"
        fi
    fi
}

# Update all TypeScript/TSX files in components
echo "Updating component files..."
for file in src/components/**/*.{ts,tsx}; do
    if [ -f "$file" ]; then
        echo "  - $file"
        update_imports "$file"
    fi
done

# Update all TypeScript/TSX files in pages
echo "Updating page files..."
for file in src/pages/**/*.{ts,tsx}; do
    if [ -f "$file" ]; then
        echo "  - $file"
        update_imports "$file"
    fi
done

# Update all TypeScript/TSX files in hooks
echo "Updating hook files..."
for file in src/hooks/**/*.{ts,tsx}; do
    if [ -f "$file" ]; then
        echo "  - $file"
        update_imports "$file"
    fi
done

# Update other files that might have references
echo "Updating other files..."
for file in src/server/base/*.ts src/types/*.ts src/utils/*.ts src/store/*.ts; do
    if [ -f "$file" ]; then
        echo "  - $file"
        update_imports "$file"
    fi
done

echo "Frontend migration complete!"
echo "Please run 'bun run type-check' to verify all imports are correct."