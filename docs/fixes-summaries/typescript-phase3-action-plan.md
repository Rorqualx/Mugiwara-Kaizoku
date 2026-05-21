# TypeScript Phase 3 Action Plan - Remaining 71 Errors

*Date: 2025-08-30*  
*Errors Remaining: 71 (down from 115)*  
*Progress: 38% reduction achieved in Phase 1&2*

## Executive Summary

After completing Phase 1 (import paths) and Phase 2 (AsyncResult/configs), the remaining errors fall into 4 distinct categories requiring targeted solutions:

1. **Module Resolution Issues** (25% - 18 errors)
2. **Zod Schema Type Incompatibilities** (35% - 25 errors)  
3. **TRPC Router Type Issues** (20% - 14 errors)
4. **Provider Configuration Properties** (20% - 14 errors)

## Detailed Error Analysis & Solutions

### Category 1: Module Resolution Issues (18 errors)

#### Problem 1.1: Missing Module Files
**Files affected:**
- `useComicvineConfig.ts` → Missing `./useComicvineConfigTRPC`
- `useOptimisticMutation.ts` → Missing `../types/api/error-types`
- `useSettings.ts` → Missing `@/types/clientTypes`

**Root Cause:** Files were deleted during consolidation but imports weren't updated.

**Solution:**
```typescript
// useComicvineConfig.ts - Remove the re-export, implement directly
import { trpc } from '@/utils/trpc-client';
import type { ComicVineSettings } from '@/types/canonical/integration-settings.types';

export function useComicvineConfig() {
  // Implement using trpc.config.comicvine
}

// useOptimisticMutation.ts - Use canonical error types
import type { ApiError } from '@/types/canonical/error.types';

// useSettings.ts - Remove unused import
// Delete: import { BackupSchedule } from '@/types/clientTypes';
```

#### Problem 1.2: Missing Exports
**Files affected:**
- `useLibrary.ts` → MangaStatus not exported from entities.types
- `useErrorBoundary.tsx` → clientLogger export issue

**Solution:**
```typescript
// Add to src/types/canonical/entities.types.ts
export { MangaStatus } from '../domain/manga-types';

// Fix clientLogger import
import { clientLogger } from '@/utils/logging/client-logger';
```

### Category 2: Zod Schema Type Incompatibilities (25 errors)

#### Problem 2.1: Complex Zod Output Types
**Files affected:**
- `useManga.ts` → ChapterEntity[] vs Zod schema output type
- `useMetadata.ts` → AsyncResult state type mismatch with Zod

**Root Cause:** TRPC returns Zod-validated types that don't match domain types exactly.

**Solution:**
```typescript
// useManga.ts - Cast the validated output
const chapters = result.data as unknown as ChapterEntity[];

// OR better - align the types
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '@/server/routers/_app';
type RouterOutput = inferRouterOutputs<AppRouter>;
type ChapterOutput = RouterOutput['manga']['getChapters'];
```

#### Problem 2.2: SetStateAction Type Mismatches
**Files affected:**
- `useMetadata.ts` (lines 345, 399) → setState type incompatibility

**Solution:**
```typescript
// Ensure consistent typing for state updates
const [state, setState] = useState<AsyncResult<MetadataType | undefined, Error>>(
  createIdleResult()
);

// When setting state, match the exact type
setState(createLoadingResult()); // Remove type parameters
setState(createSuccessResult(data)); // Let TypeScript infer
```

### Category 3: TRPC Router Type Issues (14 errors)

#### Problem 3.1: Missing Router Methods
**Files affected:**
- `useSettings.ts` → `settingsQuery` doesn't exist on trpc router

**Root Cause:** Router methods renamed or moved during refactoring.

**Solution:**
```typescript
// Check actual router implementation and use correct method
// Instead of: trpc.settingsQuery.useQuery()
// Use: trpc.settings.get.useQuery()
// OR: trpc.config.getSettings.useQuery()
```

#### Problem 3.2: IntegrationSettings Type Mismatch
**Files affected:**
- `useSettings.ts` → Properties like `suwayomiEnabled` don't exist

**Root Cause:** IntegrationSettings is a base type, specific settings need their own types.

**Solution:**
```typescript
// Create a comprehensive settings type
interface AppSettings {
  integrations: {
    suwayomi?: SuwayomiSettings;
    komga?: KomgaSettings;
    kavita?: KavitaSettings;
  };
  // Other settings...
}

// OR extend IntegrationSettings
interface ExtendedIntegrationSettings extends IntegrationSettings {
  suwayomiEnabled?: boolean;
  suwayomiServerPath?: string;
  // Add all needed properties
}
```

### Category 4: Provider Configuration Properties (14 errors)

#### Problem 4.1: Missing 'enabled' Property
**Files affected:**
- `useProviderConfig.ts` → 5 instances missing 'enabled'

**Solution:**
```typescript
// Add enabled to all provider configs
const PROVIDER_DEFAULTS: Record<string, ProviderConfig> = {
  anilist: {
    enabled: true, // Add this
    strength: 90,
    priority: 1,
    description: 'AniList provider'
  },
  // Repeat for all providers
};
```

#### Problem 4.2: Deprecated Properties
**Files affected:**
- `useProviderConfig.ts` → 'apiKey' doesn't exist on ProviderConfig
- `useSABnzbdConfig.ts` → Type mismatch for boolean property

**Solution:**
```typescript
// Remove apiKey references or add to type definition
interface ProviderConfig {
  enabled: boolean;
  strength: number;
  priority: number;
  description: string;
  apiKey?: string; // Add if needed
}

// Fix boolean type coercion
const enabled = Boolean(config.enabled); // Ensure boolean type
```

## Implementation Strategy

### Phase 3A: Quick Fixes (30 minutes)
1. Fix missing module files
   - Create `useComicvineConfigTRPC.ts` or update imports
   - Remove reference to deleted `clientTypes`
   - Fix error-types import

2. Add missing exports
   - Export MangaStatus from entities.types
   - Fix clientLogger export

3. Add 'enabled' property to all provider configs

### Phase 3B: Type Alignment (1 hour)
1. Create type mapping between Zod schemas and domain types
2. Update state types in useMetadata to match
3. Fix ChapterEntity array assignments

### Phase 3C: TRPC Router Updates (1 hour)
1. Identify correct TRPC router methods
2. Update all router calls to match actual implementation
3. Create proper settings type structure

### Phase 3D: Integration Settings Refactor (30 minutes)
1. Extend IntegrationSettings with all needed properties
2. Or create separate specific settings interfaces
3. Update useSettings to use correct types

## Verification Commands

```bash
# After each phase, verify progress
npx tsc --noEmit 2>&1 | grep -c "error TS"

# Check specific categories
# Module errors
npx tsc --noEmit 2>&1 | grep "TS2307"

# Type incompatibilities  
npx tsc --noEmit 2>&1 | grep "TS2345\|TS2322"

# Missing properties
npx tsc --noEmit 2>&1 | grep "TS2339\|TS2741"
```

## Risk Assessment

**Low Risk:**
- Adding missing exports
- Adding 'enabled' properties
- Fixing import paths

**Medium Risk:**
- Type casting for Zod schemas (ensure runtime safety)
- Changing TRPC method calls (test functionality)

**High Risk:**
- Modifying IntegrationSettings structure (affects multiple components)

## Expected Outcome

After Phase 3 completion:
- Module resolution errors: 18 → 0
- Zod type errors: 25 → ~5 (some may need runtime validation)
- TRPC errors: 14 → 0
- Provider config errors: 14 → 0

**Total: 71 → ~5 errors (93% reduction)**

## Next Steps

1. Execute Phase 3A for immediate wins
2. Carefully implement Phase 3B with proper type guards
3. Verify TRPC router structure before Phase 3C
4. Consider creating a unified settings system in Phase 3D

The remaining ~5 errors will likely be edge cases requiring specific domain knowledge or architectural decisions.