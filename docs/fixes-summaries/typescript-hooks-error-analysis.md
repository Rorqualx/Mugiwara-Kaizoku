# TypeScript Error Analysis Report - Hooks Directory

*Date: 2025-08-30*  
*Total Errors: 115*  
*Files Affected: 23*

## Executive Summary

The TypeScript errors in the hooks directory primarily stem from:
1. **Import path issues** (45% of errors) - Missing exports and incorrect module paths
2. **Type parameter mismatches** (30% of errors) - Generic types expecting wrong number of arguments
3. **Missing type definitions** (15% of errors) - Entities not properly exported
4. **Configuration type mismatches** (10% of errors) - Missing required properties

## Error Categories and Analysis

### 1. Module Import Issues (52 errors)

#### Pattern: Missing or incorrect exports
**Affected files:**
- `useChapterSync.ts` - ID type not exported from id-utils
- `useErrorBoundary.tsx` - clientLogger not exported correctly  
- `useMetadata.ts` - fromPromiseCatch not exported
- `useSettings.ts` - Cannot resolve '@/types/canonical'

**Root Cause:** 
The codebase has undergone type consolidation, but imports haven't been updated to reflect the new structure. The canonical types are now in `src/types/canonical/` subdirectory.

**Resolution:**
```typescript
// Instead of:
import { ID } from '@/utils/id-utils';
// Use:
import type { ID } from '@/types/shared-types';

// Instead of:
import { IntegrationSettings } from '@/types/canonical';
// Use:
import { IntegrationSettings } from '@/types/canonical/integration-settings.types';
```

### 2. Generic Type Parameter Errors (34 errors)

#### Pattern: Expected 0 type arguments, but got 2
**Affected files:**
- `useChapterSync.ts` (4 instances)
- `useDomainSearch.ts` (3 instances)
- `useDownload.ts` (6 instances)
- `useMetadata.ts` (4 instances)

**Root Cause:**
Functions like `createSuccessResult`, `createErrorResult`, and `createLoadingResult` are being called with type parameters when they shouldn't be, or the type parameters are incorrectly specified.

**Resolution:**
```typescript
// Instead of:
createSuccessResult<DataType, Error>(data);
// Use:
createSuccessResult(data);

// Or if type parameters are needed, ensure the function signature supports them:
createSuccessResult<DataType>(data);
```

### 3. Missing Entity Type Definitions (17 errors)

#### Pattern: Cannot find name 'MangaEntity' / 'ChapterEntity'
**Affected files:**
- `useLibrary.ts` 
- `useMetadataProviders.ts` (7 instances)

**Root Cause:**
Entity types exist but are not imported properly. They're defined in multiple locations:
- `src/types/canonical/entities.types.ts`
- `src/types/clientTypes.ts`

**Resolution:**
```typescript
// Add proper imports:
import type { MangaEntity, ChapterEntity } from '@/types/canonical/entities.types';
```

### 4. MangaStatus Type Usage Errors (3 errors)

#### Pattern: 'MangaStatus' refers to a value, but is being used as a type
**Affected files:**
- `useLibrary.ts`
- `useManga.ts` (2 instances)

**Root Cause:**
MangaStatus is an enum (value), not a type. When using it as a type annotation, TypeScript needs `typeof`.

**Resolution:**
```typescript
// Instead of:
status: MangaStatus
// Use:
status: typeof MangaStatus[keyof typeof MangaStatus]
// Or:
import { MangaStatus } from '@/types/domain/manga-types';
status: MangaStatus  // This should work if MangaStatus is properly exported as enum
```

### 5. Configuration Type Issues (9 errors)

#### Pattern: Missing required properties
**Affected files:**
- `useDelugeConfig.ts` - Missing 'enabled' property
- `useFandomConfig.ts` - Missing 'enabled' property
- `useNZBGetConfig.ts` - Property 'apiKey' doesn't exist
- `useSABnzbdConfig.ts` - Type mismatches

**Root Cause:**
Configuration interfaces have been updated but the hooks still use old property names or are missing required fields.

**Resolution:**
```typescript
// Ensure all required properties are included:
const config: DelugeConfig = {
  enabled: true,  // Add missing property
  baseURL: string,
  password: string,
  category: string
};
```

## Detailed Error Breakdown by File

### useSettings.ts (34 errors)
- Import path issue with '@/types/canonical'
- Cascading errors from missing type definitions

### useMetadataProviders.ts (17 errors)  
- Missing MangaEntity and ChapterEntity imports
- fromPromiseCatch function not found

### useManga.ts (9 errors)
- MangaStatus type usage errors
- Missing properties on response types
- Type incompatibilities with monitoring config

### useDownload.ts (7 errors)
- Generic type parameter mismatches
- Unknown property 'downloadStatus'

### useChapterSync.ts (5 errors)
- ID type not exported
- Generic type parameter issues

## Proposed Solution Strategy

### Phase 1: Fix Import Paths (Priority: HIGH)
1. Update all canonical type imports to use correct subdirectory paths
2. Fix entity type imports from canonical location
3. Ensure ID type is properly exported and imported

### Phase 2: Fix Type Parameters (Priority: HIGH)
1. Remove unnecessary type parameters from AsyncResult functions
2. Ensure generic functions match their signatures

### Phase 3: Fix Configuration Types (Priority: MEDIUM)
1. Add missing 'enabled' properties to config types
2. Remove or update deprecated properties like 'apiKey'

### Phase 4: Fix Enum Usage (Priority: MEDIUM)
1. Correct MangaStatus type annotations
2. Ensure proper enum imports from domain types

## Implementation Checklist

- [ ] Create type migration script to update import paths
- [ ] Update AsyncResult function calls to match signatures
- [ ] Add missing entity type imports
- [ ] Fix configuration interfaces to match current requirements
- [ ] Update MangaStatus usage to follow canonical pattern
- [ ] Run type check after each phase to verify fixes

## Commands for Verification

```bash
# Check specific hook file
npx tsc --noEmit src/hooks/useSettings.ts

# Check all hooks
npx tsc --noEmit src/hooks/**/*.ts

# Generate fresh error report
npx tsc --noEmit 2>&1 | grep -E "src/hooks/.*\.ts" > hooks-errors.txt
```

## Risk Assessment

**Low Risk:**
- Import path updates
- Adding missing type imports

**Medium Risk:**
- Changing generic type parameters (may affect runtime behavior)
- Configuration property changes (may affect functionality)

**High Risk:**
- None identified

## Recommendations

1. **Immediate Actions:**
   - Fix import paths for canonical types
   - Add missing entity type imports
   - This will resolve ~60% of errors

2. **Short-term Actions:**
   - Fix AsyncResult generic parameters
   - Update configuration types
   - Correct enum usage

3. **Long-term Actions:**
   - Consider creating a types index file for easier imports
   - Add type tests to prevent regression
   - Document the canonical type structure

## Conclusion

The majority of TypeScript errors are import-related and can be resolved quickly with proper path updates. The remaining errors require careful attention to type signatures and configuration requirements. Following the phased approach will minimize risk while systematically eliminating all type errors.