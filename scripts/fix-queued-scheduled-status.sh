#!/bin/bash

echo "Fixing QUEUED and SCHEDULED status references in API calls..."

# Fix taskActionBar.tsx
echo "Fixing taskActionBar.tsx..."
sed -i '' "s/status: 'QUEUED'/status: 'PENDING'/g" src/components/taskActionBar.tsx
sed -i '' "s/status: 'SCHEDULED'/status: 'PENDING'/g" src/components/taskActionBar.tsx

# Fix dashboard.tsx status assignments and API calls
echo "Fixing dashboard.tsx..."
sed -i '' "s/'QUEUED'/'PENDING'/g" src/pages/tasks/dashboard.tsx
sed -i '' "s/'SCHEDULED'/'PENDING'/g" src/pages/tasks/dashboard.tsx
sed -i '' "s/status: 'QUEUED'/status: 'PENDING'/g" src/pages/tasks/dashboard.tsx
sed -i '' "s/status: 'SCHEDULED'/status: 'PENDING'/g" src/pages/tasks/dashboard.tsx

# Fix other status references
echo "Fixing other status references..."
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec grep -l "'QUEUED'\|'SCHEDULED'" {} \; | while read -r file; do
  # Skip migration scripts
  if [[ "$file" =~ migration ]]; then
    continue
  fi

  echo "Checking $file for status references..."

  # Replace status values in API calls and assignments
  sed -i '' "s/status: 'QUEUED'/status: 'PENDING'/g" "$file"
  sed -i '' "s/status: 'SCHEDULED'/status: 'PENDING'/g" "$file"
  sed -i '' "s/=== 'QUEUED'/=== 'PENDING'/g" "$file"
  sed -i '' "s/=== 'SCHEDULED'/=== 'PENDING'/g" "$file"
  sed -i '' "s/!== 'QUEUED'/!== 'PENDING'/g" "$file"
  sed -i '' "s/!== 'SCHEDULED'/!== 'PENDING'/g" "$file"
done

echo "QUEUED and SCHEDULED status fixes complete!"