# Use Metadata Fixes

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Use Metadata Fixes

---
# useMetadata.ts TypeScript Error Fixes

This document outlines the TypeScript errors that were fixed in the useMetadata.ts file and explains the approach used to systematically address these issues. The document has been updated with the latest fixes applied to the hook.

## Summary

The `useMetadata.ts` hook provides functionality for managing manga metadata operations, including binding manga to AniList IDs and refreshing metadata from various sources. The file had several TypeScript errors that needed to be addressed to improve type safety and ensure proper integration with the application's domain model. Recent fixes addressed incorrect usage of AsyncResult pattern functions.

## Error Patterns and Fixes

### 1. Incorrect Import Paths

**Problem**: The file used `@/` path aliases which TypeScript couldn't resolve correctly.

**Example (original):**
```typescript
import { trpc } from '@/utils/trpcClient';
import { useNotification } from './useNotification';
import { MangaMetadata } from '@/types/domain';
```

**Fix:**
```typescript
import { trpc } from '../utils/trpcClient';
import { useNotification } from './useNotification';
import { MangaMetadata } from '../types/domain/manga-types';
```

**Explanation**: Changed import paths from the `@/` format to relative paths that TypeScript can properly resolve. Also, imported `MangaMetadata` directly from the specific module where it's defined (`manga-types.ts`) rather than from the barrel file.

### 2. Unsafe Optional Chaining

**Problem**: The code used optional chaining (`?.`) with `trpc.manga` but didn't handle the case where the endpoint might not exist.

**Example (original):**
```typescript
const metadataQuery = trpc.manga?.detail.useQuery(
  { id: mangaId },
  { enabled: Boolean(mangaId) }
);
```

**Fix:**
```typescript
// Safely access trpc endpoints with proper type checking
const manga = trpc.manga;
if (!manga) {
  throw new Error('manga endpoint not available in trpc');
}

const metadataQuery = manga.detail.useQuery(
  { id: mangaId },
  { enabled: Boolean(mangaId) }
);
```

**Explanation**: Added explicit null checking for the `trpc.manga` endpoint before using it, and stored the result in a variable to avoid repetitive optional chaining, making the code more robust against runtime errors.

### 3. Unsafe Type Assertion

**Problem**: The code used an unsafe type assertion when accessing the metadata property.

**Example (original):**
```typescript
return {
  metadata: metadataQuery.data?.metadata as MangaMetadata | undefined,
  // ...
};
```

**Fix:**
```typescript
// Type-safe metadata extraction
let metadata: MangaMetadata | undefined;

if (metadataQuery.data?.metadata) {
  metadata = metadataQuery.data.metadata as MangaMetadata;
}

return {
  metadata,
  // ...
};
```

**Explanation**: Added an explicit null check before the type assertion, and used a local variable to hold the properly typed metadata, which makes the code more robust and easier to debug.

### 4. Missing Return Type Annotations

**Problem**: The async functions didn't have explicit return type annotations.

**Example (original):**
```typescript
const bindAnilistId = async (anilistId: string, title: string, description: string) => {
  // ...
};
```

**Fix:**
```typescript
const bindAnilistId = async (anilistId: string, title: string, description: string): Promise<void> => {
  // ...
};
```

**Explanation**: Added explicit `Promise<void>` return type annotations to the async functions, making their intent clearer and helping TypeScript better check for correct usage.

### 5. Improved Function Documentation

**Problem**: The functions lacked proper JSDoc comments describing their purpose and parameters.

**Fix:** Added detailed JSDoc comments to each function:

```typescript
/**
 * Binds a manga to an AniList ID
 * 
 * @param anilistId - The AniList ID to bind to
 * @param title - The title of the manga
 * @param description - The description of the manga
 */
const bindAnilistId = async (anilistId: string, title: string, description: string): Promise<void> => {
  // ...
};
```

**Explanation**: Enhanced the function documentation to clarify the purpose of each parameter and the function's overall role, which helps with code maintenance and aids TypeScript's type checking.

## Overall Approach

The fixes follow a systematic approach to TypeScript error correction:

1. **Import Path Correction**: Replace `@/` path aliases with relative paths.
2. **Null Safety**: Add explicit null checks before using optional properties.
3. **Type Safety**: Use proper type annotations and safer type assertions.
4. **Explicit Return Types**: Add return type annotations to all functions.
5. **Enhanced Documentation**: Improve JSDoc comments for better developer experience.

## Impact of Changes

These fixes improve the type safety of the useMetadata hook by:

1. Preventing potential runtime errors from accessing properties that might be undefined.
2. Making the code more maintainable with proper type annotations.
3. Enhancing the developer experience with better documentation.
4. Ensuring the hook integrates correctly with the domain model.

The patterns used in these fixes can be applied to other hooks and components throughout the codebase to systematically reduce TypeScript errors.

## Testing Considerations

When implementing these fixes, consider testing:

1. Binding operations with valid and invalid AniList IDs
2. Metadata refresh functionality
3. Error handling scenarios
4. Integration with the UI components that use this hook

## Recent Fixes (Phase 46)

### 1. fromPromiseCatch Usage

**Problem**: The `fromPromiseCatch` function was being used incorrectly, passing a function reference instead of a Promise.

**Example (original):**
```typescript
const result = await fromPromiseCatch<void, Error>(async () => {
  // Set loading state while binding
  setMetadataState(prev => isSuccess(prev) 
    ? { ...prev, status: 'loading' as const } 
    : createLoadingResult(getDataOr(prev, undefined)));
  
  await bindMutation.mutateAsync({
    mangaId,
    anilistId,
    title,
    detail: description, // The API still uses 'detail' but we've renamed the parameter for clarity
  });
  
  // Refetch to update metadata after binding
  await metadataQuery.refetch();
}, (error) => new Error(`Failed to bind to AniList: ${error instanceof Error ? error.message : String(error)}`));
```

**Fix:**
```typescript
// Set loading state while binding
setMetadataState(prev => isSuccess(prev) 
  ? { ...prev, status: 'loading' as const } 
  : createLoadingResult());
  
const result = await fromPromiseCatch<void, Error>(
  bindMutation.mutateAsync({
    mangaId,
    anilistId,
    title,
    detail: description, // The API still uses 'detail' but we've renamed the parameter for clarity
  }).then(async () => {
    // Refetch to update metadata after binding
    await metadataQuery.refetch();
  }),
  (error) => new Error(`Failed to bind to AniList: ${error instanceof Error ? error.message : String(error)}`)      
);
```

**Explanation**: The `fromPromiseCatch` function expects a Promise as its first argument, not an async function. The code was fixed to pass the actual Promise chain directly, using `.then()` to chain operations.

### 2. createLoadingResult Usage

**Problem**: The `createLoadingResult` function was being called with an argument, but its implementation doesn't accept any parameters.

**Example (original):**
```typescript
createLoadingResult(getDataOr(prev, undefined))
```

**Fix:**
```typescript
createLoadingResult()
```

**Explanation**: Reviewed the implementation of `createLoadingResult` in `shared-types.ts` which shows it doesn't accept any parameters. Removed the incorrect parameter passing.

### 3. tRPC Query Hooks

**Problem**: The code was using the callback-based approach with `onSuccess` and `onError` which isn't compatible with the current tRPC version.

**Example (original):**
```typescript
const metadataQuery = manga.detail.useQuery(
  { id: mangaId },
  { 
    enabled: Boolean(mangaId),
    onSuccess: (data) => {
      // Handle success...
    },
    onError: (error) => {
      // Handle error...
    },
    // Other options...
  }
);
```

**Fix:**
```typescript
const metadataQuery = manga.detail.useQuery(
  { id: mangaId },
  { 
    enabled: Boolean(mangaId),
    // Other options...
  }
);

// Handle state changes reactively
useEffect(() => {
  if (metadataQuery.isLoading) {
    // Handle loading state...
  } else if (metadataQuery.isError) {
    // Handle error state...
  } else if (metadataQuery.isSuccess) {
    // Handle success state...
  }
}, [metadataQuery.status, metadataQuery.data, metadataQuery.error]);
```

**Explanation**: Updated to use a reactive approach with `useEffect` to handle query state changes, which is more compatible with current React patterns and the tRPC version used in the project.

## Related Files

- `src/types/domain/manga-types.ts` - Contains the `MangaMetadata` type definition
- `src/utils/trpcClient.ts` - Contains the trpc client configuration
- `src/hooks/useNotification.ts` - Contains the notification functionality used by this hook
- `src/utils/async-result.ts` - Contains AsyncResult type definitions and helper functions
- `src/utils/async-result-helpers.ts` - Contains additional AsyncResult utility functions
- `src/types/shared-types.ts` - Contains the implementation of createLoadingResult and other base functions

## Patterns to Apply in Other Files

These fixes demonstrate several patterns that should be applied to other hooks and components:

1. **Proper fromPromiseCatch Usage**: Always pass Promises directly to fromPromiseCatch, not async functions
2. **Reactive Query Handling**: Use useEffect to handle query state changes instead of callbacks
3. **Correct Parameter Usage**: Check function signatures before passing parameters
4. **AsyncResult Pattern**: Use the AsyncResult pattern consistently for all async operations

Files that should be reviewed for similar issues:
- `src/hooks/useManga.ts`
- `src/hooks/useMetadataProviders.ts` 
- `src/hooks/useBatchUpdates.ts`
- Other hooks using AsyncResult pattern