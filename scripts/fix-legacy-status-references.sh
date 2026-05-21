#!/bin/bash

echo "Fixing legacy status references..."

# Fix direct references to old status values
echo "Replacing legacy JobStatus values..."

# Replace IN_PROGRESS with ACTIVE
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec grep -l "JobStatus\.IN_PROGRESS\|TaskStatus\.IN_PROGRESS" {} \; | while read -r file; do
  echo "Fixing IN_PROGRESS in $file"
  sed -i '' 's/JobStatus\.IN_PROGRESS/JobStatus.ACTIVE/g' "$file"
  sed -i '' 's/TaskStatus\.IN_PROGRESS/TaskStatus.ACTIVE/g' "$file"
done

# Replace RUNNING with ACTIVE
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec grep -l "JobStatus\.RUNNING\|TaskStatus\.RUNNING" {} \; | while read -r file; do
  echo "Fixing RUNNING in $file"
  sed -i '' 's/JobStatus\.RUNNING/JobStatus.ACTIVE/g' "$file"
  sed -i '' 's/TaskStatus\.RUNNING/TaskStatus.ACTIVE/g' "$file"
done

# Replace QUEUED with PENDING
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec grep -l "JobStatus\.QUEUED\|TaskStatus\.QUEUED" {} \; | while read -r file; do
  echo "Fixing QUEUED in $file"
  sed -i '' 's/JobStatus\.QUEUED/JobStatus.PENDING/g' "$file"
  sed -i '' 's/TaskStatus\.QUEUED/TaskStatus.PENDING/g' "$file"
done

# Replace SCHEDULED with PENDING
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec grep -l "JobStatus\.SCHEDULED\|TaskStatus\.SCHEDULED" {} \; | while read -r file; do
  echo "Fixing SCHEDULED in $file"
  sed -i '' 's/JobStatus\.SCHEDULED/JobStatus.PENDING/g' "$file"
  sed -i '' 's/TaskStatus\.SCHEDULED/TaskStatus.PENDING/g' "$file"
done

# Replace OUT_OF_SYNC with PENDING (for fix jobs)
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec grep -l "JobStatus\.OUT_OF_SYNC\|TaskStatus\.OUT_OF_SYNC" {} \; | while read -r file; do
  echo "Fixing OUT_OF_SYNC in $file"
  sed -i '' 's/JobStatus\.OUT_OF_SYNC/JobStatus.PENDING/g' "$file"
  sed -i '' 's/TaskStatus\.OUT_OF_SYNC/TaskStatus.PENDING/g' "$file"
done

# Fix string comparisons
echo "Fixing string status comparisons..."
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
  -e "s/=== 'IN_PROGRESS'/=== 'ACTIVE'/g" \
  -e "s/=== 'RUNNING'/=== 'ACTIVE'/g" \
  -e "s/=== 'QUEUED'/=== 'PENDING'/g" \
  -e "s/=== 'SCHEDULED'/=== 'PENDING'/g" \
  -e "s/=== 'OUT_OF_SYNC'/=== 'PENDING'/g" \
  -e "s/!== 'IN_PROGRESS'/!== 'ACTIVE'/g" \
  -e "s/!== 'RUNNING'/!== 'ACTIVE'/g" \
  -e "s/!== 'QUEUED'/!== 'PENDING'/g" \
  -e "s/!== 'SCHEDULED'/!== 'PENDING'/g" \
  {} \;

# Fix JobType references
echo "Fixing JobType references..."

# Replace CHECK_CHAPTERS with CHAPTER_CHECK
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec grep -l "JobType\.CHECK_CHAPTERS\|TaskType\.CHECK_CHAPTERS" {} \; | while read -r file; do
  echo "Fixing CHECK_CHAPTERS in $file"
  sed -i '' 's/JobType\.CHECK_CHAPTERS/JobType.CHAPTER_CHECK/g' "$file"
  sed -i '' 's/TaskType\.CHECK_CHAPTERS/TaskType.CHAPTER_CHECK/g' "$file"
done

# Fix string comparisons for JobType
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
  -e "s/=== 'CHECK_CHAPTERS'/=== 'CHAPTER_CHECK'/g" \
  -e "s/!== 'CHECK_CHAPTERS'/!== 'CHAPTER_CHECK'/g" \
  -e "s/'CHECK_CHAPTERS'/'CHAPTER_CHECK'/g" \
  {} \;

echo "Legacy status reference fixes complete!"