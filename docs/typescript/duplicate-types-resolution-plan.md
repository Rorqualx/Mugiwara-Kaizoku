# Duplicate Types Resolution Plan

## Identified Duplicates and Resolution Strategy

### 1. KapowarrConfig
**Current State:**
- ✅ **CANONICAL**: `src/types/canonical/kapowarr.types.ts` line 97 - Full interface definition
- ❌ **DUPLICATE**: `src/types/canonical/compatibility-exports.ts` line 16 - Re-export (correct)
- ❌ **DUPLICATE**: `src/types/canonical/compatibility-exports.ts` line 466 - `any` placeholder
- ❌ **REFERENCE**: `src/types/kapowarr-types.ts` - Imports canonical and re-exports

**Resolution:**
```typescript
// In compatibility-exports.ts - REMOVE line 16 placeholder:
// export type KapowarrConfig = any; // DELETE THIS

// Keep only the re-export at top of file:
export type { KapowarrConfig } from './kapowarr.types';
```

### 2. Kapowarr Related Types (All Placeholders)
**Current State:** All defined as `any` in compatibility-exports.ts
- KapowarrIssueStatus (line 468)
- KapowarrIssue (line 471)
- KapowarrDownloadTask (line 474)
- KapowarrConfigSchema (line 479)
- KapowarrSource (line 488)
- KapowarrDownloadPayload (line 500)

**Resolution:**
These need proper definitions in `kapowarr.types.ts`. Currently missing exports causing index.ts errors.

### 3. MangaEntity
**Current State:**
- ✅ **CANONICAL**: `src/types/canonical/entities.types.ts` line 15 - Type definition
- ❌ **PLACEHOLDER**: `src/types/canonical/compatibility-exports.ts` line 13 - Placeholder `any`
- ✅ **RE-EXPORT**: Multiple files correctly import from canonical

**Resolution:**
```typescript
// In compatibility-exports.ts - REMOVE placeholder:
// export type MangaEntity = any; // DELETE THIS

// Keep only the re-export:
export type { MangaEntity } from './entities.types';
```

### 4. EnhancedProviderResult (Property Conflicts)
**Current State:** Single interface with conflicting property declarations at different locations
- Line 256-261: First declaration
- Line 300-314: Second declaration with different properties

**Resolution:**
Merge into single comprehensive interface:
```typescript
export interface EnhancedProviderResult {
  provider: string;
  confidence: number;
  data: Record<string, unknown>;
  metadata?: Partial<MangaMetadata>;
  enhanced?: boolean;
  chapters?: any[];
  volumes?: any[];
  titles?: any[];
  descriptions?: any[];
  coverArts?: any[];
  seriesInfo?: { 
    totalVolumes?: number; 
    totalChapters?: number; 
    status?: string;
  };
  mainUrl?: string;
  bannerImages?: any[];
  artworkGallery?: string[];
}
```

### 5. EnhancedVolumeInfo (Property Conflicts)
**Current State:** Multiple declarations with different property types
- Line 263: `chapters?: number[]`
- Line 322: `chapters: any[]`

**Resolution:**
```typescript
export interface EnhancedVolumeInfo {
  number: number;
  title?: string;
  chapters?: any[]; // Use more permissive type
  releaseDate?: Date | string; // Allow both
  coverUrl?: string;
}
```

### 6. ReleaseScheduleInfo (Property Conflicts)
**Current State:** Pattern property type conflicts
- Line 279: `pattern?: 'weekly' | 'biweekly' | 'monthly' | 'irregular'`
- Line 354: `pattern: 'daily' | 'weekly' | 'monthly' | 'biweekly' | 'irregular'`

**Resolution:**
```typescript
export interface ReleaseScheduleInfo {
  pattern?: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'irregular';
  dayOfWeek?: number;
  dayOfMonth?: number;
  frequency?: number;
  nextRelease?: Date | string;
  lastRelease?: Date | string;
  timezone?: string;
}
```

## Files to Modify

### Priority 1: Remove Placeholder Duplicates
1. `src/types/canonical/compatibility-exports.ts`
   - Remove all `= any` placeholder definitions
   - Keep only proper re-exports

### Priority 2: Add Missing Exports
2. `src/types/canonical/kapowarr.types.ts`
   - Add missing type definitions for:
     - KapowarrIssueStatus
     - KapowarrIssue
     - KapowarrDownloadTask
     - KapowarrSource
     - etc.

### Priority 3: Fix Property Conflicts
3. `src/types/canonical/enhanced-metadata.types.ts`
   - Consolidate duplicate interface declarations
   - Use consistent property types

### Priority 4: Update Index
4. `src/types/canonical/index.ts`
   - Update exports to match actual available types
   - Use proper `export type` syntax

## Validation Steps

1. Remove all placeholder `any` types
2. Ensure single source of truth for each type
3. Fix property type conflicts in interfaces
4. Update all imports/exports
5. Run `npx tsc --noEmit` to verify

## Expected Result

- Zero duplicate type definitions
- All types have single canonical definition
- No placeholder `any` types for defined entities
- Clean module exports without conflicts