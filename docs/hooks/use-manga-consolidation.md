# Use Manga Consolidation

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Use Manga Consolidation

---
# useManga Hook Consolidation Plan

This document outlines the detailed plan for consolidating `src/hooks/useManga.fixed.ts` into `src/hooks/useManga.ts`.

## Analysis

### Key Features in Fixed Hook

The fixed useManga hook (`useManga.fixed.ts`) likely provides:

1. **Improved Type Safety**:
   - Better TypeScript typing for manga entities and operations
   - Proper generic types for AsyncResult pattern
   - Type guards for safer property access

2. **Enhanced Error Handling**:
   - Consistent AsyncResult pattern implementation
   - Contextual error information
   - Proper error propagation

3. **Performance Optimizations**:
   - Memoization for stability of callback functions
   - Optimized state updates

4. **Documentation**:
   - Improved JSDoc comments for better developer experience
   - Clear function and parameter descriptions

### Key Features in Base Hook

The base useManga hook (`useManga.ts`) likely contains:

1. **Core Functionality**:
   - Manga data fetching and management
   - State management for manga entities
   - CRUD operations for manga entities
   - Integration with API clients

2. **Existing State Management**:
   - Loading state tracking
   - Error handling (possibly with room for improvement)
   - Data caching

## Implementation Plan

### 1. Create Backup

```bash
cp src/hooks/useManga.ts docs/backups/useManga.backup.ts
```

### 2. Import Statements

Update import statements in the base hook:

```typescript
// Standard library imports
import { useState, useCallback, useEffect, useMemo } from 'react';

// AsyncResult pattern imports
import { 
  AsyncResult, 
  createSuccessResult,
  createErrorResult,
  createLoadingResult,
  createIdleResult,
  isSuccess,
  isError,
  isLoading,
  isIdle
} from '../utils/async-result';

// Domain types
import { MangaEntity, MangaWithChapters } from '../types/domain/manga-types';

// API client and utilities
import { trpc } from '../utils/trpcClient';
import { logger } from '../utils/logging';
```

### 3. Update Type Definitions

Enhance type definitions for better type safety:

```typescript
/**
 * Manga detail response with standardized typing
 */
export interface MangaDetailResponse {
  /** The manga entity with normalized data */
  manga: MangaWithChapters;
  /** Whether the manga has out-of-sync chapters */
  hasOutOfSyncChapters: boolean;
  /** Additional metadata (optional) */
  metadata?: {
    /** Last updated timestamp */
    lastUpdated?: string | Date;
    /** Source information */
    source?: string;
    /** Any additional provider-specific data */
    [key: string]: unknown;
  };
}

/**
 * UseManga hook return type
 */
export interface UseMangaResult {
  /** The manga entity with all data */
  manga: AsyncResult<MangaWithChapters, Error>;
  /** Function to refresh manga data */
  refreshManga: (id: string | number) => Promise<void>;
  /** Function to update manga data */
  updateManga: (data: Partial<MangaEntity>) => Promise<boolean>;
  /** Function to delete manga */
  deleteManga: (id: string | number) => Promise<boolean>;
  /** Whether there are out-of-sync chapters */
  hasOutOfSyncChapters: boolean;
  /** Loading state for specific operations */
  loadingState: {
    /** Whether manga data is being fetched */
    fetchingManga: boolean;
    /** Whether manga is being updated */
    updatingManga: boolean;
    /** Whether manga is being deleted */
    deletingManga: boolean;
  };
}
```

### 4. Implement AsyncResult Pattern

Update the hook implementation to use AsyncResult pattern:

```typescript
/**
 * Hook for managing manga data with proper type safety and error handling
 * 
 * @param id - Optional manga ID to fetch on mount
 * @returns Object containing manga data and operations
 */
export function useManga(id?: string | number): UseMangaResult {
  // State with AsyncResult pattern
  const [manga, setManga] = useState<AsyncResult<MangaWithChapters, Error>>(createIdleResult());
  const [hasOutOfSyncChapters, setHasOutOfSyncChapters] = useState<boolean>(false);
  
  // Loading states for specific operations
  const [loadingState, setLoadingState] = useState({
    fetchingManga: false,
    updatingManga: false,
    deletingManga: false
  });
  
  // TRPC queries and mutations
  const getMangaQuery = trpc.manga.getById.useQuery(
    { id: id ? String(id) : '' },
    { 
      enabled: !!id,
      refetchOnWindowFocus: false
    }
  );
  
  const updateMangaMutation = trpc.manga.update.useMutation();
  const deleteMangaMutation = trpc.manga.delete.useMutation();
  
  // Set loading state helper with type safety
  const setLoading = useCallback((operation: keyof typeof loadingState, isLoading: boolean) => {
    setLoadingState(prev => ({
      ...prev,
      [operation]: isLoading
    }));
  }, []);
  
  // Update manga state from query
  useEffect(() => {
    if (getMangaQuery.isLoading) {
      setManga(createLoadingResult());
      setLoading('fetchingManga', true);
    } else if (getMangaQuery.isError) {
      setManga(createErrorResult(
        getMangaQuery.error instanceof Error 
          ? getMangaQuery.error 
          : new Error('Failed to fetch manga')
      ));
      setLoading('fetchingManga', false);
    } else if (getMangaQuery.data) {
      setManga(createSuccessResult(getMangaQuery.data.manga));
      setHasOutOfSyncChapters(getMangaQuery.data.hasOutOfSyncChapters || false);
      setLoading('fetchingManga', false);
    }
  }, [getMangaQuery.isLoading, getMangaQuery.isError, getMangaQuery.data, setLoading]);
  
  // Refresh manga function with error handling
  const refreshManga = useCallback(async (mangaId: string | number): Promise<void> => {
    if (!mangaId) {
      setManga(createErrorResult(new Error('Cannot refresh manga: No ID provided')));
      return;
    }
    
    setManga(createLoadingResult());
    setLoading('fetchingManga', true);
    
    try {
      await getMangaQuery.refetch();
    } catch (error) {
      logger.error(`Failed to refresh manga: ${error instanceof Error ? error.message : String(error)}`);
      setManga(createErrorResult(
        error instanceof Error 
          ? error 
          : new Error(`Failed to refresh manga: ${String(error)}`)
      ));
    } finally {
      setLoading('fetchingManga', false);
    }
  }, [getMangaQuery, setLoading]);
  
  // Update manga function with AsyncResult pattern
  const updateManga = useCallback(async (data: Partial<MangaEntity>): Promise<boolean> => {
    if (!id) {
      logger.error('Cannot update manga: No ID provided');
      return false;
    }
    
    setLoading('updatingManga', true);
    
    try {
      const result = await updateMangaMutation.mutateAsync({
        id: String(id),
        ...data
      });
      
      if (result.success) {
        await getMangaQuery.refetch();
        return true;
      } else {
        logger.error(`Failed to update manga: ${result.message || 'Unknown error'}`);
        return false;
      }
    } catch (error) {
      logger.error(`Error updating manga: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    } finally {
      setLoading('updatingManga', false);
    }
  }, [id, updateMangaMutation, getMangaQuery, setLoading]);
  
  // Delete manga function with AsyncResult pattern
  const deleteManga = useCallback(async (mangaId: string | number): Promise<boolean> => {
    if (!mangaId) {
      logger.error('Cannot delete manga: No ID provided');
      return false;
    }
    
    setLoading('deletingManga', true);
    
    try {
      const result = await deleteMangaMutation.mutateAsync({
        id: String(mangaId)
      });
      
      return result.success;
    } catch (error) {
      logger.error(`Error deleting manga: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    } finally {
      setLoading('deletingManga', false);
    }
  }, [deleteMangaMutation, setLoading]);
  
  // Return hook result with memoization for stability
  return useMemo(() => ({
    manga,
    refreshManga,
    updateManga,
    deleteManga,
    hasOutOfSyncChapters,
    loadingState
  }), [
    manga, 
    refreshManga, 
    updateManga, 
    deleteManga, 
    hasOutOfSyncChapters, 
    loadingState
  ]);
}
```

### 5. Add Utility Functions

Add any utility functions from the fixed hook that enhance functionality:

```typescript
/**
 * Creates a default manga entity with required fields
 * 
 * @returns A default manga entity
 */
export function createDefaultManga(): MangaEntity {
  return {
    id: '',
    title: '',
    description: '',
    coverUrl: '',
    chapters: [],
    source: '',
    sourceId: '',
    status: 'unknown',
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

/**
 * Hook for using manga with default values when loading or error occurs
 * 
 * @param id - Optional manga ID to fetch on mount
 * @param defaultManga - Optional default manga to use when loading or error
 * @returns UseMangaResult with guaranteed manga data (never undefined)
 */
export function useMangaWithDefaults(
  id?: string | number,
  defaultManga: MangaWithChapters = createDefaultManga() as MangaWithChapters
): Omit<UseMangaResult, 'manga'> & { manga: MangaWithChapters } {
  const result = useManga(id);
  
  // Extract manga with fallback to default
  const mangaValue = useMemo(() => {
    if (isSuccess(result.manga)) {
      return result.manga.data;
    }
    return defaultManga;
  }, [result.manga, defaultManga]);
  
  // Return result with guaranteed manga value
  return useMemo(() => ({
    ...result,
    manga: mangaValue
  }), [result, mangaValue]);
}
```

### 6. Verification Steps

1. Run TypeScript type checking:
   ```bash
   npm run type-check
   ```

2. Check for error reduction related to the useManga hook

3. Verify that all code that previously used the hook works correctly with the updated version

### 7. Remove Duplicate File

Once verification is complete, remove the fixed file:

```bash
rm src/hooks/useManga.fixed.ts
```

## Expected Outcome

After implementing this consolidation:

1. The useManga hook will have improved type safety with AsyncResult pattern
2. Error handling will be more robust and consistent
3. The hook API will be more predictable and well-documented
4. Performance will be optimized with proper memoization
5. The codebase will have one fewer file
6. All components using this hook will benefit from the improvements