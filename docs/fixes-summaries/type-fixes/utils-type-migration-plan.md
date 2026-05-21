# Utils Directory Type Migration Plan

## Overview
Complete migration to remove backwards compatibility layers and fix all TypeScript errors in the utils directory.

## Current State
- **Total Errors**: 95 errors across 24 files in src/utils
- **Main Issue**: Missing type exports from canonical (60% of errors)
- **Secondary Issue**: Enum usage errors and compatibility layers

## Migration Phases

### Phase 1: Export Missing Types from Canonical
**Files to modify**: src/types/canonical/index.ts

**Types to export**:
```typescript
// From metadata-model.ts
export {
  ContentRating,
  PublicationDemographic,
  NormalizedMetadata,
  NormalizedChapter,
  AuthorInfo,
  RelatedLink
} from '../metadata-model';

// From metadata-types.ts  
export {
  FieldPreference,
  MangaMetadataPreferences
} from '../metadata-types';

// Fix ExtendedSearchResult alias
export type ExtendedSearchResult = ExtendedMangaSearchResult;

// Add getProviderField function
export { getProviderField } from '../metadata-utils';
```

### Phase 2: Fix Enum Usage Errors
**Files to fix**:
1. src/utils/entityMetadataUtils.ts
   - Replace `MangaStatus` with `MangaPublicationStatus`
   - Import `MetadataProvenance` from canonical

2. src/utils/integration-adapter.ts
   - Replace all `MangaStatus` with `MangaPublicationStatus`

3. src/utils/db-to-domain.ts
   - Fix EventCategory assignments (using wrong enum)
   - Fix UserRole being used as value instead of type
   - Import proper enums from canonical

### Phase 3: Fix Type Adapters
**Files to fix**:
1. src/utils/frontend/type-adapters.ts
   - Fix array type mismatches ({ name: string }[] to string[])
   - Add missing 'provider' property
   - Update MangaPublicationStatus enum usage

2. src/utils/frontend/compatibility.ts
   - Add 'provider' property to search results
   - Fix metadata undefined checks

3. src/utils/converters/MangaConverter.ts
   - Remove duplicate 'number' property
   - Fix property naming conflicts

### Phase 4: Remove Deprecated Compatibility
**Files to remove/clean**:
1. src/utils/compatibility-map.ts
2. src/utils/status-mapping.ts
3. src/utils/status-mapping-v2.ts
4. src/utils/task-compatibility.ts
5. src/utils/typescript-compat.ts

**Update imports** in all files to use canonical types directly.

## Execution Order

1. **Export missing types** (fixes 60% of errors immediately)
2. **Fix enum usage** (fixes 20% of errors)
3. **Fix type adapters** (fixes 15% of errors)
4. **Clean up compatibility** (fixes remaining 5%)

## Expected Outcome
- 0 TypeScript errors in utils directory
- All types imported from @/types/canonical
- No backwards compatibility layers
- Clean, maintainable type system

## Breaking Changes
- All consumers must use canonical types
- No more compatibility imports
- Strict enum usage enforcement