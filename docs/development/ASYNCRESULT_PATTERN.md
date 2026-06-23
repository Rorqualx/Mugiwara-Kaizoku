# AsyncResult Pattern Documentation

## Overview

The AsyncResult pattern is a centralized error handling system used throughout the Mugiwara-Kaizoku codebase. It provides type-safe, consistent handling of asynchronous operations using TypeScript discriminated unions.

## Core Concepts

### AsyncResult Type
```typescript
type AsyncResult<T, E = Error> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: E }
```

### Helper Functions

#### Creating Results
```typescript
import {
  createSuccessResult,
  createErrorResult,
  createLoadingResult,
  createIdleResult,
  createContextualError
} from '@/utils/async-result';

// Success
return createSuccessResult(data);

// Error with context
return createErrorResult(
  createContextualError('Error message', 'ERROR_CODE', { metadata })
);

// Loading state
return createLoadingResult();

// Idle state
return createIdleResult();
```

#### Checking Results
```typescript
import { isSuccess, isError, isLoading, isIdle } from '@/utils/async-result';

if (isSuccess(result)) {
  console.log(result.data); // Type-safe access to data
}

if (isError(result)) {
  console.error(result.error); // Type-safe access to error
}
```

## Usage Patterns

### In tRPC Routers

```typescript
export const myRouter = router({
  myProcedure: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }): Promise<AsyncResult<MyData, Error>> => {
      try {
        const data = await someAsyncOperation(input.id);
        return createSuccessResult(data);
      } catch (error) {
        return createErrorResult(
          createContextualError(
            error instanceof Error ? error.message : 'Unknown error',
            'OPERATION_FAILED',
            { id: input.id }
          )
        );
      }
    })
});
```

### In React Hooks

```typescript
export function useMyData() {
  const [state, setState] = useState<AsyncResult<MyData, Error>>(createIdleResult());

  const fetchData = useCallback(async () => {
    setState(createLoadingResult());

    try {
      const response = await api.getData();
      setState(createSuccessResult(response));
    } catch (error) {
      setState(createErrorResult(
        createContextualError(error.message, 'FETCH_ERROR')
      ));
    }
  }, []);

  return { state, fetchData };
}
```

### In Components

```typescript
function MyComponent() {
  const { state, fetchData } = useMyData();

  if (isLoading(state)) {
    return <Spinner />;
  }

  if (isError(state)) {
    return <ErrorMessage error={state.error} />;
  }

  if (isSuccess(state)) {
    return <DataDisplay data={state.data} />;
  }

  return <Button onClick={fetchData}>Load Data</Button>;
}
```

## Migration Guide

### From Custom Result Patterns

#### Before
```typescript
// Various patterns found in legacy code
return { success: true, data: value };
return { success: false, error: message };
if (result.success && result.value) { ... }
if (!result.success) { ... }
```

#### After
```typescript
// Unified AsyncResult pattern
return createSuccessResult(value);
return createErrorResult(createContextualError(message, 'ERROR_CODE'));
if (isSuccess(result) && result.data) { ... }
if (isError(result)) { ... }
```

### From Try-Catch Patterns

#### Before
```typescript
try {
  const data = await operation();
  return { data };
} catch (error) {
  console.error(error);
  return { error: error.message };
}
```

#### After
```typescript
try {
  const data = await operation();
  return createSuccessResult(data);
} catch (error) {
  return createErrorResult(
    createContextualError(
      error instanceof Error ? error.message : 'Unknown error',
      'OPERATION_ERROR'
    )
  );
}
```

## Best Practices

### 1. Always Use Type Guards
```typescript
// Good
if (isSuccess(result)) {
  use(result.data);
}

// Bad - doesn't provide type narrowing
if (result.status === 'success') {
  use((result as any).data);
}
```

### 2. Include Error Context
```typescript
// Good - includes context
return createErrorResult(
  createContextualError('User not found', 'USER_NOT_FOUND', { userId })
);

// Bad - no context
return createErrorResult(new Error('User not found'));
```

### 3. Handle All States in UI
```typescript
function Component({ result }: { result: AsyncResult<Data> }) {
  // Handle all possible states
  if (isIdle(result)) return <EmptyState />;
  if (isLoading(result)) return <LoadingState />;
  if (isError(result)) return <ErrorState error={result.error} />;
  if (isSuccess(result)) return <SuccessState data={result.data} />;
}
```

### 4. Use Proper Return Types
```typescript
// Good - explicit return type
async function fetchData(): Promise<AsyncResult<Data, Error>> {
  // ...
}

// Bad - implicit any
async function fetchData() {
  // ...
}
```

## Common Patterns

### Optimistic Updates
```typescript
const updateData = async (newData: Data) => {
  // Optimistically update UI
  setState(createSuccessResult(newData));

  const result = await api.update(newData);

  if (isError(result)) {
    // Revert on error
    setState(result);
    return;
  }

  // Confirm success
  setState(result);
};
```

### Retry Logic
```typescript
const fetchWithRetry = async (
  maxRetries = 3
): Promise<AsyncResult<Data, Error>> => {
  for (let i = 0; i < maxRetries; i++) {
    const result = await fetchData();
    if (isSuccess(result)) return result;

    if (i < maxRetries - 1) {
      await delay(1000 * Math.pow(2, i)); // Exponential backoff
    }
  }

  return createErrorResult(
    createContextualError('Max retries exceeded', 'MAX_RETRIES')
  );
};
```

### Batch Operations
```typescript
const processBatch = async (
  items: Item[]
): Promise<AsyncResult<BatchResult, Error>> => {
  const results = await Promise.all(
    items.map(item => processItem(item))
  );

  const successful = results.filter(isSuccess);
  const failed = results.filter(isError);

  if (failed.length === 0) {
    return createSuccessResult({
      processed: successful.length,
      results: successful.map(r => r.data)
    });
  }

  return createErrorResult(
    createContextualError(
      `${failed.length} items failed`,
      'BATCH_PARTIAL_FAILURE',
      { failed: failed.map(r => r.error) }
    )
  );
};
```

## Testing

### Testing with AsyncResult
```typescript
describe('myFunction', () => {
  it('should return success result', async () => {
    const result = await myFunction(validInput);

    expect(isSuccess(result)).toBe(true);
    if (isSuccess(result)) {
      expect(result.data).toEqual(expectedData);
    }
  });

  it('should return error for invalid input', async () => {
    const result = await myFunction(invalidInput);

    expect(isError(result)).toBe(true);
    if (isError(result)) {
      expect(result.error.message).toContain('Invalid');
    }
  });
});
```

### Mocking AsyncResult
```typescript
const mockSuccessResult = <T>(data: T) => createSuccessResult(data);
const mockErrorResult = (message: string) =>
  createErrorResult(createContextualError(message, 'MOCK_ERROR'));

// In tests
jest.mocked(api.getData).mockResolvedValue(
  mockSuccessResult({ id: 1, name: 'Test' })
);
```

## Troubleshooting

### Common Issues

1. **TypeScript Errors with Data Access**
   ```typescript
   // Problem
   const data = result.data; // Error: Property 'data' does not exist

   // Solution
   if (isSuccess(result)) {
     const data = result.data; // Type-safe
   }
   ```

2. **Missing Status Checks**
   ```typescript
   // Problem
   return { success: true }; // Wrong format

   // Solution
   return createSuccessResult(null); // Proper AsyncResult
   ```

3. **Inconsistent Error Handling**
   ```typescript
   // Problem
   catch (error) {
     return { error: error }; // Not AsyncResult format
   }

   // Solution
   catch (error) {
     return createErrorResult(
       createContextualError(error.message, 'ERROR_CODE')
     );
   }
   ```

## Migration Status

As of September 21, 2025:
- ✅ Core services migrated
- ✅ Authentication system migrated
- ✅ tRPC routers migrated
- ✅ Critical hooks migrated
- ✅ 0 TypeScript errors
- 📋 ~48 patterns remain (mostly in tests and specialized services)

## Further Reading

- [AsyncResult Implementation](../../src/utils/async-result/)
- Migration Report
- Remaining Work