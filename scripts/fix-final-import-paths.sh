#!/bin/bash

echo "Fixing remaining import path issues..."

# Fix library components
sed -i '' "s|from '../utils/task-validation'|from '../../utils/task-validation'|g" src/components/library/DownloadManagerModal.tsx

# Fix task components
sed -i '' "s|from '../utils/task-validation'|from '../../utils/task-validation'|g" src/components/tasks/ResponsiveTaskList.tsx
sed -i '' "s|from '../utils/task-validation'|from '../../utils/task-validation'|g" src/components/tasks/TaskList.tsx
sed -i '' "s|from '../utils/task-validation'|from '../../utils/task-validation'|g" src/components/tasks/utils.ts

# Fix pages
sed -i '' "s|from '../utils/task-validation'|from '../../utils/task-validation'|g" src/pages/tasks/active.tsx
sed -i '' "s|from '../utils/task-validation'|from '../../utils/task-validation'|g" src/pages/tasks/completed.tsx
sed -i '' "s|from '../utils/task-validation'|from '../../utils/task-validation'|g" src/pages/tasks/dashboard.tsx
sed -i '' "s|from '../utils/task-validation'|from '../../utils/task-validation'|g" src/pages/tasks/failed.tsx
sed -i '' "s|from '../utils/task-validation'|from '../../utils/task-validation'|g" src/pages/tasks/out-of-sync.tsx
sed -i '' "s|from '../utils/task-validation'|from '../../utils/task-validation'|g" src/pages/tasks/queued.tsx
sed -i '' "s|from '../utils/task-validation'|from '../../utils/task-validation'|g" src/pages/tasks/scheduled.tsx

# Fix server files
sed -i '' "s|from '../utils/task-validation'|from '../../utils/task-validation'|g" src/server/base/DownloadClient.ts

# Fix hooks that need TaskStatus/TaskType from task-validation
sed -i '' "s|import { TaskStatus } from '@prisma/client'|import { TaskStatus } from '../utils/task-validation'|g" src/hooks/useSystemTaskStatus.ts
sed -i '' "s|import { TaskType } from '@prisma/client'|import { TaskType } from '../utils/task-validation'|g" src/hooks/useTaskOperations.ts

# Remove hasOutOfSync property references
echo "Removing hasOutOfSync references..."
sed -i '' '/hasOutOfSync/d' src/hooks/useFilteredManga.ts

echo "Import path fixes complete!"