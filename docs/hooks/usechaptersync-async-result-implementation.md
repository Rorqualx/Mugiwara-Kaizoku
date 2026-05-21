# Usechaptersync Async Result Implementation

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Usechaptersync Async Result Implementation

---
# AsyncResult Pattern Implementation in useChapterSync

This document details the implementation of the AsyncResult pattern in the `useChapterSync` hook to improve type safety, error handling, and state management.

## Overview

The `useChapterSync` hook has been enhanced to use the AsyncResult pattern for managing asynchronous operations related to chapter synchronization. This implementation follows our standardized approach to async state management, providing clear typing for all possible states and improved error handling.

## Implementation Details

### Hook Interface

The hook returns an interface with both functions and state objects:

```typescript
export interface UseChapterSyncResult {
  /** Check for out-of-sync chapters */
  checkOutOfSync: () => Promise<ChapterSyncOperationResult>;
  /** Fix out-of-sync chapters */
  fixOutOfSync: () => Promise<ChapterSyncOperationResult>;
  /** Current state of the check operation */
  checkState: ChapterSyncOperationResult;
  /** Current state of the fix operation */
  fixState: ChapterSyncOperationResult;
  /** Whether the check operation is in progress */
  isChecking: boolean;
  /** Whether the fix operation is in progress */
  isFixing: boolean;
  /** Whether the check operation has completed successfully */
  hasCheckedOutOfSync: boolean;
  /** Whether the fix operation has completed successfully */
  hasFixedOutOfSync: boolean;
  /** Error from the check operation, if any */
  checkError: Error | null;
  /** Error from the fix operation, if any */
  fixError: Error | null;
}
```

### Key Fixes

1. **TypeScript Error Resolution:**
   - Fixed all TypeScript type errors in notification function calls
   - Added proper type parameters for generic types
   - Fixed missing arguments in function calls

2. **Enhanced Notification Types:**
   - Added custom `NotificationProps` interface to avoid dependency on Mantine's type
   - Updated all notification calls with proper parameters:
     ```typescript
     showSuccess({
       title: 'Check Complete',
       message: 'Checked for out-of-sync chapters',
       autoClose: 3000,
       color: 'green'
     });
     ```

3. **State Management with Explicit Type Parameters:**
   ```typescript
   const [checkState, setCheckState] = useState<ChapterSyncOperationResult>(createIdleResult<boolean, Error>());
   const [fixState, setFixState] = useState<ChapterSyncOperationResult>(createIdleResult<boolean, Error>());
   ```

4. **TRPC Client Type Safety:**
   ```typescript
   // TRPC mutations - add type check for trpc.manga
   const manga = trpc.manga;
   if (!manga) {
     throw new Error('manga endpoint not available in trpc');
   }
   ```

5. **Comprehensive Error Handling:**
   ```typescript
   const errorObj = error instanceof Error 
     ? error 
     : new Error(`Failed to check out-of-sync chapters: ${String(error || 'Unknown error')}`);
   ```

### Operation Implementation

When operations are triggered, they follow a consistent pattern:

```typescript
const checkOutOfSync = async (): Promise<ChapterSyncOperationResult> => {
  // Input validation
  if (!mangaId || mangaId <= 0) {
    const error = new Error('Invalid manga ID for checking out-of-sync chapters');
    setCheckState(createErrorResult<boolean, Error>(error));
    showError({
      title: 'Check Failed',
      message: error.message,
      autoClose: 5000,
      color: 'red',
      logToConsole: true
    });
    return createErrorResult<boolean, Error>(error);
  }
  
  // Update state to loading
  setCheckState(createLoadingResult<boolean, Error>());
  setLoading('chapter-check', true);
  
  try {
    // Execute the mutation with proper error handling
    await checkOutOfSyncMutation.mutateAsync({ 
      mangaId 
    });
    
    // Update state to success with proper type parameters
    const successResult = createSuccessResult<boolean, Error>(true);
    setCheckState(successResult);
    
    // Show success notification
    showSuccess({
      title: 'Check Complete',
      message: 'Checked for out-of-sync chapters',
      autoClose: 3000,
      color: 'green'
    });
    
    return successResult;
  } catch (error) {
    // Create an Error object if needed
    const errorObj = error instanceof Error 
      ? error 
      : new Error(`Failed to check out-of-sync chapters: ${String(error || 'Unknown error')}`);
    
    // Update state to error with proper type parameters
    const errorResult = createErrorResult<boolean, Error>(errorObj);
    setCheckState(errorResult);
    
    // Show error notification
    showError({
      title: 'Check Failed',
      message: errorObj.message,
      error: errorObj,
      autoClose: 5000,
      color: 'red',
      logToConsole: true
    });
    
    return errorResult;
  } finally {
    setLoading('chapter-check', false);
  }
};
```

### Derived State Properties

The hook computes derived state properties using type guards:

```typescript
// Compute derived state properties with proper type checking
const isChecking = isLoading(checkState);
const isFixing = isLoading(fixState);
const hasCheckedOutOfSync = isSuccess(checkState);
const hasFixedOutOfSync = isSuccess(fixState);
const checkError = isError(checkState) ? checkState.error : null;
const fixError = isError(fixState) ? fixState.error : null;
```

## Usage in Components

Components using this hook can now easily handle all possible states:

```tsx
const { 
  checkOutOfSync, 
  fixOutOfSync,
  checkState,
  fixState,
  isChecking,
  isFixing,
  hasCheckedOutOfSync,
  checkError
} = useChapterSync(mangaId);

// Simple usage with derived properties
return (
  <>
    <Button 
      onClick={checkOutOfSync}
      disabled={isChecking}
    >
      {isChecking ? 'Checking...' : 'Check Chapters'}
    </Button>
    
    {checkError && (
      <Alert color="red">Error: {checkError.message}</Alert>
    )}
    
    {hasCheckedOutOfSync && (
      <Button 
        onClick={fixOutOfSync}
        disabled={isFixing}
      >
        {isFixing ? 'Fixing...' : 'Fix Chapters'}
      </Button>
    )}
  </>
);
```

## Benefits

This implementation provides several benefits:

1. **Type Safety**: All states are properly typed with explicit generic parameters
2. **Comprehensive Error Handling**: All error cases are handled with proper type checking
3. **Derived State Properties**: Computed properties make component usage simpler
4. **Contextual Error Messages**: Detailed error messages with proper context
5. **Loading State Management**: Global loading states managed with descriptive keys
6. **Notification Type Safety**: All notifications include required properties
7. **Input Validation**: Early validation prevents invalid operations

## Key TypeScript Fixes

1. **Fixed Notification Type Issues:**
   - Created a custom `NotificationProps` interface to avoid Mantine type dependency
   - Ensured all notification calls include required parameters
   - Updated imports to use `NotificationsProps` instead of `NotificationProps`

2. **Added Explicit Type Parameters:**
   - Used `createSuccessResult<boolean, Error>(...)` instead of `createSuccessResult(...)`
   - Used `createErrorResult<boolean, Error>(...)` instead of `createErrorResult(...)`

3. **Safe Type Narrowing:**
   - Used type guards consistently: `isSuccess`, `isError`, `isLoading`, `isIdle`
   - Added explicit null checks for TRPC endpoints

4. **Return Type Consistency:**
   - Made sure all functions return `Promise<ChapterSyncOperationResult>`
   - Ensured all return paths have proper AsyncResult values

## Conclusion

The AsyncResult pattern implementation in the `useChapterSync` hook provides a robust, type-safe approach to managing async operations. All TypeScript errors have been resolved while maintaining a clean, consistent API that follows the project's architectural patterns.