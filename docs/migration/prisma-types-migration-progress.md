# Prisma Types Migration Progress

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Prisma Types Migration Progress

---
# PrismaTypes.ts Migration Progress Report

## Phase 1: Identify and Migrate Unique Types (COMPLETED)

### 1.1 Created Missing Domain Files ✅

#### Created Files:
1. **`src/types/domain/backup-types.ts`** ✅
   - BackupStatus enum
   - BackupType enum
   - BackupSchedule enum
   - BackupContent enum
   - BackupEntity interface
   - BackupSettings interface
   - CreateBackupInput interface
   - UpdateBackupSettingsInput interface
   - BackupStats interface
   - Backup type alias

2. **`src/types/domain/integration-settings-types.ts`** ✅
   - MetadataProviderSettings interface
   - MetadataStructure interface
   - IntegrationSettings interface
   - UpdateIntegrationSettingsInput type
   - IntegrationStatusSummary interface
   - Type guards: isMetadataProviderSettings, isMetadataStructure

3. **`src/types/domain/error-types.ts`** ✅
   - BaseError class
   - DatabaseError class
   - TaskError class
   - ValidationError class
   - ApiError class
   - IntegrationError class
   - PrismaClientKnownRequestError interface
   - Type guards: isPrismaError and others
   - createErrorMessage utility function

4. **Updated `src/types/domain/task-types.ts`** ✅
   - Added SyncStatus enum
   - Added TaskErrorCode enum
   - Added TaskScheduleEntity interface
   - Added PayloadOf type alias (re-export from task-payload)
   - Added Task type alias

### 1.2 Moved Utility Functions ✅

1. **Created `src/utils/manga-utils.ts`** ✅
   - getBestAvailableCover()
   - getThumbnailCover()
   - hasCoverImage()
   - getDisplayTitle()
   - formatMangaStatus()

2. **Added to `src/utils/validation/type-guards.ts`** ✅
   - isPrismaError()

3. **Created `src/utils/validation/task-validators.ts`** ✅
   - isTaskType()
   - isTaskStatus()
   - isTaskErrorCode()
   - validateTaskType()
   - validateTaskStatus()
   - getAllTaskTypes()
   - getAllTaskStatuses()
   - getAllTaskErrorCodes()
   - isCompletedStatus()
   - isActiveStatus()
   - canRetryStatus()

### 1.3 Updated Domain Index ✅
- Updated `src/types/domain/index.ts` to export all new types
- Added imports for new modules
- Added exports for all new types
- Updated Domain namespace with all new types and enums

## Types Already Available in Domain Files

These types can be migrated immediately by updating imports:

| Type | Current Import | New Import |
|------|----------------|------------|
| MangaEntity, Manga | from '../types/prismaTypes' | from '../types/domain/manga-types' |
| ChapterEntity, Chapter | from '../types/prismaTypes' | from '../types/domain/chapter-types' |
| ChapterStatus | from '../types/prismaTypes' | from '../types/domain/chapter-types' |
| LibraryEntity, Library | from '../types/prismaTypes' | from '../types/domain/library-types' |
| TaskEntity, Task | from '../types/prismaTypes' | from '../types/domain/task-types' |
| TaskStatus | from '../types/prismaTypes' | from '../types/domain/task-types' |
| TaskType | from '../types/prismaTypes' | from '../types/domain/task-types' |
| SyncStatus | from '../types/prismaTypes' | from '../types/domain/task-types' |
| BackupStatus, BackupType, BackupSchedule, BackupContent, Backup | from '../types/prismaTypes' | from '../types/domain/backup-types' |
| IntegrationSettings, MetadataProviderSettings, MetadataStructure | from '../types/prismaTypes' | from '../types/domain/integration-settings-types' |
| DatabaseError, TaskError, PrismaClientKnownRequestError | from '../types/prismaTypes' | from '../types/domain/error-types' |
| TaskPayload, PayloadOf | from '../types/prismaTypes' | from '../types/domain/task-payload' |
| TaskErrorCode, TaskScheduleEntity | from '../types/prismaTypes' | from '../types/domain/task-types' |

## Remaining Items in prismaTypes.ts

These items still need consideration:

1. **Type Aliases** (may need to be kept for backward compatibility):
   - PrismaClient interface
   - TransactionClient type
   - InputJsonValue type
   - Various *GetPayload types
   - ChapterFromLocal type
   - Prisma namespace export

2. **Legacy Compatibility Aliases**:
   - MangaChapter
   - MangaMetadataEntity
   - OutOfSyncChapter
   - MangaWithRelationsType
   - MangaWithLibraryAndChapters
   - HasLibrary
   - BaseManga
   - Metadata

3. **Utility Functions** (now moved):
   - ✅ getBestAvailableCover() → manga-utils.ts
   - ✅ isPrismaError() → type-guards.ts
   - ✅ isTaskType() → task-validators.ts

## Next Steps: Phase 2

### Phase 2: Update Imports Gradually (3-4 weeks)

**Current Status**: 53 files need migration from prismaTypes.ts

#### Priority Order:
1. **Type definition files** (`/src/types/`) - These affect everything else
2. **Utility files** (`/src/utils/`) - Core functionality
3. **Store files** (`/src/store/`) - State management
4. **Hook files** (`/src/hooks/`) - React integration
5. **Component files** (`/src/components/`) - UI layer
6. **Server files** (`/src/server/`) - Backend (can be done in parallel)

#### Migration Strategy:
For each file that imports from prismaTypes:
1. Add new imports alongside old ones
2. Update usage gradually
3. Remove old imports
4. Test thoroughly

#### Example Migration:
```typescript
// Before
import { MangaEntity, TaskStatus } from '../types/prismaTypes';

// During migration
import { MangaEntity as OldMangaEntity, TaskStatus as OldTaskStatus } from '../types/prismaTypes';
import { MangaEntity, TaskStatus } from '../types/domain';

// After migration
import { MangaEntity, TaskStatus } from '../types/domain';
```

## Success Metrics

- [x] All unique types from prismaTypes.ts exist in domain files
- [x] All utility functions have been moved to appropriate utils
- [ ] No new imports from prismaTypes.ts
- [ ] All tests pass
- [x] Type checking passes (`pnpm type-check`) ✅
- [ ] Build succeeds (`pnpm build:clean`)

## Notes

- The PrismaClient interface and related types may need to remain in prismaTypes.ts for Prisma compatibility
- Consider creating type aliases in domain files for easier migration
- Monitor for any runtime issues during the migration
- Keep prismaTypes.ts functional during the migration period

## Resolved Issues

### ValidationError Naming Conflict
- **Problem**: Both `domain/error-types.ts` and `api/error-types.ts` exported a `ValidationError` type
- **Solution**: 
  - Renamed domain `ValidationError` to `DomainValidationError`
  - Added type alias for backward compatibility
  - In `types/index.ts`, exported API's `ValidationError` as `APIValidationError`
  - This prevents TypeScript error TS2308 about ambiguous exports
