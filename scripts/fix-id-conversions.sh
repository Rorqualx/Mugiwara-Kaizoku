#!/bin/bash

echo "Fixing ID type conversions in components..."

# Fix components that use task IDs as strings but receive numbers/bigints
echo "Updating DownloadQueue component..."
find src/components -name "DownloadQueue.tsx" -exec sed -i '' \
  -e 's/taskId: string/taskId: string | number | bigint/g' \
  -e 's/task\.id === taskId/toStringId(task.id) === toStringId(taskId)/g' \
  -e 's/cancelTask(task\.id)/cancelTask(toStringId(task.id))/g' \
  {} \;

echo "Updating DownloadManagerModal component..."
find src/components -name "DownloadManagerModal.tsx" -exec sed -i '' \
  -e 's/downloadTask\.id/toStringId(downloadTask.id)/g' \
  -e 's/taskId: string/taskId: string | number | bigint/g' \
  {} \;

echo "Updating TaskList components..."
find src/components/tasks -type f \( -name "*.tsx" -o -name "*.ts" \) -exec sed -i '' \
  -e 's/task\.id\.toString()/toStringId(task.id)/g' \
  -e 's/BigInt(taskId)/toBigIntId(taskId)/g' \
  -e 's/Number(task\.id)/toNumberId(task.id)/g' \
  {} \;

echo "Updating sync components..."
find src/components/sync -type f \( -name "*.tsx" -o -name "*.ts" \) -exec sed -i '' \
  -e 's/mangaId: number/mangaId: number | bigint/g' \
  -e 's/chapterId: number/chapterId: number | bigint/g' \
  -e 's/parseInt(id)/toNumberId(id)/g' \
  {} \;

echo "Updating hooks with ID conversions..."
find src/hooks -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
  -e 's/jobId: string/jobId: string | number | bigint/g' \
  -e 's/taskId: string/taskId: string | number | bigint/g' \
  -e 's/job\.id === jobId/toStringId(job.id) === toStringId(jobId)/g' \
  {} \;

echo "Updating pages with ID conversions..."
find src/pages -type f \( -name "*.tsx" -o -name "*.ts" \) -exec sed -i '' \
  -e 's/router\.query\.id as string/toStringId(router.query.id)/g' \
  -e 's/parseInt(.*router\.query/toNumberId(router.query/g' \
  {} \;

# Add imports for ID conversion functions where needed
echo "Adding ID conversion imports..."
for file in $(find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec grep -l "toStringId\|toNumberId\|toBigIntId" {} \;); do
  # Skip if already imported
  if ! grep -q "import.*toStringId\|toNumberId\|toBigIntId" "$file"; then
    # Check if task-validation is already imported
    if grep -q "from.*task-validation" "$file"; then
      # Add to existing import
      sed -i '' "s|from '\(.*task-validation\)'|, toStringId, toNumberId, toBigIntId& from '\1'|" "$file"
      sed -i '' "s|, toStringId, toNumberId, toBigIntId&|, toStringId, toNumberId, toBigIntId|" "$file"
    else
      # Calculate relative path
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
      # Add new import
      sed -i '' "1s|^|import { toStringId, toNumberId, toBigIntId } from '$relative_path';\n|" "$file"
    fi
  fi
done

echo "ID conversion fixes complete!"