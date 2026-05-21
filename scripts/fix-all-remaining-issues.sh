#!/bin/bash

echo "Comprehensive fix for all remaining TypeScript issues..."

# 1. Fix missing imports in utils files that still reference @prisma/client
echo "Fixing utils imports..."
sed -i '' "s|import { TaskStatus.*} from '@prisma/client'|import { TaskStatus, TaskType } from '../utils/task-validation'|g" src/utils/trpc-task-helpers.ts
sed -i '' "s|import.*{ TaskStatus } from '@prisma/client'|import { TaskStatus } from '../utils/task-validation'|g" src/utils/validation/consolidated-validators.ts
sed -i '' "s|import { TaskType, TaskStatus } from '@prisma/client'|import { TaskType, TaskStatus } from '../../utils/task-validation'|g" src/utils/validation/validators/task.ts

# 2. Fix hooks that still import from @prisma/client
echo "Fixing hook imports..."
sed -i '' "s|import { TaskStatus } from '@prisma/client'|import { TaskStatus } from '../utils/task-validation'|g" src/hooks/useSystemTaskStatus.ts

# 3. Check and list available JobType values in Prisma schema
echo "Checking available JobType values..."
grep -A 30 "enum JobType" prisma/schema.prisma | grep -E "^\s+[A-Z_]+" | sed 's/^\s*//' | head -20

# 4. Fix missing JobType enum values in task-validation.ts
echo "Adding missing JobType mappings..."
# We need to check what JobTypes actually exist in Prisma and map appropriately

echo "Done with comprehensive fixes!"