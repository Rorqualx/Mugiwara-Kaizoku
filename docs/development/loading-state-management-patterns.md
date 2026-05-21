# Loading State Management Patterns

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Loading State Management Patterns

---
# Loading State Management Patterns

This document describes the recommended patterns for managing loading states in the Mugiwara-Kaizoku application.

## Overview

The application uses a centralized loading state management system through the `useUIStore` store. This store maintains a record of loading states keyed by string identifiers, allowing multiple loading operations to occur simultaneously without interference.

## Key Issues Fixed

1. **Inconsistent Function Signatures**: The codebase had two different implementations of `setLoading`:
   - `setLoading(isLoading: boolean)` - Single parameter version from useStoreActions
   - `setLoading(key: string, isLoading: boolean)` - Two parameter version from useUIStore

2. **Missing Loading Keys**: Many components were using the single parameter version, which doesn't properly track individual loading operations.

3. **Unhandled Loading States**: Some AsyncResult pattern implementations were not properly handling all states (idle, loading, success, error).

## Recommended Patterns

### 1. Using setLoading with Keys

Always use the two-parameter version of `setLoading` with a descriptive key for the operation:

```typescript
// INCORRECT - Missing a key
setLoading(true);

// CORRECT - With a descriptive key
setLoading('update-manga', true);
```

Keys should follow a consistent naming convention:
- Use kebab-case for key names
- Include the entity type and operation (e.g., 'manga-update', 'chapter-download')
- For operations on specific entities, include the ID (e.g., `manga-update-${id}`)

### 2. Using the useLoadingManager Hook

For more sophisticated loading state management, use the new `useLoadingManager` hook:

```typescript
import { useLoadingManager } from '../hooks/useLoadingManager';

function MyComponent() {
  const { startLoading, stopLoading, withLoading } = useLoadingManager();
  
  // Method 1: Manual loading state management
  const handleManualOperation = async () => {
    startLoading('operation-key');
    try {
      await someAsyncOperation();
    } finally {
      stopLoading('operation-key');
    }
  };
  
  // Method 2: Automatic loading state management with withLoading
  const handleWrappedOperation = withLoading('wrapped-operation', async (param1, param2) => {
    const result = await someOtherAsyncOperation(param1, param2);
    return result;
  });
  
  return (
    <div>
      <button onClick={handleManualOperation}>Manual Operation</button>
      <button onClick={() => handleWrappedOperation('value1', 'value2')}>Wrapped Operation</button>
    </div>
  );
}
```

### 3. AsyncResult with Loading States

When using the AsyncResult pattern, always check all possible states:

```typescript
import { 
  isSuccess, 
  isError,
  isLoading,
  isIdle
} from '../utils/async-result';

// In a component or hook
if (isSuccess(result)) {
  // Handle success state
  return result.data;
} else if (isError(result)) {
  // Handle error state
  handleError(result.error);
} else if (isLoading(result)) {
  // Handle loading state
  showLoadingIndicator();
} else if (isIdle(result)) {
  // Handle idle state
  showInitialState();
} else {
  // Handle unexpected state
  throw new Error('Unexpected AsyncResult state');
}
```

### 4. Tracking Multiple Loading States

For components that need to track multiple loading operations:

```typescript
function ComplexComponent() {
  const { setLoading } = useUIStore();
  
  const isLoadingData = useSelector(state => 
    state.ui.loadingStates['data-fetch'] || false
  );
  
  const isProcessing = useSelector(state => 
    state.ui.loadingStates['data-processing'] || false
  );
  
  const fetchData = async () => {
    setLoading('data-fetch', true);
    try {
      const data = await fetchSomeData();
      return data;
    } finally {
      setLoading('data-fetch', false);
    }
  };
  
  const processData = async (data) => {
    setLoading('data-processing', true);
    try {
      await processTheData(data);
    } finally {
      setLoading('data-processing', false);
    }
  };
  
  return (
    <div>
      <button disabled={isLoadingData} onClick={fetchData}>
        {isLoadingData ? 'Loading...' : 'Fetch Data'}
      </button>
      
      <button disabled={isProcessing} onClick={() => processData(currentData)}>
        {isProcessing ? 'Processing...' : 'Process Data'}
      </button>
    </div>
  );
}
```

## Implementation Details

### UIStore Implementation

The UIStore maintains a record of loading states:

```typescript
export interface UIStateData {
  // Other state properties...
  loadingStates: Record<string, boolean>;
}

export interface UIActions {
  // Other actions...
  setLoading: (key: string, isLoading: boolean) => void;
}

// Implementation in uiSlice.ts
setLoading: (key: string, isLoading: boolean) =>
  set((state) => {
    state.loadingStates[key] = isLoading;
  }),
```

### useLoadingManager Implementation

The `useLoadingManager` hook provides a consistent interface for loading state management:

```typescript
export function useLoadingManager(): UseLoadingManagerResult {
  const { setLoading: setUILoading } = useUIStore();
  
  const setLoading = useCallback((key: string, isLoading: boolean) => {
    setUILoading(key, isLoading);
  }, [setUILoading]);
  
  const startLoading = useCallback((key: string) => {
    setUILoading(key, true);
  }, [setUILoading]);
  
  const stopLoading = useCallback((key: string) => {
    setUILoading(key, false);
  }, [setUILoading]);
  
  const withLoading = useCallback(<T, Args extends any[]>(
    key: string,
    fn: (...args: Args) => Promise<T>
  ) => {
    return async (...args: Args): Promise<T> => {
      setUILoading(key, true);
      try {
        return await fn(...args);
      } finally {
        setUILoading(key, false);
      }
    };
  }, [setUILoading]);
  
  return {
    setLoading,
    startLoading,
    stopLoading,
    withLoading
  };
}
```

## Benefits

1. **Granular Loading States**: Track multiple loading operations independently
2. **Consistent API**: Use the same pattern across the entire application
3. **Type Safety**: All loading state operations are properly typed
4. **DRY Code**: Reduce duplication with helper functions like `withLoading`
5. **Better UX**: Show loading indicators for specific operations rather than the entire UI

## Migration Strategy

1. Identify all uses of the single-parameter `setLoading`
2. Replace with the two-parameter version using descriptive keys
3. Consider using `useLoadingManager` for complex components
4. Update components to show loading indicators based on specific keys

By following these patterns, we'll have a more consistent, type-safe, and user-friendly loading state management system throughout the application.