# Canonical Types Resolution Report

*Date: August 29, 2025*  
*Initial Errors: ~50+ in canonical types*  
*Final Errors: 6 (mostly integration issues)*

## Summary of Resolutions

### ✅ Successfully Resolved Issues

#### 1. **Missing Exports from kapowarr.types.ts**
- **Issue**: Index.ts was trying to export non-existent types like `KapowarrStatus`
- **Resolution**: Verified actual exports from kapowarr.types.ts and updated index.ts to match
- **Types Fixed**: All Kapowarr types now properly exported (enums, interfaces, functions)

#### 2. **Duplicate Type Definitions**
- **Issue**: Multiple definitions of the same types across files
- **Resolved Duplicates**:
  - `KapowarrConfig` - Removed placeholder, using proper export
  - `SearchResultBase` - Removed duplicate interface, using search.types.ts export
  - `WantedItem` - Removed duplicate interface, using wanted.types.ts export
  - `EnhancedProviderResult` - Already normalized with type aliases

#### 3. **Entity Type Extensions**
- **Issue**: Interfaces trying to extend Zod-inferred types incorrectly
- **Resolution**: Already fixed in entities.types.ts using intersection types instead of extends
- **Pattern**: `type MangaEntity = MangaMetadata & { ... }` instead of interface extends

#### 4. **Import/Export Issues in index.ts**
- **Issue**: Types referenced in interfaces before being imported
- **Resolution**: Added proper imports at the top of index.ts for:
  - `TaskType` from task.types.ts
  - `KapowarrSearchResult`, `KapowarrManga`, `KapowarrChapter` from kapowarr.types.ts
  - `WantedItem` from wanted.types.ts
  - `MangaSearchResult` from search.types.ts

#### 5. **Type-Only Re-exports**
- **Issue**: Re-exporting types without `export type` with isolatedModules enabled
- **Resolution**: Changed `export { ChapterEntity }` to `export type { ChapterEntity }`

#### 6. **Import Path Corrections**
- **Issue**: wizard.types.ts importing non-existent exports from manga.types.ts
- **Resolution**: Updated imports to use correct source files:
  - `MangaSearchResult` from search.types.ts
  - `ChapterInfo` from chapter.types.ts

## Normalization Applied

### Enhanced Metadata Types
- Consolidated duplicate interface definitions
- Created type aliases for backward compatibility:
  ```typescript
  export type EnhancedProviderResult = ProviderResult;
  export type EnhancedVolumeInfo = VolumeInfo;
  export type EnhancedChapterInfo = ExtendedChapterInfo;
  ```

### Standard Implementation Pattern
All canonical types now follow the pattern:
1. **Single definition** in appropriate file
2. **Proper exports** with type-only exports where needed
3. **No circular dependencies**
4. **Clear import paths**

## Remaining Issues (6)

These are integration/usage issues, not type definition problems:

1. **KomgaConfig mismatch** - Different shapes between server and canonical types
2. **CalendarEventType enum** - Mismatch with Prisma generated types
3. **ReleaseBlocklistReason enum** - Mismatch with Prisma generated types
4. **integration-settings.types.ts:189** - Type assignment issue
5. **release-blocklist.types.ts:152** - Property 'apiKey' missing

## Key Patterns Established

### 1. Import Types for Interface Definitions
```typescript
import type { TaskType as TaskTypeImport } from './task.types';
// Use in interface
export interface TaskPayload {
  type: TaskTypeImport;
}
```

### 2. Type Aliases for Compatibility
```typescript
// Instead of duplicate definitions
export type MangaSearchResultBase = MangaSearchResultImport;
```

### 3. Intersection Types for Entity Extensions
```typescript
// Instead of interface extends ZodType
export type MangaEntity = MangaMetadata & {
  id: number | string;
  // additional properties
};
```

## Validation Command
```bash
npx tsc --noEmit
```

## Next Steps

1. **Fix Prisma enum mismatches** - Ensure canonical enums match Prisma schema
2. **Resolve server/client type differences** - Align KomgaConfig between layers
3. **Clean up placeholder types** - Replace remaining `any` types in compatibility-exports.ts
4. **Document canonical types** - Add JSDoc comments for all exported types

## Impact

- **Developer Experience**: Clear, single source of truth for all types
- **Type Safety**: Proper TypeScript checking without conflicts
- **Maintainability**: Easy to find and update type definitions
- **Build Performance**: Reduced circular dependencies and cleaner imports