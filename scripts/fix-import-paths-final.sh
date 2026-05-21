#!/bin/bash

echo "Fixing import path issues for task-validation module..."

# Fix components directory (needs ../utils)
find src/components -type f \( -name "*.ts" -o -name "*.tsx" \) -exec grep -l "from '\.\./\.\./utils/task-validation'" {} \; | while read -r file; do
  echo "Fixing $file (../../utils -> ../utils)"
  sed -i '' "s|from '../../utils/task-validation'|from '../utils/task-validation'|g" "$file"
done

# Fix pages directory (needs ../utils)
find src/pages -type f \( -name "*.ts" -o -name "*.tsx" \) -exec grep -l "from '\.\./\.\./utils/task-validation'" {} \; | while read -r file; do
  echo "Fixing $file (../../utils -> ../utils)"
  sed -i '' "s|from '../../utils/task-validation'|from '../utils/task-validation'|g" "$file"
done

# Fix hooks directory (needs ../utils)
find src/hooks -type f \( -name "*.ts" -o -name "*.tsx" \) -exec grep -l "from '\.\./\.\./utils/task-validation'" {} \; | while read -r file; do
  echo "Fixing $file (../../utils -> ../utils)"
  sed -i '' "s|from '../../utils/task-validation'|from '../utils/task-validation'|g" "$file"
done

# Fix store directory (needs ../utils)
find src/store -type f \( -name "*.ts" -o -name "*.tsx" \) -exec grep -l "from '\.\./\.\./utils/task-validation'" {} \; | while read -r file; do
  echo "Fixing $file (../../utils -> ../utils)"
  sed -i '' "s|from '../../utils/task-validation'|from '../utils/task-validation'|g" "$file"
done

# Fix any remaining direct @prisma/client imports that should use task-validation
echo "Replacing direct @prisma/client imports with task-validation..."
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec grep -l "from '@prisma/client'" {} \; | while read -r file; do
  # Skip files that legitimately need direct Prisma access
  if [[ "$file" =~ (prisma\.ts|trpc|server|api|db\.) ]]; then
    continue
  fi

  # Check if file imports TaskStatus, TaskType, or SyncStatus from @prisma/client
  if grep -q "import.*\(TaskStatus\|TaskType\|SyncStatus\).*from '@prisma/client'" "$file"; then
    echo "Updating $file to use task-validation instead of @prisma/client"

    # Calculate correct relative path based on file location
    dir=$(dirname "$file")
    depth=$(echo "$dir" | tr '/' '\n' | grep -c '^')

    # Build relative path to utils
    if [[ "$dir" == "src" ]]; then
      relative_path="./utils/task-validation"
    elif [[ "$dir" =~ ^src/[^/]+$ ]]; then
      relative_path="../utils/task-validation"
    elif [[ "$dir" =~ ^src/[^/]+/[^/]+$ ]]; then
      relative_path="../../utils/task-validation"
    else
      relative_path="../../../utils/task-validation"
    fi

    # Replace the import
    sed -i '' "s|import.*{\(.*\(TaskStatus\|TaskType\|SyncStatus\).*\)}.*from '@prisma/client'|import {\1} from '$relative_path'|g" "$file"
  fi
done

# Add SyncStatus import where missing but used
echo "Adding SyncStatus imports where needed..."
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec grep -l "SyncStatus\." {} \; | while read -r file; do
  # Check if SyncStatus is already imported
  if ! grep -q "import.*SyncStatus" "$file"; then
    echo "Adding SyncStatus import to $file"

    # Calculate correct relative path
    dir=$(dirname "$file")
    if [[ "$dir" == "src" ]]; then
      relative_path="./utils/task-validation"
    elif [[ "$dir" =~ ^src/[^/]+$ ]]; then
      relative_path="../utils/task-validation"
    elif [[ "$dir" =~ ^src/[^/]+/[^/]+$ ]]; then
      relative_path="../../utils/task-validation"
    else
      relative_path="../../../utils/task-validation"
    fi

    # Check if there's an existing import from task-validation
    if grep -q "from '$relative_path'" "$file"; then
      # Add to existing import
      sed -i '' "s|from '$relative_path'|, SyncStatus& from '$relative_path'|" "$file"
      sed -i '' "s|, SyncStatus&|, SyncStatus|" "$file"
    else
      # Add new import at the top
      sed -i '' "1s|^|import { SyncStatus } from '$relative_path';\n|" "$file"
    fi
  fi
done

echo "Import path fixes complete!"