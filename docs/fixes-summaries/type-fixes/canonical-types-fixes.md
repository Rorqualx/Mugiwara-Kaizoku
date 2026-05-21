# Canonical Types Integration Fixes

## Issues Identified

### 1. Missing Exports in kapowarr.types.ts
The index.ts file is trying to export `KapowarrStatus` which doesn't exist. The actual enums are:
- `KapowarrDownloadStatus` (exists)
- `KapowarrIssueStatus` (exists) 
- `KapowarrSourceStatus` (exists)
- But NO `KapowarrStatus`

### 2. Prisma/Server Type Mismatches

#### MangaStatus Enum Mismatch
- **Prisma Schema**: `PENDING | ACTIVE | COMPLETED | ERROR | DELETED`
- **Canonical Types**: `UNKNOWN | ONGOING | COMPLETED | HIATUS | CANCELLED`
- **Issue**: Complete mismatch - these represent different concepts!
  - Prisma's MangaStatus = processing status (system state)
  - Canonical MangaStatus = publication status (content state)

#### CalendarEventType Mismatch
- **Prisma**: Uses string enum values
- **Canonical**: Trying to pass TypeScript enum to Prisma expecting string
- **Error Location**: `src/server/services/calendar/CalendarEventService.ts:32`

### 3. Duplicate Type Definitions

#### In compatibility-exports.ts
- Line 16: `KapowarrConfig` defined as `any` placeholder
- Line 466: Attempting another definition (based on error)
- **Solution**: Remove placeholder, keep only proper definition

#### In enhanced-metadata.types.ts
Multiple issues with property modifiers and types:
- `metadata` property declared both optional and required
- `chapters` type mismatch: `number[]` vs `any[]`
- `pattern` required vs optional
- `releaseDate` type inconsistency

### 4. Non-standard "Enhanced" Types
Found these enhanced versions that should be normalized:
- `EnhancedProviderResult` → alias to `ProviderResult`
- `EnhancedVolumeInfo` → alias to `VolumeInfo`
- `EnhancedChapterInfo` → alias to `ChapterInfo`
- `EnhancedMangaMetadata` → alias to `ExtendedMetadata`

## Recommended Fixes

### Fix 1: Correct kapowarr.types.ts exports

```typescript
// In src/types/canonical/kapowarr.types.ts
// ADD this missing enum:
export enum KapowarrStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  ERROR = 'ERROR',
  PENDING = 'PENDING'
}
```

### Fix 2: Resolve Prisma Integration

Create a mapping layer between Prisma and canonical types:

```typescript
// src/types/canonical/prisma-mappings.ts
import { MangaStatus as PrismaMangaStatus } from '@prisma/client';
import { MangaStatus as CanonicalMangaStatus } from './manga.types';

// Processing status (Prisma) vs Publication status (Canonical)
export interface MangaWithDualStatus {
  processingStatus: PrismaMangaStatus;  // PENDING, ACTIVE, COMPLETED, ERROR
  publicationStatus: CanonicalMangaStatus; // ONGOING, COMPLETED, HIATUS, etc.
}

// Map canonical to Prisma for CalendarEventType
export function toP rismaCalendarEventType(canonical: string): string {
  return canonical; // Already string, Prisma expects string
}
```

### Fix 3: Clean Up Duplicate Definitions

In `src/types/canonical/compatibility-exports.ts`:
```typescript
// REMOVE lines 13-28 (placeholder definitions)
// KEEP only proper imports and re-exports
```

In `src/types/canonical/enhanced-metadata.types.ts`:
```typescript
// Consolidate duplicate interfaces - keep only ONE of each:
export interface ProviderResult {
  provider: string;
  confidence: number;
  data: Record<string, unknown>;
  metadata?: Partial<MangaMetadata>; // Make consistently optional
  chapters?: ChapterInfo[];
  volumes?: VolumeInfo[];
  // ... rest of properties
}

// Remove duplicate definitions, keep type aliases at bottom:
export type EnhancedProviderResult = ProviderResult; // Backward compat
```

### Fix 4: Normalize Enhanced Types

Replace all "Enhanced" prefixes with standard names:
1. Use `ProviderResult` everywhere instead of `EnhancedProviderResult`
2. Use `VolumeInfo` instead of `EnhancedVolumeInfo`
3. Update all imports in consumer files

### Fix 5: Fix Entity Type Extensions

In `src/types/canonical/entities.types.ts`:
```typescript
import { z } from 'zod';
import { MangaSchema, ChapterSchema } from './schemas';

// Don't extend Zod output types, use type inference:
export type MangaEntity = z.infer<typeof MangaSchema>;
export type ChapterEntity = z.infer<typeof ChapterSchema>;

// For extensions, use intersection:
export type MangaWithRelations = MangaEntity & {
  chapters?: ChapterEntity[];
  metadata?: any; // Define properly
  library?: any;  // Define properly
};
```

### Fix 6: Clean Index Exports

In `src/types/canonical/index.ts`:
```typescript
// Use proper type exports for isolatedModules:
export type { MangaEntity, ChapterEntity } from './entities.types';

// Remove non-existent exports:
// REMOVE: KapowarrStatus (unless added)
// REMOVE: NotificationEventData (use NotificationEventMap)
// REMOVE: SearchResultBase, MangaMetadata, Chapter, etc. (undefined)

// Fix re-export syntax:
export type {
  KapowarrDownloadStatus,
  KapowarrIssueStatus,
  KapowarrSourceStatus,
  // ... other actual exports
} from './kapowarr.types';
```

## Integration Points to Update

### 1. Server Services
- `src/server/services/calendar/CalendarEventService.ts` - Fix enum conversion
- `src/server/services/releaseBlocklistService.ts` - Fix enum conversion
- All services using MangaStatus - clarify processing vs publication status

### 2. Component Files
- `src/components/updateManga/UpdateForm.tsx` - Fix MonitoringConfig cast
- `src/pages/settings/integrations/komga.tsx` - Fix KomgaConfig type
- `src/components/addManga/steps/confirmationStep.tsx` - Use standard types

### 3. API Files  
- Fix all files importing "ExtendedMangaSearchResult" → use "MangaSearchResult"
- Fix all files importing "ProviderSpecificData" → use "ProviderSpecificMetadata"

## Validation Steps

1. Run `npx tsc --noEmit` after each file fix
2. Check that Prisma client regenerates: `npx prisma generate`
3. Verify server starts without type errors
4. Test that manga CRUD operations work with both status types

## Priority Order

1. **CRITICAL**: Fix MangaStatus confusion (processing vs publication)
2. **HIGH**: Fix missing KapowarrStatus or remove its export
3. **HIGH**: Fix duplicate type definitions in enhanced-metadata.types.ts
4. **MEDIUM**: Normalize enhanced types to standard names
5. **LOW**: Clean up placeholder types and TODO comments