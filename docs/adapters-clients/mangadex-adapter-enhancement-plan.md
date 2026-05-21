# Mangadex Adapter Enhancement Plan

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Mangadex Adapter Enhancement Plan

---
# MangadexAdapter Enhanced Error Handling Implementation Plan

## Current State Analysis

The MangadexAdapter in `src/api/metadataProviders/adapters/mangadexAdapter.ts` already has some error handling using try/catch blocks and the AsyncResult pattern, but it doesn't yet implement the enhanced error handling patterns used in the FandomAdapter and ComicVineAdapter.

### Key Missing Features:
1. No `createContextualError` property for enhanced error creation
2. Not using the `withEnhancedErrorHandling` function for consistent error context
3. Error return types don't specify `ContextualError` instead of `Error`
4. Missing proper error context information in many methods

## Implementation Steps

### 1. Add Required Imports
```typescript
import { 
  withEnhancedErrorHandling,
  createContextualErrorCreator,
  ContextualError,
  ContextualErrorCreator
} from '../../../api/utils/errorHandling';
```

### 2. Add the createContextualError Property
Add to class properties:
```typescript
private createContextualError: ContextualErrorCreator;
```

### 3. Initialize in Constructor
In the constructor method, add:
```typescript
// Initialize contextual error creator
this.createContextualError = createContextualErrorCreator({
  service: 'MangadexAdapter',
  resourceType: 'manga'
});
```

### 4. Update Method Return Types
Change method return types from:
```typescript
Promise<AsyncResult<T, Error>>
```
to:
```typescript
Promise<AsyncResult<T, ContextualError>>
```

### 5. Implement Enhanced Error Handling in Methods

Update each method in the following order:

1. **searchAsync**
   - Replace try/catch with withEnhancedErrorHandling
   - Add context with operation, service, and query details

2. **getMangaByIdAsync**
   - Replace try/catch with withEnhancedErrorHandling
   - Add context with operation, service, resourceId

3. **getMangaByTitleAsync**
   - Replace try/catch with withEnhancedErrorHandling
   - Add context with operation, service, title details

4. **getChaptersAsync**
   - Replace try/catch with withEnhancedErrorHandling
   - Add context with operation, service, resourceId, resourceType

5. **getStatusAsync**
   - Replace try/catch with withEnhancedErrorHandling
   - Add context with operation, service, resourceType: 'service'

6. **getTrendingAsync**
   - Replace try/catch with withEnhancedErrorHandling
   - Add context with operation, service, limit details

7. **getChapterPagesAsync**
   - Replace try/catch with withEnhancedErrorHandling
   - Add context with operation, service, resourceId, resourceType: 'chapter'

8. **updateMangaMetadataAsync**
   - Replace try/catch with withEnhancedErrorHandling
   - Add context with operation, service, resourceId, mangaId details

9. **updateAllMangaMetadataAsync**
   - Replace try/catch with withEnhancedErrorHandling
   - Add context with operation, service, limit details

10. **searchMangaAsync**
    - Replace try/catch with withEnhancedErrorHandling
    - Add context with operation, service, query details

### 6. Example Implementation for searchAsync

```typescript
public async searchAsync(query: string, options?: SearchOptions): Promise<AsyncResult<MangaSearchResult[], ContextualError>> {
  return withEnhancedErrorHandling(async () => {
    // Validate input
    if (!query || typeof query !== 'string') {
      throw this.createContextualError('Search query must be a non-empty string', 'searchAsync');
    }
    
    // Map adapter options to MangaDex options with type safety
    const mangadexOptions: MangaDexSearchOptions = {
      query,
      limit: options?.limit ?? 20,
      offset: options?.offset ?? 0,
      includeAdult: options?.includeAdult ?? this.config.includeAdult ?? false
    };
    
    // Add genres if provided with type validation
    if (options?.genres && Array.isArray(options.genres) && options.genres.length > 0) {
      mangadexOptions.genres = options.genres;
    }
    
    // Add status if provided with type validation
    if (options?.status && Array.isArray(options.status) && options.status.length > 0) {
      // For MangaDex, we can only use the first status in the array
      mangadexOptions.status = this.mapStatus(options.status[0]);
    }
    
    // Use the standardized client's search method
    const result = await this.client.search(mangadexOptions);
    
    // Handle different AsyncResult states with proper type checking
    if (!isSuccess(result)) {
      if (isError(result)) {
        throw this.createContextualError(
          `Search failed with error: ${result.error instanceof Error ? result.error.message : String(result.error)}`,
          'searchAsync'
        );
      }
      throw this.createContextualError(`Search operation failed for query: ${query}`, 'searchAsync');
    }
    
    // Type check the result data
    if (!Array.isArray(result.data)) {
      return [];
    }
    
    // Convert results to MangaSearchResult format with explicit type safety
    const mangaResults: MangaSearchResult[] = result.data.map((manga: unknown): MangaSearchResult => {
      // Existing implementation...
    });
    
    return mangaResults;
  }, {
    operation: 'searchAsync',
    service: 'MangadexAdapter',
    resourceType: 'manga',
    details: { 
      query,
      options 
    }
  });
}
```

### 7. Update Synchronous Interface Methods

For each synchronous method that uses its async counterpart (like `search`, `getMangaById`, etc.), update the error handling to use the contextual error:

```typescript
public async search(query: string, options?: SearchOptions): Promise<MangaSearchResult[]> {
  const result = await this.searchAsync(query, options);
  
  if (isSuccess(result)) {
    return result.data;
  }
  
  if (isError(result)) {
    throw result.error;
  }
  
  if (isLoading(result)) {
    throw this.createContextualError('Search operation is still loading', 'search');
  }
  
  if (isIdle(result)) {
    throw this.createContextualError('Search operation has not started', 'search');
  }
  
  throw this.createContextualError(`Failed to search MangaDex with query "${query}"`, 'search');
}
```

## Verification

After implementing all changes:

1. Run TypeScript verification to ensure no type errors
2. Check for consistency with other adapters like FandomAdapter and ComicVineAdapter
3. Verify error handling covers all expected failure paths
4. Ensure proper context is provided for all operations

## Benefits

1. Standardized error handling across all adapters
2. Detailed error context for better debugging
3. Consistent error typing with ContextualError
4. Improved error messages with operation and resource details
5. Enhanced maintainability with consistent patterns