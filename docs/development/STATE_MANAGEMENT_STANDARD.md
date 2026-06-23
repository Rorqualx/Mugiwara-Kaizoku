# State Management Standard

*Status: Active*  
*Canonical: Yes*  
*Supersedes: loading-state-management-patterns.md*

## 🚨 CRITICAL: Unified State Management Rules

**EFFECTIVE IMMEDIATELY**:
- **ALL async operations MUST use `useAsyncState` hook**
- **ALL loading states MUST use `isLoading` (NOT `isPending` or `loading`)**
- **ALL state management MUST follow the patterns defined here**
- **NO manual useState + useEffect for async operations**
- **NO mixing of state management patterns**

## Overview

This document defines the SINGLE authoritative standard for state management in Mugiwara-Kaizoku. It consolidates all previous patterns and establishes uniform conventions that MUST be followed.

## Core Principles

1. **Single Source of Truth**: One pattern for each use case
2. **Type Safety**: Full TypeScript support with Prisma types
3. **Consistency**: Same naming and patterns everywhere
4. **Performance**: Built-in request cancellation and cleanup
5. **Developer Experience**: Simple, predictable APIs

## Standard Patterns

### 1. Async State Management (REQUIRED for all async operations)

```typescript
import { useAsyncState } from '@/hooks/useAsyncState';

// ✅ CORRECT - Standard pattern
function MyComponent() {
  const { data, isLoading, error, refetch } = useAsyncState(
    async (signal) => {
      const response = await fetch('/api/data', { signal });
      return response.json();
    },
    [] // Dependencies
  );

  if (isLoading) return <Spinner />;
  if (error) return <Error error={error} />;
  return <DataDisplay data={data} />;
}

// ❌ WRONG - Manual state management
function BadComponent() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false); // Wrong naming
  const [error, setError] = useState(null);
  
  useEffect(() => {
    setLoading(true);
    fetch('/api/data')
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []); // No cleanup!
}
```

### 2. TRPC Query Pattern (PREFERRED for API calls)

```typescript
// ✅ CORRECT - Using TRPC with standard naming
function MangaList() {
  const { 
    data, 
    isLoading,  // NOT isPending!
    error,
    refetch 
  } = trpc.manga.getAll.useQuery(undefined, {
    // Map isPending to isLoading for consistency
    select: (data) => data,
    // Use custom hooks to rename
  });

  if (isLoading) return <Spinner />;
  if (error) return <Error error={error} />;
  return <MangaGrid manga={data} />;
}
```

### 3. Mutation Pattern

```typescript
import { useMutation } from '@/hooks/useMutation';

// ✅ CORRECT - Standard mutation pattern
function UpdateForm() {
  const { execute, isLoading, error, reset } = useMutation(
    async (data: UpdateData) => {
      const response = await fetch('/api/update', {
        method: 'POST',
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Update failed');
      return response.json();
    }
  );

  const handleSubmit = async (formData: UpdateData) => {
    try {
      await execute(formData);
      toast.success('Updated successfully');
    } catch {
      // Error is in state, no need to handle
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Updating...' : 'Update'}
      </button>
      {error && <ErrorMessage error={error} />}
    </form>
  );
}
```

### 4. Multiple Loading States

```typescript
import { useLoadingManager } from '@/hooks/useLoadingManager';

// ✅ CORRECT - Managing multiple loading states
function ComplexComponent() {
  const { withLoading, isLoading } = useLoadingManager();
  
  const fetchData = withLoading('fetch-data', async () => {
    const data = await api.getData();
    return data;
  });
  
  const processData = withLoading('process-data', async (data) => {
    const result = await api.processData(data);
    return result;
  });
  
  return (
    <div>
      <button 
        onClick={fetchData}
        disabled={isLoading('fetch-data')}
      >
        {isLoading('fetch-data') ? 'Fetching...' : 'Fetch'}
      </button>
      
      <button 
        onClick={() => processData(currentData)}
        disabled={isLoading('process-data')}
      >
        {isLoading('process-data') ? 'Processing...' : 'Process'}
      </button>
    </div>
  );
}
```

### 5. Form State Management

```typescript
import { useFormState } from '@/hooks/useFormState';

// ✅ CORRECT - Standard form pattern
function MangaForm() {
  const { 
    values, 
    errors, 
    isLoading, 
    handleChange, 
    handleSubmit 
  } = useFormState({
    initialValues: { title: '', description: '' },
    validate: (values) => {
      const errors: Record<string, string> = {};
      if (!values.title) errors.title = 'Required';
      return errors;
    },
    onSubmit: async (values) => {
      await api.createManga(values);
    }
  });

  return (
    <form onSubmit={handleSubmit}>
      <input 
        name="title" 
        value={values.title}
        onChange={handleChange}
      />
      {errors.title && <span>{errors.title}</span>}
      
      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Saving...' : 'Save'}
      </button>
    </form>
  );
}
```

## Required Utilities

### useAsyncState Hook

```typescript
// src/hooks/useAsyncState.ts
import { useState, useEffect, useRef, useCallback } from 'react';

export interface AsyncState<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
}

export function useAsyncState<T>(
  asyncFn: (signal: AbortSignal) => Promise<T>,
  deps: React.DependencyList = []
): AsyncState<T> & { refetch: () => void } {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    isLoading: true, // Start loading immediately
    error: null
  });
  
  const abortControllerRef = useRef<AbortController>();
  
  const execute = useCallback(async () => {
    // Cancel previous request
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
    
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const data = await asyncFn(abortControllerRef.current.signal);
      setState({ data, isLoading: false, error: null });
    } catch (error) {
      // Ignore abort errors
      if (error.name !== 'AbortError') {
        setState({
          data: null,
          isLoading: false,
          error: error instanceof Error ? error : new Error(String(error))
        });
      }
    }
  }, deps);
  
  useEffect(() => {
    execute();
    // Cleanup on unmount
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [execute]);
  
  return { ...state, refetch: execute };
}
```

### useLoadingManager Hook

```typescript
// src/hooks/useLoadingManager.ts
import { useCallback } from 'react';
import { useUIStore } from '@/store/uiSlice';

export function useLoadingManager() {
  const { loadingStates, setLoading } = useUIStore();
  
  const withLoading = useCallback(
    <T extends any[], R>(
      key: string,
      fn: (...args: T) => Promise<R>
    ) => {
      return async (...args: T): Promise<R> => {
        setLoading(key, true);
        try {
          return await fn(...args);
        } finally {
          setLoading(key, false);
        }
      };
    },
    [setLoading]
  );
  
  const isLoading = useCallback(
    (key: string): boolean => {
      return loadingStates[key] || false;
    },
    [loadingStates]
  );
  
  return {
    withLoading,
    isLoading,
    setLoading
  };
}
```

### TRPC Hook Wrapper

```typescript
// src/hooks/useTRPCQuery.ts
import { UseTRPCQueryResult } from '@trpc/react-query';

// Wrapper to ensure consistent naming
export function useTRPCQuery<TData, TError>(
  query: UseTRPCQueryResult<TData, TError>
): {
  data: TData | undefined;
  isLoading: boolean; // Maps isPending
  error: TError | null;
  refetch: () => void;
} {
  return {
    data: query.data,
    isLoading: query.isPending, // Map to standard name
    error: query.error,
    refetch: query.refetch
  };
}
```

## Migration Rules

### Phase 1: Critical Fixes (Immediate)

1. **Replace ALL `isPending` with `isLoading`**
   ```bash
   # Run migration script
   bun run migrate:state-management
   ```

2. **Fix race conditions in search components**
   - Add debouncing
   - Add request cancellation
   - Use `useAsyncState`

3. **Update high-traffic components**
   - `/pages/manga/[id].tsx`
   - `/components/MangaList.tsx`
   - `/components/search/Search.tsx`

### Phase 2: Systematic Migration (Week 1)

1. **Convert manual fetch patterns**
   ```typescript
   // Before
   const [data, setData] = useState();
   useEffect(() => { fetch()... }, []);
   
   // After
   const { data, isLoading, error } = useAsyncState(
     (signal) => fetch(..., { signal })
   );
   ```

2. **Update TRPC usage**
   ```typescript
   // Before
   const { data, isPending } = trpc.manga.get.useQuery();
   
   // After
   const { data, isLoading } = useTRPCQuery(
     trpc.manga.get.useQuery()
   );
   ```

### Phase 3: Validation (Week 2)

1. **ESLint Rules**
   ```javascript
   // .eslintrc.js
   module.exports = {
     rules: {
       'no-restricted-syntax': [
         'error',
         {
           selector: 'Identifier[name="isPending"]',
           message: 'Use isLoading instead of isPending'
         },
         {
           selector: 'Identifier[name="loading"]',
           message: 'Use isLoading instead of loading'
         }
       ],
       'no-restricted-imports': [
         'error',
         {
           patterns: ['*/useState', '*/useEffect'],
           message: 'Use useAsyncState for async operations'
         }
       ]
     }
   };
   ```

2. **TypeScript Checks**
   ```typescript
   // types/state.ts
   export type LoadingState = {
     isLoading: boolean; // ONLY this property
     // isPending: never; // Compile error if used
     // loading: never;   // Compile error if used
   };
   ```

## Error Handling Standard

### Consistent Error Types

```typescript
// ✅ CORRECT - Type-safe error handling
function handleError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unexpected error occurred';
}

// ❌ WRONG - Assumes error type
function badHandleError(error: any): string {
  return error.message; // Unsafe!
}
```

### Error Boundary Pattern

```typescript
// ✅ CORRECT - Wrap async components
<ErrorBoundary fallback={<ErrorFallback />}>
  <AsyncComponent />
</ErrorBoundary>
```

## Performance Requirements

1. **Request Cancellation**: ALL async operations MUST support cancellation
2. **Cleanup**: ALL useEffect hooks MUST have cleanup functions
3. **Debouncing**: Search inputs MUST debounce (300ms default)
4. **Memoization**: Heavy computations MUST use useMemo
5. **Virtualization**: Lists > 100 items MUST use virtualization

## Testing Requirements

### Unit Tests

```typescript
// ✅ CORRECT - Test all states
describe('useAsyncState', () => {
  it('should handle loading state', async () => {
    const { result } = renderHook(() => 
      useAsyncState(mockAsyncFn)
    );
    expect(result.current.isLoading).toBe(true);
  });
  
  it('should handle success state', async () => {
    const { result } = renderHook(() => 
      useAsyncState(() => Promise.resolve('data'))
    );
    await waitFor(() => {
      expect(result.current.data).toBe('data');
      expect(result.current.isLoading).toBe(false);
    });
  });
  
  it('should handle error state', async () => {
    const error = new Error('Test');
    const { result } = renderHook(() => 
      useAsyncState(() => Promise.reject(error))
    );
    await waitFor(() => {
      expect(result.current.error).toBe(error);
      expect(result.current.isLoading).toBe(false);
    });
  });
  
  it('should cancel previous requests', async () => {
    // Test request cancellation
  });
});
```

## Monitoring

### Performance Metrics

```typescript
// Track render performance
if (process.env.NODE_ENV === 'development') {
  React.Profiler.onRender((id, phase, actualDuration) => {
    if (actualDuration > 16) {
      console.warn(`Slow render: ${id} took ${actualDuration}ms`);
    }
  });
}
```

### Error Tracking

```typescript
// Centralized error reporting
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  // Report to monitoring service
});
```

## Prohibited Patterns

### ❌ NEVER DO THIS

```typescript
// 1. Mixed naming
const [isPending, setIsPending] = useState();  // WRONG
const [loading, setLoading] = useState();      // WRONG

// 2. No cleanup
useEffect(() => {
  fetchData().then(setData); // WRONG - no cleanup
}, []);

// 3. Multiple state updates
setIsLoading(true);
setError(null);
setData(null); // WRONG - causes 3 re-renders

// 4. Stale closures
const handleClick = () => {
  fetchData().then(() => {
    setState(data); // WRONG - stale data reference
  });
};

// 5. Synchronous in async
async function badAsync() {
  const data = await fetch(); // WRONG - no error handling
  setState(data);
}
```

## Enforcement

1. **Code Reviews**: ALL PRs MUST follow these standards
2. **CI/CD**: Automated checks for prohibited patterns
3. **Pre-commit Hooks**: Lint and type check before commit
4. **Documentation**: Update when adding new patterns

## References

- [React Documentation](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [TRPC Documentation](https://trpc.io)
- Project Standards: `/docs/development/DEVELOPMENT_RULES.md`

---

**This document is the SINGLE SOURCE OF TRUTH for state management in Mugiwara-Kaizoku. Any deviations must be approved by the tech lead and documented here.**