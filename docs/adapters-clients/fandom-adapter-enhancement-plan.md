# Fandom Adapter Enhancement Plan

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Fandom Adapter Enhancement Plan

---
# FandomAdapter Enhanced Error Handling Implementation Plan

This document outlines the plan for updating the FandomAdapter with enhanced error handling using the `withEnhancedErrorHandling` utility.

## Current Status

The FandomAdapter currently uses try/catch blocks for error handling in its async methods. We need to update it to use the `withEnhancedErrorHandling` utility for consistent error handling across all adapters.

## Implementation Steps

1. **Add Required Imports**
   ```typescript
   import { 
     withEnhancedErrorHandling,
     createContextualErrorCreator,
     ContextualError
   } from '../../../api/utils/errorHandling';
   ```

2. **Add Class Property for ContextualErrorCreator**
   ```typescript
   private createContextualError: ContextualErrorCreator;
   ```

3. **Initialize in Constructor**
   ```typescript
   constructor(config: Partial<FandomAdapterConfig>, prisma?: PrismaClient) {
     // Existing code...
     
     // Add contextual error creator
     this.createContextualError = createContextualErrorCreator({
       service: 'FandomAdapter',
       resourceType: 'manga'
     });
   }
   ```

4. **Update Method Return Types**
   Change return types from `Promise<AsyncResult<T, Error>>` to `Promise<AsyncResult<T, ContextualError>>`.

5. **Methods to Update**
   
   Below are the methods that need to be updated with their current line numbers:

   - `searchAsync` (lines 285-369)
   - `getMangaByIdAsync` (lines 377-450)
   - `getMangaByTitleAsync` (lines 487-557)
   - `getStatusAsync` (lines 592-601)
   - `updateMangaMetadataAsync` (lines 877-957)
   - `_searchManga` (lines 659-756)
   - `getMangaByExternalId` (lines 764-868)
   - `searchMangaAsync` (lines 1005-1097)
   - `updateAllMangaMetadataAsync` (lines 1135-1186)
   - `getChaptersAsync` (lines 1310-1473)

6. **Implementation Pattern for Each Method**

   Pattern for top-level methods:
   ```typescript
   public async methodName(...params): Promise<AsyncResult<ReturnType, ContextualError>> {
     return withEnhancedErrorHandling(async () => {
       // Existing implementation without try/catch wrapper
       // ...
       
       // Return value directly (not wrapped in createSuccessResult)
       return result;
     }, {
       operation: 'methodName',
       service: 'FandomAdapter',
       resourceType: 'manga',
       // Include relevant parameters
       details: { /* relevant parameters */ }
     });
   }
   ```

   Pattern for private helper methods:
   ```typescript
   private async _helperMethod(...params): Promise<AsyncResult<ReturnType, ContextualError>> {
     return withEnhancedErrorHandling(async () => {
       // Existing implementation without try/catch wrapper
       // ...
       
       // Return value directly (not wrapped in createSuccessResult)
       return result;
     }, {
       operation: '_helperMethod',
       service: 'FandomAdapter',
       resourceType: 'manga',
       // Include relevant parameters
       details: { /* relevant parameters */ }
     });
   }
   ```

7. **Update Non-AsyncResult Methods**

   For methods that unwrap AsyncResult (like `search`, `getMangaById`, etc.):
   ```typescript
   public async search(query: string, options?: SearchOptions): Promise<MangaSearchResult[]> {
     const result = await this.searchAsync(query, options);
     
     if (isSuccess(result)) {
       return result.data;
     }
     
     if (isError(result)) {
       throw result.error;
     }
     
     throw new Error(`Failed to search with query "${query}"`);
   }
   ```

8. **Testing After Implementation**
   - Run TypeScript checks to ensure type safety
   - Test functionality after updating each method
   - Ensure error contexts are properly propagated

## Method-Specific Context Information

Each method should include appropriate context details:

1. **searchAsync**
   - `query`: The search query
   - `options`: Search options

2. **getMangaByIdAsync**
   - `id`: The manga ID
   - `resourceId`: The manga ID

3. **getMangaByTitleAsync**
   - `title`: The manga title

4. **updateMangaMetadataAsync**
   - `mangaId`: The database manga ID
   - `resourceId`: The manga ID

5. **getChaptersAsync**
   - `mangaId`: The manga ID
   - `options`: Chapter fetch options

## Implementation Order

1. Start with the most critical methods:
   - `searchAsync`
   - `getMangaByIdAsync`
   - `getMangaByTitleAsync`

2. Then update supporting methods:
   - `_searchManga`
   - `getMangaByExternalId`

3. Finally update remaining methods:
   - `updateMangaMetadataAsync`
   - `updateAllMangaMetadataAsync`
   - `searchMangaAsync`
   - `getChaptersAsync`
   - `getStatusAsync`

## Special Considerations

1. **Error Translation**
   - The FandomAdapter uses custom error types that need to be properly translated to ContextualError.

2. **Nested AsyncResult Handling**
   - Some methods (like `getMangaByTitleAsync`) call other async methods and need to properly handle their AsyncResult return types.

3. **Error Context Standardization**
   - Ensure error contexts follow the same format used in other adapters for consistency.

After completing these updates, the FandomAdapter will have consistent error handling with detailed error contexts, improving the ability to debug issues and providing a better developer experience.