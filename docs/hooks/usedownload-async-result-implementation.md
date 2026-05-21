# Usedownload Async Result Implementation

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Usedownload Async Result Implementation

---
# useDownload AsyncResult Implementation Documentation

This document details the TypeScript fixes and AsyncResult pattern implementation in the `useDownload` hook.

## Overview

The `useDownload` hook provides functionality for downloading manga chapters, both individually and in bulk. The implementation follows the AsyncResult pattern for consistent error handling and state management.

## Key Fixes

1. **Proper Type Imports**
   - Added `NotificationOptions` and `ErrorNotificationOptions` imports
   - Fixed import for `ChapterEntity` and `ChapterStatus` from domain types
   - Ensured all imports are properly typed

2. **Fixed TRPC Type Safety**
   - Added null check for `trpc.manga` to ensure type safety
   - Replaced optional chaining with explicit error handling:
     ```typescript
     // Before
     const downloadChapterMutation = trpc.manga?.download.useMutation();
     
     // After
     const manga = trpc.manga;
     if (!manga) {
       throw new Error('manga endpoint not available in trpc');
     }
     const downloadChapterMutation = manga.download.useMutation();
     ```

3. **Enhanced AsyncResult Implementation**
   - Updated return types for operations to return `DownloadResult` instead of `void`
   - Added comprehensive error handling with proper type checking
   - Implemented proper input validation with early returns
   - Added detailed error messages with context

4. **Updated Notification Parameters**
   - Added required properties to notification calls:
     ```typescript
     showSuccess({
       title: 'Download Started',
       message: `Started downloading chapter ${chapterIndex}`,
       autoClose: 3000,
       color: 'green'
     });
     
     showError({
       title: 'Download Failed',
       message: errorObj.message,
       error: errorObj,
       autoClose: 5000,
       color: 'red',
       logToConsole: true
     });
     ```

5. **Improved State Management**
   - Added explicit derived state properties
   - Organized return object for better readability and maintenance
   - Ensured proper type parameters for all AsyncResult functions

## Implementation Details

### Type Definitions

```typescript
/**
 * Response type for download operations
 */
interface DownloadResponse {
  message: string;
}

/**
 * Download operation result with AsyncResult pattern
 */
type DownloadResult = AsyncResult<DownloadResponse, Error>;

/**
 * State for download operations
 */
interface DownloadState {
  /** Current download operation status */
  downloadStatus: DownloadResult;
  /** Status of downloading all chapters */
  downloadAllStatus: DownloadResult;
}

/**
 * Return type for the useDownload hook
 */
export interface UseDownloadResult {
  /** Download a single chapter */
  downloadChapter: (chapterIndex: number) => Promise<DownloadResult>;
  /** Download all chapters */
  downloadAll: () => Promise<DownloadResult>;
  /** Whether a single chapter download is in progress */
  isDownloading: boolean;
  /** Whether downloading all chapters is in progress */
  isDownloadingAll: boolean;
  /** Current download operation result */
  downloadStatus: DownloadResult;
  /** Download all operation result */
  downloadAllStatus: DownloadResult;
  /** Reset download status to idle */
  resetDownloadStatus: () => void;
}
```

### Operation Implementation

The implementation follows a consistent pattern for both operations:

1. Input validation with early returns:
   ```typescript
   if (chapterIndex < 0) {
     const error = new Error(`Invalid chapter index: ${chapterIndex}`);
     showError({
       title: 'Download Failed',
       message: error.message,
       error: error,
       autoClose: 5000,
       color: 'red',
       logToConsole: true
     });
     return createErrorResult<DownloadResponse, Error>(error);
   }
   ```

2. Try-catch block with proper error typing:
   ```typescript
   try {
     const result = await downloadMutation.mutateAsync(chapterIndex);
     const successResult = createSuccessResult<DownloadResponse, Error>(result);
     
     showSuccess({ /* notification options */ });
     
     return successResult;
   } catch (error) {
     const errorObj = error instanceof Error
       ? error
       : new Error(`Failed to start download: ${String(error || 'Unknown error')}`);
     
     showError({ /* error notification options */ });
     
     return createErrorResult<DownloadResponse, Error>(errorObj);
   }
   ```

3. Explicit type parameters for AsyncResult functions:
   ```typescript
   createSuccessResult<DownloadResponse, Error>(result)
   createErrorResult<DownloadResponse, Error>(errorObj)
   createLoadingResult<DownloadResponse, Error>()
   createIdleResult<DownloadResponse, Error>()
   ```

### Status Mapping

The hook maps React Query mutation states to AsyncResult states:

```typescript
// Get the current download status as an AsyncResult
const getDownloadStatus = (): DownloadResult => {
  if (downloadMutation.isPending) {
    return createLoadingResult<DownloadResponse, Error>();
  }
  
  if (downloadMutation.isError) {
    return createErrorResult<DownloadResponse, Error>(
      downloadMutation.error instanceof Error 
        ? downloadMutation.error 
        : new Error('Unknown download error')
    );
  }
  
  if (downloadMutation.isSuccess && downloadMutation.data) {
    return createSuccessResult<DownloadResponse, Error>(downloadMutation.data);
  }
  
  return createIdleResult<DownloadResponse, Error>();
};
```

## Usage Example

The hook documentation includes a comprehensive example showing how to handle all states:

```tsx
// Download a specific chapter with proper error handling
const result = await downloadChapter(chapterIndex);

// Check download result with proper type guards
if (isSuccess(result)) {
  console.log(result.data.message);
} else if (isError(result)) {
  console.error('Download failed:', result.error.message);
}

// Download all chapters
const allResult = await downloadAll();

// Handle the result with comprehensive state checking
if (isSuccess(allResult)) {
  console.log('All chapters downloading:', allResult.data.message);
} else if (isError(allResult)) {
  console.error('Failed to download all:', allResult.error.message);
} else if (isLoading(allResult)) {
  console.log('Download in progress...');
} else if (isIdle(allResult)) {
  console.log('Download not started yet');
}

// Get current status
if (isLoading(downloadStatus)) {
  // Show loading indicator
}

// Reset download status
resetDownloadStatus();
```

## Optimistic Updates

The hook implements optimistic updates using React Query's mutation API:

```typescript
const downloadMutation = useOptimisticMutation<DownloadResponse, number>({
  mutationFn: async (chapterIndex: number): Promise<DownloadResponse> => {
    // Implementation...
  },
  onMutate: async (chapterIndex: number): Promise<DownloadResponse> => {
    // Optimistically update the chapter status
    const queryKey = `chapters-${mangaId}`;
    const previousChapters = queryClient.getQueryData<ChapterEntity[]>([queryKey]);
    
    if (previousChapters && Array.isArray(previousChapters)) {
      const updatedChapters = previousChapters.map(chapter => 
        chapter.index === chapterIndex 
          ? { ...chapter, downloadStatus: ChapterStatus.DOWNLOADING }
          : chapter
      );
      queryClient.setQueryData([queryKey], updatedChapters);
    }
    
    return { message: 'Optimistic update successful' };
  },
  invalidateQueries: [`chapters-${mangaId}`],
  successMessage: 'Download started successfully',
  errorMessage: 'Failed to start download',
});
```

## Conclusion

The `useDownload` hook now fully implements the AsyncResult pattern with proper TypeScript typing and comprehensive error handling. The implementation:

1. Uses proper type parameters for AsyncResult functions
2. Implements comprehensive error handling with proper type checking
3. Follows the pattern of returning typed AsyncResult objects
4. Includes input validation with early returns
5. Provides proper notification parameters for all notification calls
6. Creates well-documented example usage

This implementation aligns with the project's architectural patterns and enhances type safety throughout the application.