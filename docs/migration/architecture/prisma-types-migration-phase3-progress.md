# Prisma Types Migration Phase3 Progress

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Prisma Types Migration Phase3 Progress

---
# PrismaTypes Migration - Phase 3: Clean Up

## Phase 3 Status: In Progress

### ✅ Completed Tasks

1. **Created Deprecation Directory**
   - Created `/src/types/_deprecated/` directory for archiving

2. **Added Strong Deprecation Notice**
   - Updated prismaTypes.ts with clear deprecation warnings
   - Added migration guide directly in the file
   - Marked as @deprecated in JSDoc

3. **ESLint Rule Created**
   - Added `no-restricted-imports` rule to .eslintrc.json
   - Prevents new imports from prismaTypes
   - Provides helpful migration messages

4. **Critical Files Migrated**
   - ✅ `src/lib/prisma.ts` - Core database connection
   - ✅ `src/components/settingsMenu/SettingsMenu.tsx`
   - ✅ `src/components/system/SourceCard.tsx`
   - ✅ `src/components/system/MangalCardSettings.tsx`
   - ✅ `src/components/system/KapowarrCardSettings.tsx`
   - ✅ `src/components/system/SuwayomiCardSettings.tsx`

5. **Migration Script Created**
   - Created `migrate-prisma-types.sh` for automated migration
   - Handles common import patterns
   - Creates backups before modifying files

### 🔄 Current Progress

**Files Migrated**: 6 (from remaining 34)
**Files Remaining**: 28

### 📋 Remaining Files to Migrate

#### Core Infrastructure (1 file)
- [ ] `src/services/kapowarr/KapowarrManager.ts`

#### Server - TRPC Routers (6 files)
- [ ] `src/server/trpc/router/appRouter.ts`
- [ ] `src/server/trpc/router/sync.ts`
- [ ] `src/server/trpc/router/system.ts`
- [ ] `src/server/trpc/router/tasks.ts`
- [ ] `src/server/trpc/routers/activity.ts`
- [ ] `src/server/trpc/routers/backup.ts`

#### Server - Services (5 files)
- [ ] `src/server/services/backup/index.ts`
- [ ] `src/server/services/comicvine/service.ts`
- [ ] `src/server/services/metadataMerger.ts`
- [ ] `src/server/services/anilist/service.ts`
- [ ] `src/server/services/config/integrationMigration.ts`

#### Server - Queue (12 files)
- [ ] `src/server/queue/index.ts`
- [ ] `src/server/queue/download.ts`
- [ ] `src/server/queue/fixOutOfSyncChaptersQueue.ts`
- [ ] `src/server/queue/queueManager.ts`
- [ ] `src/server/queue/fixOutOfSyncChapters.ts`
- [ ] `src/server/queue/integration.ts`
- [ ] `src/server/queue/backup.ts`
- [ ] `src/server/queue/taskHandlers.ts`
- [ ] `src/server/queue/kapowarrHandlers.ts`
- [ ] `src/server/queue/notify.ts`
- [ ] `src/server/queue/checkChapters.ts`
- [ ] `src/server/queue/checkOutOfSyncChapters.ts`

#### Test Files (2 files)
- [ ] `src/server/queue/__tests__/kapowarrHandlers.test.ts`
- [ ] `src/test/utils/factories.ts`

## Quick Migration Guide

### Using the Migration Script

```bash
# Single file
./migrate-prisma-types.sh src/server/trpc/router/appRouter.ts

# Multiple files
./migrate-prisma-types.sh src/server/trpc/router/*.ts

# All server files
find src/server -name "*.ts" -exec ./migrate-prisma-types.sh {} \;
```

### Manual Migration Patterns

| Old Import | New Import |
|------------|------------|
| `TaskStatus, TaskType` from prismaTypes | from `'../types/domain/task-types'` |
| `SyncStatus` from prismaTypes | from `'../types/domain/task-types'` |
| `BackupStatus, BackupType, BackupSchedule` from prismaTypes | from `'../types/domain/backup-types'` |
| `IntegrationSettings` from prismaTypes | from `'../types/domain/integration-settings-types'` |
| `DatabaseError, TaskError` from prismaTypes | from `'../types/domain/error-types'` |
| `getBestAvailableCover()` from prismaTypes | from `'../utils/manga-utils'` |
| `isPrismaError()` from prismaTypes | from `'../utils/validation/type-guards'` |
| `isTaskType()` from prismaTypes | from `'../utils/validation/task-validators'` |

## Validation Status

- ESLint will now catch any new imports from prismaTypes
- Type checking still has some errors due to remaining unmigrated files
- Build should succeed after all migrations are complete

## Next Steps

1. Run migration script on server files
2. Manually review any files that need special attention
3. Run full validation suite
4. Archive prismaTypes.ts once all migrations complete

## Success Metrics

- ✅ Zero imports from prismaTypes
- ✅ All tests passing
- ✅ Type check passes without errors
- ✅ Build succeeds with `pnpm build:clean`
- ✅ ESLint shows no violations
