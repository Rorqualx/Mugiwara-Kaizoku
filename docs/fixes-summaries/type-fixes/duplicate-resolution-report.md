# Duplicate Type Resolution Report

*Date: August 29, 2025*  
*Purpose: Resolve duplicate type definitions and establish canonical types*

## Summary

Successfully identified and resolved major duplicate type definitions in the canonical types system. Reduced TypeScript errors in canonical types and established proper single sources of truth for key types.

## Duplicates Resolved

### 1. KapowarrConfig
**Problem**: Multiple conflicting definitions across 3 files
- `src/types/kapowarr-types.ts` - Full definition with BaseIntegrationConfig
- `src/types/adapters/kapowarr.ts` - Two conflicting interface definitions
- `src/types/canonical/compatibility-exports.ts` - Placeholder `any` type

**Resolution**: 
- ✅ Created canonical definition in `src/types/canonical/kapowarr.types.ts`
- ✅ Updated compatibility-exports.ts to re-export from canonical source
- ✅ Updated index.ts to export from kapowarr.types.ts

**Canonical Location**: `src/types/canonical/kapowarr.types.ts`

### 2. EnhancedProviderResult
**Problem**: Duplicate interface declarations with different properties
- Line 256-261: Basic version with fewer properties
- Line 300-314: Complete version with all properties

**Resolution**:
- ✅ Removed duplicate basic version
- ✅ Kept comprehensive version with all properties
- ✅ Added "Canonical version" comment

**Canonical Location**: `src/types/canonical/enhanced-metadata.types.ts` (line 280)

### 3. MetadataFieldOptions
**Problem**: Two versions with different properties
- First version: Basic with preferredProvider, fallbackOrder
- Second version: Extended with strategy, required, options

**Resolution**:
- ✅ Merged both versions into single comprehensive interface
- ✅ Included all properties from both versions

**Canonical Location**: `src/types/canonical/enhanced-metadata.types.ts` (line 302)

### 4. PublicationInfo
**Problem**: Two versions with slightly different properties
- First version: magazines[] array
- Second version: magazine string

**Resolution**:
- ✅ Merged both versions
- ✅ Kept both magazines[] and magazine for backwards compatibility

**Canonical Location**: `src/types/canonical/enhanced-metadata.types.ts` (line 327)

### 5. MangaEntity
**Problem**: Multiple definitions and exports
- `src/types/canonical/entities.types.ts` - Proper interface definition
- `src/types/canonical/index.ts` - Type alias to MangaMetadata

**Resolution**:
- ✅ Removed duplicate type alias in index.ts
- ✅ Kept proper interface definition in entities.types.ts
- ✅ Export only from entities.types.ts

**Canonical Location**: `src/types/canonical/entities.types.ts` (line 14)

### 6. MangaWithRelations
**Problem**: Duplicate definitions
- Exported from entities.types.ts
- Redefined in index.ts with different properties

**Resolution**:
- ✅ Removed duplicate definition in index.ts
- ✅ Kept canonical version in entities.types.ts

**Canonical Location**: `src/types/canonical/entities.types.ts` (line 27)

### 7. KapowarrChapter & KapowarrProvider
**Problem**: Duplicate exports in index.ts
- Lines 259-260: First export
- Lines 337-339: Duplicate export

**Resolution**:
- ✅ Removed duplicate exports at lines 337-339
- ✅ Removed circular import at line 1

**Canonical Location**: `src/types/canonical/kapowarr.types.ts`

## New Types Added

To resolve missing type references, the following canonical types were added:

1. **SearchResultBase** - Base interface for search results (index.ts line 350)
2. **TaskType** - Enum for task types (index.ts line 379)
3. **MonitoringConfig** - Interface for monitoring configuration (index.ts line 361)
4. **MetadataProvenance** - Interface for metadata source tracking (index.ts line 371)

## Impact

### Before
- Multiple conflicting type definitions
- Circular dependencies
- Placeholder `any` types
- ~40+ errors in canonical types

### After
- Single source of truth for each type
- No circular dependencies in canonical types
- Proper type definitions replacing placeholders
- 23 errors remaining (mostly Prisma enum mismatches)

## Remaining Issues

The following issues still need resolution:

1. **Prisma Enum Mismatches** - TaskType, CalendarEventType, etc. don't match Prisma generated enums
2. **Zod Extension Issues** - MangaEntity and ChapterEntity incorrectly extending Zod output types
3. **Missing Exports** - WantedManga, WantedChapter not exported from wanted.types.ts
4. **Duplicate TaskType Export** - Conflict between different modules

## Recommendations

1. **Use Type Composition** instead of extending Zod output types:
   ```typescript
   export type MangaEntity = z.infer<typeof MangaSchema> & {
     // Additional properties
   };
   ```

2. **Align with Prisma Enums** - Either use Prisma's generated enums or create mappers

3. **Complete Missing Exports** - Add missing types to their respective files

4. **Document Canonical Sources** - Add comments pointing to canonical locations

## Files Modified

1. `src/types/canonical/kapowarr.types.ts` - Added KapowarrConfig
2. `src/types/canonical/enhanced-metadata.types.ts` - Removed duplicates, merged interfaces
3. `src/types/canonical/compatibility-exports.ts` - Updated to use canonical sources
4. `src/types/canonical/index.ts` - Fixed exports, removed duplicates, added missing types

## Validation

Run `npx tsc --noEmit` to verify improvements. Canonical type errors reduced significantly.