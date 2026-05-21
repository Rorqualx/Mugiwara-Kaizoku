# Canonical Types Resolution Plan

## Analysis Summary

After analyzing the TypeScript errors and type definitions, I've identified the following key issues:

### 1. Missing Exports in kapowarr.types.ts
The index.ts is trying to import `KapowarrStatus` which doesn't exist. The actual exports are:
- ✅ `KapowarrIssueStatus` (enum) - exists
- ✅ `KapowarrDownloadStatus` (enum) - exists  
- ✅ `KapowarrSourceStatus` (enum) - exists
- ❌ `KapowarrStatus` - doesn't exist (should use one of the above)

### 2. Duplicate Type Definitions
Multiple files define the same types with different implementations:
- `KapowarrConfig` - defined in both kapowarr.types.ts (proper) and compatibility-exports.ts (placeholder)
- `MangaMetadata` - defined in 3 places:
  - canonical/manga.types.ts (Zod-based, proper)
  - canonical/common-extended.types.ts (interface)
  - compatibility-exports.ts (placeholder)
- `EnhancedProviderResult` - defined twice in enhanced-metadata.types.ts with different properties

### 3. Prisma/Server Integration Issues

#### Enum Mismatches:
1. **CalendarEventType**
   - Prisma: `CHAPTER_RELEASE`, `VOLUME_RELEASE`, `HIATUS_START`, `HIATUS_END`, `SPECIAL_RELEASE`
   - Canonical: Includes all Prisma values PLUS legacy pattern values (`WEEKLY`, `BIWEEKLY`, etc.)
   - **Issue**: TypeScript enum doesn't match Prisma enum values

2. **ReleaseBlocklistReason**
   - Prisma: `QUALITY_POOR`, `WRONG_LANGUAGE`, `INCOMPLETE`, `WATERMARKED`, `DUPLICATE`
   - Canonical: `POOR_QUALITY`, `WRONG_LANGUAGE`, `INCOMPLETE`, `DUPLICATE`, `FAKE`, `VIRUS`, `USER_DEFINED`
   - **Issue**: Different naming conventions and extra values

## Resolution Steps

### Step 1: Fix Kapowarr Types

**File: src/types/canonical/compatibility-exports.ts**
```typescript
// REMOVE lines 15-16 (duplicate KapowarrConfig)
// REMOVE lines 479-485 (placeholder types that already exist)

// KEEP only the re-exports from kapowarr.types.ts
export { 
  KapowarrIssueStatus,
  KapowarrDownloadStatus,
  KapowarrSourceStatus,
  KapowarrConfigSchema,
  isKapowarrConnected,
  getKapowarrIssueProgress,
  type KapowarrConfig,
  type KapowarrIssue,
  type KapowarrDownloadTask,
  type KapowarrSource,
  type KapowarrSourceConfig,
  type KapowarrDownload,
  type KapowarrDownloadPayload,
  type KapowarrSourceSyncPayload,
  type KapowarrValidateSourcePayload
} from './kapowarr.types';
```

**File: src/types/canonical/index.ts**
```typescript
// FIX line 255 - Remove KapowarrStatus (doesn't exist)
export {
  KapowarrIssueStatus,      // Use this instead of KapowarrStatus
  KapowarrDownloadStatus,
  KapowarrSourceStatus,
  // ... rest of exports
} from './kapowarr.types';
```

### Step 2: Consolidate Enhanced Metadata Types

**File: src/types/canonical/enhanced-metadata.types.ts**
```typescript
// REMOVE duplicate interface at line 256-261
// KEEP the more complete one at line 300-314

// Consolidate EnhancedVolumeInfo (remove duplicate at 263-269, keep 319-325)
// Consolidate MetadataFieldOptions (remove duplicate at 271-276, keep 342-346)
// Consolidate ReleaseScheduleInfo (remove duplicate at 278-283, keep 350-359)
```

### Step 3: Fix Prisma Integration

**File: src/types/canonical/calendar.types.ts**
```typescript
// Create a mapping function for Prisma compatibility
export function toPrismaCalendarEventType(type: CalendarEventType): string {
  // Map canonical to Prisma values
  const mapping: Record<CalendarEventType, string> = {
    [CalendarEventType.CHAPTER_RELEASE]: 'CHAPTER_RELEASE',
    [CalendarEventType.VOLUME_RELEASE]: 'VOLUME_RELEASE',
    [CalendarEventType.HIATUS_START]: 'HIATUS_START',
    [CalendarEventType.HIATUS_END]: 'HIATUS_END',
    [CalendarEventType.SPECIAL_RELEASE]: 'SPECIAL_RELEASE',
    // Map legacy values to closest Prisma equivalent
    [CalendarEventType.WEEKLY]: 'CHAPTER_RELEASE',
    [CalendarEventType.BIWEEKLY]: 'CHAPTER_RELEASE',
    [CalendarEventType.MONTHLY]: 'VOLUME_RELEASE',
    [CalendarEventType.IRREGULAR]: 'CHAPTER_RELEASE',
    [CalendarEventType.HIATUS]: 'HIATUS_START',
    [CalendarEventType.ANNOUNCEMENT]: 'SPECIAL_RELEASE'
  };
  return mapping[type] || 'CHAPTER_RELEASE';
}
```

**File: src/types/canonical/release-blocklist.types.ts**
```typescript
// Create a mapping for Prisma compatibility
export function toPrismaBlocklistReason(reason: ReleaseBlocklistReason): string {
  const mapping: Record<ReleaseBlocklistReason, string> = {
    [ReleaseBlocklistReason.POOR_QUALITY]: 'QUALITY_POOR',
    [ReleaseBlocklistReason.WRONG_LANGUAGE]: 'WRONG_LANGUAGE',
    [ReleaseBlocklistReason.INCOMPLETE]: 'INCOMPLETE',
    [ReleaseBlocklistReason.DUPLICATE]: 'DUPLICATE',
    // Map additional values to closest Prisma equivalent
    [ReleaseBlocklistReason.FAKE]: 'QUALITY_POOR',
    [ReleaseBlocklistReason.VIRUS]: 'QUALITY_POOR',
    [ReleaseBlocklistReason.USER_DEFINED]: 'QUALITY_POOR'
  };
  return mapping[reason];
}

export function fromPrismaBlocklistReason(prismaReason: string): ReleaseBlocklistReason {
  const mapping: Record<string, ReleaseBlocklistReason> = {
    'QUALITY_POOR': ReleaseBlocklistReason.POOR_QUALITY,
    'WRONG_LANGUAGE': ReleaseBlocklistReason.WRONG_LANGUAGE,
    'INCOMPLETE': ReleaseBlocklistReason.INCOMPLETE,
    'WATERMARKED': ReleaseBlocklistReason.POOR_QUALITY,
    'DUPLICATE': ReleaseBlocklistReason.DUPLICATE
  };
  return mapping[prismaReason] || ReleaseBlocklistReason.USER_DEFINED;
}
```

### Step 4: Fix Missing Type Definitions

**File: src/types/canonical/compatibility-exports.ts**

Replace placeholder types with proper imports:
```typescript
// Import actual types instead of using placeholders
export { MangaMetadata } from './manga.types';
export { ChapterEntity } from './entities.types';
export { LibraryEntity } from './library.types';
export { TaskType, TaskStatus } from './task.types';
export { ProviderEntity, ProviderStatus } from './provider.types';

// For types that truly don't exist yet, create them in their proper files
```

### Step 5: Update Main Index

**File: src/types/canonical/index.ts**
```typescript
// Fix all missing exports
// Line 344: NotificationEventData -> use NotificationEventMap
// Line 356: SearchResultBase -> import from search.types
// Line 367, 372: MangaMetadata -> already exported from manga.types
// Line 369: Chapter -> ChapterEntity from entities.types
// Line 370: LibraryEntity -> from library.types
// Line 385: TaskType -> from task.types
```

## Implementation Order

1. **Fix duplicate KapowarrConfig** (compatibility-exports.ts) - IMMEDIATE
2. **Consolidate enhanced metadata interfaces** - HIGH
3. **Add Prisma mapping functions** - HIGH
4. **Fix index.ts exports** - MEDIUM
5. **Replace placeholder types** - LOW

## Validation

After each step, run:
```bash
npx tsc --noEmit --skipLibCheck
```

## Expected Results

- Eliminate all 119 TypeScript errors in canonical types
- Proper Prisma integration with mapping functions
- Clean module structure without duplicates
- Type-safe server/client communication