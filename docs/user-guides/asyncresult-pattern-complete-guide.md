# AsyncResult Pattern Complete Guide

## Table of Contents
1. [Overview](#overview)
2. [Core Types and Functions](#core-types-and-functions)
3. [Enhanced Error Handling Integration](#enhanced-error-handling-integration)
4. [React Hooks Implementation](#react-hooks-implementation)
5. [React Components Integration](#react-components-integration)
6. [Adapter Implementation Pattern](#adapter-implementation-pattern)
7. [Best Practices](#best-practices)
8. [Common Pitfalls](#common-pitfalls)
9. [Migration Guide](#migration-guide)
10. [Advanced Patterns](#advanced-patterns)
11. [Example Implementations](#example-implementations)
12. [Conclusion](#conclusion)

## Overview

The AsyncResult pattern is a standardized approach to handling asynchronous operations in the Mugiwara-Kaizoku codebase. It provides a type-safe way to represent the different states of an asynchronous operation (idle, loading, success, error) and handle them consistently throughout the application.

### Key Benefits

- **Type Safety**: Ensures type-safe access to data and errors through discriminated unions
- **Comprehensive State Handling**: Covers all possible states of an async operation (idle, loading, success, error)
- **Consistent Error Handling**: Standardizes error handling across the codebase
- **Better UX**: Makes it easier to provide appropriate UI feedback for each state
- **Reduced Bugs**: Eliminates common issues like accessing data when it's not available
- **Composability**: Easy to chain and combine async operations
- **Maintainability**: Standardized pattern makes code more predictable and easier to maintain

## Core Types and Functions

### AsyncResult Type

The AsyncResult type is defined as a discriminated union with four possible states:

```typescript
export type AsyncResult<T, E = Error> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: E };
```

Where:
- `T` is the type of data expected on success
- `E` is the type of error (defaults to Error)
- `idle`: The operation has not started yet
- `loading`: The operation is in progress
- `success`: The operation completed successfully with data of type T
- `error`: The operation failed with an error of type E

### Creator Functions

Use these functions to create AsyncResult objects with the correct type:

```typescript
// Create an idle result
export function createIdleResult<T, E = Error>(): AsyncResult<T, E> {
  return { status: 'idle' };
}

// Create a loading result
export function createLoadingResult<T, E = Error>(): AsyncResult<T, E> {
  return { status: 'loading' };
}

// Create a success result
export function createSuccessResult<T, E = Error>(data: T): AsyncResult<T, E> {
  return { status: 'success', data };
}

// Create an error result
export function createErrorResult<T, E = Error>(error: E): AsyncResult<T, E> {
  return { status: 'error', error };
}
```

### Type Guards

Type guards help narrow down the type of an AsyncResult, making it type-safe to access the data or error:

```typescript
// Check if result is in idle state
export function isIdle<T, E>(result: AsyncResult<T, E>): result is { status: 'idle' } {
  return result.status === 'idle';
}

// Check if result is in loading state
export function isLoading<T, E>(result: AsyncResult<T, E>): result is { status: 'loading' } {
  return result.status === 'loading';
}

// Check if result is in success state
export function isSuccess<T, E>(result: AsyncResult<T, E>): result is { status: 'success', data: T } {
  return result.status === 'success';
}

// Check if result is in error state
export function isError<T, E>(result: AsyncResult<T, E>): result is { status: 'error', error: E } {
  return result.status === 'error';
}

// Check if result is in a terminal state (success or error)
export function isTerminalState<T, E>(result: AsyncResult<T, E>): result is ({ status: 'success', data: T } | { status: 'error', error: E }) {
  return isSuccess(result) || isError(result);
}

// Check if result is in a pending state (loading or idle)
export function isPendingState<T, E>(result: AsyncResult<T, E>): result is ({ status: 'loading' } | { status: 'idle' }) {
  return isLoading(result) || isIdle(result);
}
```

### Utility Functions

```typescript
// Convert a Promise to an AsyncResult
export async function fromPromise<T, E = Error>(
  promise: Promise<T>
): Promise<AsyncResult<T, E>> {
  try {
    const data = await promise;
    return createSuccessResult<T, E>(data);
  } catch (error) {
    return createErrorResult<T, E>(error as E);
  }
}

// Convert a Promise with custom error handling
export async function fromPromiseCatch<T, E = Error>(
  promise: Promise<T>,
  errorMapper: (error: unknown) => E
): Promise<AsyncResult<T, E>> {
  try {
    const data = await promise;
    return createSuccessResult<T, E>(data);
  } catch (error) {
    return createErrorResult<T, E>(errorMapper(error));
  }
}

// Map successful result data
export function mapResult<T, U, E>(
  result: AsyncResult<T, E>,
  mapper: (data: T) => U
): AsyncResult<U, E> {
  if (isSuccess(result)) {
    return createSuccessResult<U, E>(mapper(result.data));
  }
  return result as AsyncResult<U, E>;
}

// Map data asynchronously
export async function mapResultAsync<T, U, E>(
  result: AsyncResult<T, E>,
  mapper: (data: T) => Promise<U>
): Promise<AsyncResult<U, E>> {
  if (isSuccess(result)) {
    try {
      const mappedData = await mapper(result.data);
      return createSuccessResult<U, E>(mappedData);
    } catch (error) {
      return createErrorResult<U, E>(error as E);
    }
  }
  return result as AsyncResult<U, E>;
}

// Safely extract data with a default value
export function unwrapOr<T, E>(result: AsyncResult<T, E>, defaultValue: T): T {
  return isSuccess(result) ? result.data : defaultValue;
}

// Chain multiple async operations
export async function chain<T, U, E>(
  result: AsyncResult<T, E>,
  mapper: (data: T) => Promise<AsyncResult<U, E>>
): Promise<AsyncResult<U, E>> {
  if (isSuccess(result)) {
    return await mapper(result.data);
  }
  return result as AsyncResult<U, E>;
}

// Combine multiple AsyncResults
export function combine<T extends readonly unknown[], E>(
  results: { [K in keyof T]: AsyncResult<T[K], E> }
): AsyncResult<T, E> {
  // Check if any result is in error state
  for (const result of results) {
    if (isError(result)) {
      return createErrorResult<T, E>(result.error);
    }
  }
  
  // Check if any result is in loading state
  if (results.some(isLoading)) {
    return createLoadingResult<T, E>();
  }
  
  // Check if any result is in idle state
  if (results.some(isIdle)) {
    return createIdleResult<T, E>();
  }
  
  // All results are successful, extract data
  const data = results.map(result => (result as { status: 'success', data: unknown }).data) as unknown as T;
  return createSuccessResult<T, E>(data);
}

// Filter successful results from an array
export function filterSuccessResults<T, E>(
  results: AsyncResult<T, E>[]
): T[] {
  return results
    .filter(isSuccess)
    .map(result => result.data);
}
```

### Handler Function for React Components

```typescript
// Handle all states with a single function
export function handleAsyncResult<T, E = Error, R = void>(
  result: AsyncResult<T, E>,
  handlers: {
    onIdle?: () => R;
    onLoading?: () => R;
    onError?: (error: E) => R;
    onSuccess?: (data: T) => R;
    onAny?: (result: AsyncResult<T, E>) => R;
  }
): R | undefined {
  if (handlers.onAny) {
    return handlers.onAny(result);
  }
  if (isSuccess(result) && handlers.onSuccess) {
    return handlers.onSuccess(result.data);
  }
  if (isError(result) && handlers.onError) {
    return handlers.onError(result.error);
  }
  if (isLoading(result) && handlers.onLoading) {
    return handlers.onLoading();
  }
  if (isIdle(result) && handlers.onIdle) {
    return handlers.onIdle();
  }
  return undefined;
}
```

## Enhanced Error Handling Integration

The AsyncResult pattern can be integrated with enhanced error handling to provide more context for errors.

### Contextual Error Creator

```typescript
export interface ContextualError extends Error {
  /** Additional context information about the error */
  context?: Record<string, unknown>;
  /** Optional error code for categorization */
  code?: string;
  /** The original error that caused this error */
  originalError?: Error;
}

export function createContextualErrorCreator(
  defaultContext: Record<string, unknown>
): (
  message: string,
  code?: string,
  additionalContext?: Record<string, unknown>,
  originalError?: Error
) => ContextualError {
  return (
    message: string,
    code?: string,
    additionalContext?: Record<string, unknown>,
    originalError?: Error
  ): ContextualError => {
    return createContextualError(
      message,
      code,
      { ...defaultContext, ...additionalContext },
      originalError
    );
  };
}
```

### withEnhancedErrorHandling

```typescript
export async function withEnhancedErrorHandling<T>(
  fn: () => Promise<AsyncResult<T, Error>>,
  errorContext: Record<string, unknown>
): Promise<AsyncResult<T, ContextualError>> {
  try {
    const result = await fn();
    if (isError(result)) {
      // Convert regular Error to ContextualError with context
      return createErrorResult(
        createContextualError(result.error.message, undefined, errorContext, result.error)
      );
    }
    if (isSuccess(result)) {
      return createSuccessResult(result.data);
    }
    if (isLoading(result)) {
      return createLoadingResult();
    }
    return createIdleResult();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return createErrorResult(
      createContextualError(message, 'UNEXPECTED_ERROR', errorContext, error instanceof Error ? error : undefined)
    );
  }
}
```

### Implementation Pattern

When implementing methods that return AsyncResult objects with enhanced error handling, follow this pattern:

```typescript
public async methodName(params): Promise<AsyncResult<ResultType, ContextualError>> {
  return withEnhancedErrorHandling<ResultType>(async () => {
    // Validate inputs
    if (!isValidInput(params)) {
      throw new Error('Validation error message');
    }
    
    // Implementation logic...
    
    // Return result wrapped in AsyncResult
    return createSuccessResult(result);
  }, {
    operation: 'methodName',
    service: 'ServiceName',
    resourceType: 'resourceType',
    details: { params }
  });
}
```

## React Hooks Implementation

When creating hooks that involve asynchronous operations, follow this pattern:

```typescript
export function useData(id: number): UseDataResult {
  // Define properly typed state with correct initial value
  const [dataState, setDataState] = useState<AsyncResult<Data, Error>>(createIdleResult());
  
  // Define additional states for separate operations if needed
  const [updateState, setUpdateState] = useState<AsyncResult<void, Error>>(createIdleResult());
  
  // Use useCallback for async operations to prevent unnecessary re-renders
  const fetchData = useCallback(async (): Promise<AsyncResult<Data, Error>> => {
    // Input validation first
    if (!id || id <= 0) {
      const error = new Error('Invalid ID provided');
      setDataState(createErrorResult(error));
      return createErrorResult(error);
    }
    
    // Set loading state before async operation
    setDataState(createLoadingResult());
    
    // Preferred: Use fromPromiseCatch helper for consistent error handling
    return await fromPromiseCatch<Data, Error>(
      api.fetchData(id),
      (error) => new Error(`Failed to fetch data for ID ${id}: ${error instanceof Error ? error.message : String(error)}`)
    ).then(result => {
      // Update state
      setDataState(result);
      return result;
    });
  }, [id]);
  
  // Method for updating data
  const updateData = async (updates: Partial<Data>): Promise<AsyncResult<void, Error>> => {
    if (!id) {
      return createErrorResult(new Error('Cannot update: No ID provided'));
    }
    
    setUpdateState(createLoadingResult());
    
    try {
      await api.updateData(id, updates);
      
      // Update success state
      const result = createSuccessResult<void, Error>(undefined);
      setUpdateState(result);
      
      // Refresh data after update
      fetchData();
      
      return result;
    } catch (error) {
      // Format error with context
      const errorObj = error instanceof Error 
        ? new Error(`Update failed: ${error.message}`) 
        : new Error(`Update failed: ${String(error)}`);
      
      // Set error state
      const result = createErrorResult<void, Error>(errorObj);
      setUpdateState(result);
      return result;
    }
  };
  
  // Initial data loading with useEffect
  useEffect(() => {
    if (id) {
      fetchData();
    }
  }, [id, fetchData]);
  
  // Extract data safely using type guards
  const data = isSuccess(dataState) ? dataState.data : undefined;
  
  // Helper method for safely accessing nested properties
  const getField = <K extends keyof Data, D>(fieldName: K, defaultValue: D): Data[K] | D => {
    if (!isSuccess(dataState) || !dataState.data) {
      return defaultValue;
    }
    return dataState.data[fieldName] !== undefined ? dataState.data[fieldName] : defaultValue;
  };
  
  // Return a clean interface with all necessary properties and methods
  return {
    // States
    dataState,
    updateState,
    
    // Data access
    data,
    getField,
    
    // Status flags
    isLoading: isLoading(dataState),
    isUpdating: isLoading(updateState),
    hasError: isError(dataState),
    error: isError(dataState) ? dataState.error : undefined,
    
    // Actions
    fetchData,
    updateData,
    refresh: fetchData
  };
}

// Define a clean interface for the hook return type
interface UseDataResult {
  // State objects
  dataState: AsyncResult<Data, Error>;
  updateState: AsyncResult<void, Error>;
  
  // Data access
  data: Data | undefined;
  getField: <K extends keyof Data, D>(fieldName: K, defaultValue: D) => Data[K] | D;
  
  // Status flags
  isLoading: boolean;
  isUpdating: boolean;
  hasError: boolean;
  error: Error | undefined;
  
  // Actions
  fetchData: () => Promise<AsyncResult<Data, Error>>;
  updateData: (updates: Partial<Data>) => Promise<AsyncResult<void, Error>>;
  refresh: () => Promise<AsyncResult<Data, Error>>;
}
```

## React Components Integration

When using AsyncResult in components, handle each state explicitly:

```tsx
function UserProfile({ userId }: { userId: number }) {
  const { userState, fetchUser } = useUser(userId);
  
  // Method 1: Manual handling with type guards
  if (isLoading(userState)) {
    return <LoadingSpinner />;
  }
  
  if (isError(userState)) {
    return <ErrorMessage message={userState.error.message} />;
  }
  
  if (isSuccess(userState)) {
    return (
      <div>
        <h1>{userState.data.name}</h1>
        <p>Email: {userState.data.email}</p>
      </div>
    );
  }
  
  // Idle state
  return <Button onClick={fetchUser}>Load User</Button>;
  
  // Method 2: Using the handleAsyncResult helper
  return handleAsyncResult(userState, {
    onIdle: () => <Button onClick={fetchUser}>Load User</Button>,
    onLoading: () => <LoadingSpinner />,
    onError: (error) => <ErrorMessage message={error.message} />,
    onSuccess: (user) => (
      <div>
        <h1>{user.name}</h1>
        <p>Email: {user.email}</p>
      </div>
    )
  });
}
```

## Adapter Implementation Pattern

For adapter methods, implement both an async and a non-async version:

```typescript
export class MyAdapter extends BaseIntegrationAdapter<MyConfig> implements IntegrationAdapter<MyConfig> {
  private createContextualError: ReturnType<typeof createContextualErrorCreator>;
  
  constructor() {
    super();
    this.createContextualError = createContextualErrorCreator({
      service: 'MyAdapter',
      resourceType: 'manga'
    });
  }
  
  // Async version with AsyncResult and enhanced error handling
  async searchMangaAsync(query: string): Promise<AsyncResult<MangaEntity[], ContextualError>> {
    return withEnhancedErrorHandling(async () => {
      // Validate input
      if (!query || query.trim().length === 0) {
        throw new Error('Search query cannot be empty');
      }
      
      // Implementation...
      const results = await this.client.search(query);
      
      // Return result wrapped in AsyncResult
      return createSuccessResult(processedResults);
    }, {
      operation: 'searchManga',
      service: 'MyAdapter',
      resourceType: 'manga',
      details: { query }
    });
  }

  // Non-async version that unwraps the AsyncResult
  async searchManga(query: string): Promise<MangaEntity[]> {
    const result = await this.searchMangaAsync(query);
    
    if (isSuccess(result)) {
      return result.data;
    }
    
    if (isError(result)) {
      throw result.error;
    }
    
    throw new Error(`Failed to search manga with query "${query}"`);
  }
}
```

## Best Practices

### 1. Always Use Explicit Type Parameters
```typescript
// Good: Explicit type parameters
const result: AsyncResult<User, ApiError> = await fetchUser(1);

// Better: Let the function determine the return type
const fetchUser = async (id: number): Promise<AsyncResult<User, ApiError>> => {
  // Implementation...
};
```

### 2. Use Type Guards Consistently
```typescript
// Good: Type-safe access with guards
if (isSuccess(result)) {
  console.log(result.data.name);
}

// Avoid: Direct status checks
if (result.status === 'success') {
  console.log(result.data.name); // TypeScript may not narrow the type properly
}
```

### 3. Set Loading State Before Async Operations
```typescript
const fetchData = async () => {
  // Set loading state FIRST
  setDataState(createLoadingResult());
  
  // Then perform the operation
  const result = await api.fetchData();
  setDataState(result);
};
```

### 4. Use Descriptive Error Messages with Context
```typescript
throw this.createContextualError(
  `Failed to fetch user with ID ${id}: ${error.message}`,
  'fetchUser',
  { userId: id }
);
```

### 5. Handle All States in UI Components
```tsx
return handleAsyncResult(dataState, {
  onIdle: () => <InitialMessage />,
  onLoading: () => <LoadingSpinner />,
  onError: (error) => <ErrorMessage message={error.message} />,
  onSuccess: (data) => <DataDisplay data={data} />
});
```

### 6. Provide Helper Methods for Common Data Access Patterns
```typescript
const getField = <K extends keyof Data>(field: K, defaultValue?: Data[K]) => 
  isSuccess(dataState) ? dataState.data[field] : defaultValue;
```

### 7. Use Enhanced Error Handling for Better Context
```typescript
return withEnhancedErrorHandling(async () => {
  // Implementation that returns AsyncResult...
  return createSuccessResult(data);
}, {
  operation: 'methodName',
  service: 'ServiceName',
  resourceType: 'resourceType',
  resourceId: id
});
```

### 8. Return AsyncResult from Functions for Composability
```typescript
// Return AsyncResult from all async operations
const fetchData = async (): Promise<AsyncResult<Data, Error>> => {
  // Implementation...
};
```

### 9. Use Proper Input Validation
```typescript
if (!id || id <= 0) {
  throw this.createContextualError('Invalid ID provided', 'fetchData');
}
```

### 10. Explicit AsyncResult Generic Type Parameters
```typescript
// Always specify both success and error types explicitly
const result = createSuccessResult<MangaEntity, Error>(mangaData);

// In state initialization
const [state, setState] = useState<AsyncResult<MangaEntity, Error>>(
  createIdleResult<MangaEntity, Error>()
);

// When setting new state
setState(createLoadingResult<MangaEntity, Error>());
```

## Common Pitfalls

### 1. Direct Property Access Without Status Check
**❌ Incorrect:**
```typescript
// Error: Property 'data' does not exist on type 'AsyncResult<User>'
const mangaId = result.data.id;
const title = result.data.title;
```

**✅ Correct:**
```typescript
// Use type guards to safely access properties
if (isSuccess(result)) {
  const mangaId = result.data.id;
  const title = result.data.title;
}
```

### 2. Using Array Methods on AsyncResult
**❌ Incorrect:**
```typescript
// Error: Property 'map' does not exist on type 'AsyncResult<MangaEntity[]>'
const mangaTitles = results.map(manga => manga.title);
```

**✅ Correct:**
```typescript
// Use type guards to safely access array data
if (isSuccess(results)) {
  const mangaTitles = results.data.map(manga => manga.title);
}

// Or use the mapAsyncResultArray helper
const mangaTitlesResult = mapAsyncResultArray(results, manga => manga.title);
```

### 3. Forgetting to Set Loading State
**❌ Incorrect:**
```typescript
const fetchData = async () => {
  try {
    const data = await api.fetchData();
    setDataState(createSuccessResult(data));
  } catch (error) {
    setDataState(createErrorResult(error));
  }
};
```

**✅ Correct:**
```typescript
const fetchData = async () => {
  setDataState(createLoadingResult()); // Set loading state first
  try {
    const data = await api.fetchData();
    setDataState(createSuccessResult(data));
  } catch (error) {
    setDataState(createErrorResult(error));
  }
};
```

### 4. Not Handling All AsyncResult States in UI
**❌ Incorrect:**
```tsx
// Missing idle state handling
if (isLoading(result)) {
  return <LoadingSpinner />;
} else if (isError(result)) {
  return <ErrorMessage error={result.error} />;
} else if (isSuccess(result)) {
  return <DataDisplay data={result.data} />;
}
// What about idle state?
```

**✅ Correct:**
```tsx
// Handle all states with handleAsyncResult
return handleAsyncResult(result, {
  onIdle: () => <InitialState />,
  onLoading: () => <LoadingSpinner />,
  onError: (error) => <ErrorMessage error={error} />,
  onSuccess: (data) => <DataDisplay data={data} />
});
```

### 5. Not Validating Input Parameters
**❌ Incorrect:**
```typescript
const fetchData = async (id: number) => {
  setDataState(createLoadingResult());
  // What if id is invalid?
  const data = await api.fetchData(id);
  // ...
};
```

**✅ Correct:**
```typescript
const fetchData = async (id: number) => {
  if (!id || id <= 0) {
    setDataState(createErrorResult(new Error('Invalid ID provided')));
    return createErrorResult(new Error('Invalid ID provided'));
  }
  
  setDataState(createLoadingResult());
  // ...
};
```

### 6. Generic Error Messages
**❌ Incorrect:**
```typescript
return createErrorResult(new Error('Operation failed'));
```

**✅ Correct:**
```typescript
return createErrorResult(
  new Error(`Failed to fetch data for ID ${id}: ${error instanceof Error ? error.message : String(error)}`)
);
```

### 7. Forgetting to Wrap Return Values in AsyncResult for withEnhancedErrorHandling
**❌ Incorrect:**
```typescript
return withEnhancedErrorHandling(async () => {
  if (!isValid) {
    throw new Error('Invalid input');
  }
  // WRONG: returns raw data, not an AsyncResult
  return rawData;
}, { /* context */ });
```

**✅ Correct:**
```typescript
return withEnhancedErrorHandling(async () => {
  if (!isValid) {
    throw new Error('Invalid input'); // throwing is correct for errors
  }
  // Correct: wrap result in AsyncResult
  return createSuccessResult(rawData);
}, { /* context */ });
```

## Migration Guide

When migrating existing code to use the AsyncResult pattern, follow these steps:

### Step 1: Identify Candidates for Migration
- Hooks that perform async operations (API calls, data fetching)
- Components that show loading/error states
- Any code that manually manages loading/error states with separate variables

### Step 2: Update State Management
Replace separate state variables with unified AsyncResult state:

**Before:**
```typescript
// Multiple state variables
const [data, setData] = useState<Data | null>(null);
const [loading, setLoading] = useState<boolean>(false);
const [error, setError] = useState<Error | null>(null);
```

**After:**
```typescript
// Single AsyncResult state
const [dataState, setDataState] = useState<AsyncResult<Data, Error>>(createIdleResult());
```

### Step 3: Update Async Functions
Transform async functions to use the AsyncResult pattern:

**Before:**
```typescript
const fetchData = async () => {
  setLoading(true);
  setError(null);
  
  try {
    const result = await api.getData();
    setData(result);
    setLoading(false);
  } catch (err) {
    setError(err);
    setLoading(false);
  }
};
```

**After:**
```typescript
const fetchData = async (): Promise<AsyncResult<Data, Error>> => {
  setDataState(createLoadingResult());
  
  try {
    const data = await api.getData();
    const result = createSuccessResult<Data, Error>(data);
    setDataState(result);
    return result;
  } catch (error) {
    const errorResult = createErrorResult<Data, Error>(
      error instanceof Error ? error : new Error(String(error))
    );
    setDataState(errorResult);
    return errorResult;
  }
};
```

Or with enhanced error handling:

```typescript
const fetchData = async (): Promise<AsyncResult<Data, ContextualError>> => {
  setDataState(createLoadingResult());
  
  const result = await withEnhancedErrorHandling(async () => {
    const data = await api.getData();
    return createSuccessResult(data);
  }, {
    operation: 'fetchData',
    service: 'DataService'
  });
  
  setDataState(result);
  return result;
};
```

### Step 4: Update UI Components
Transform UI rendering to handle all AsyncResult states:

**Before:**
```tsx
return (
  <div>
    {loading && <LoadingSpinner />}
    {error && <ErrorMessage message={error.message} />}
    {data && <DataDisplay data={data} />}
  </div>
);
```

**After:**
```tsx
return handleAsyncResult(dataState, {
  onIdle: () => <p>Click to load data</p>,
  onLoading: () => <LoadingSpinner />,
  onError: (error) => <ErrorMessage message={error.message} />,
  onSuccess: (data) => <DataDisplay data={data} />
});
```

### Step 5: Update Hook Return Types
Update the hook interface to provide a clean, consistent API:

**Before:**
```typescript
return {
  data,
  loading,
  error,
  fetchData
};
```

**After:**
```typescript
return {
  // Raw state for advanced usage
  dataState,
  
  // Convenient unpacked properties
  data: isSuccess(dataState) ? dataState.data : undefined,
  isLoading: isLoading(dataState),
  error: isError(dataState) ? dataState.error : undefined,
  
  // Helper methods
  getField: <K extends keyof Data>(field: K) => isSuccess(dataState) ? dataState.data[field] : undefined,
  
  // Actions
  fetchData,
  refresh: fetchData
};
```

## Advanced Patterns

### 1. Optimistic Updates

```typescript
const updateItem = async (id: number, update: ItemUpdate): Promise<AsyncResult<Item, Error>> => {
  // Store current state for rollback
  const previousState = itemsState;
  
  // Apply optimistic update
  if (isSuccess(itemsState)) {
    const updatedItems = itemsState.data.map(item => 
      item.id === id ? { ...item, ...update } : item
    );
    setItemsState(createSuccessResult(updatedItems));
  }
  
  // Perform actual update
  const result = await withEnhancedErrorHandling(async () => {
    const updated = await api.updateItem(id, update);
    return createSuccessResult(updated);
  }, {
    operation: 'updateItem',
    resourceId: String(id)
  });
  
  // Rollback on error
  if (isError(result)) {
    setItemsState(previousState);
  }
  
  return result;
};
```

### 2. Concurrent AsyncResults

```typescript
const loadDashboardData = async (): Promise<AsyncResult<DashboardData, Error>> => {
  // Set loading state
  setDashboardState(createLoadingResult());
  
  // Run multiple async operations concurrently
  const [userResult, itemsResult, statsResult] = await Promise.all([
    fromPromiseCatch<User, Error>(api.getUser(), err => new Error(`Failed to load user: ${String(err)}`)),
    fromPromiseCatch<Item[], Error>(api.getItems(), err => new Error(`Failed to load items: ${String(err)}`)),
    fromPromiseCatch<Stats, Error>(api.getStats(), err => new Error(`Failed to load stats: ${String(err)}`)),
  ]);
  
  // Use the combine helper to combine all results
  const combinedResult = combine<[User, Item[], Stats], Error>([userResult, itemsResult, statsResult]);
  
  // Handle the combined result
  if (isSuccess(combinedResult)) {
    const [user, items, stats] = combinedResult.data;
    const dashboardData = { user, items, stats };
    setDashboardState(createSuccessResult(dashboardData));
    return createSuccessResult(dashboardData);
  } else {
    setDashboardState(combinedResult as AsyncResult<DashboardData, Error>);
    return combinedResult as AsyncResult<DashboardData, Error>;
  }
};
```

### 3. Polling with AsyncResult

```typescript
function usePolling<T>(
  fetchFn: () => Promise<AsyncResult<T, Error>>,
  options: { intervalMs: number; enabled: boolean }
): AsyncResult<T, Error> & { startPolling: () => void; stopPolling: () => void } {
  const [state, setState] = useState<AsyncResult<T, Error>>(createIdleResult());
  const [isPolling, setIsPolling] = useState<boolean>(options.enabled);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const poll = useCallback(async () => {
    if (!isPolling) return;
    
    setState(prevState => isIdle(prevState) ? createLoadingResult() : prevState);
    
    const result = await fetchFn();
    setState(result);
    
    intervalRef.current = setTimeout(poll, options.intervalMs);
  }, [fetchFn, isPolling, options.intervalMs]);

  const startPolling = useCallback(() => {
    setIsPolling(true);
  }, []);

  const stopPolling = useCallback(() => {
    setIsPolling(false);
    if (intervalRef.current) {
      clearTimeout(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Start/stop polling based on enabled flag
  useEffect(() => {
    if (options.enabled) {
      poll();
    }
    
    return () => {
      if (intervalRef.current) {
        clearTimeout(intervalRef.current);
      }
    };
  }, [options.enabled, poll]);

  return {
    ...state,
    startPolling,
    stopPolling
  };
}
```

### 4. Caching AsyncResults

```typescript
function useCachedData<T>(
  key: string,
  fetchFn: () => Promise<AsyncResult<T, Error>>,
  options: { staleTimeMs: number }
): {
  dataState: AsyncResult<T, Error>;
  refresh: () => Promise<AsyncResult<T, Error>>;
  invalidateCache: () => void;
} {
  // State for current data
  const [dataState, setDataState] = useState<AsyncResult<T, Error>>(createIdleResult());
  
  // Ref for cache data
  const cacheRef = useRef<{
    key: string;
    data: T;
    timestamp: number;
  } | null>(null);
  
  // Function to fetch data with cache awareness
  const fetchData = useCallback(async (forceRefresh = false): Promise<AsyncResult<T, Error>> => {
    // Check if we have valid cached data
    const now = Date.now();
    const isCacheValid = cacheRef.current && 
                        cacheRef.current.key === key &&
                        (now - cacheRef.current.timestamp) < options.staleTimeMs;
    
    // Return cached data if valid and not forcing refresh
    if (isCacheValid && !forceRefresh) {
      const result = createSuccessResult<T, Error>(cacheRef.current.data);
      setDataState(result);
      return result;
    }
    
    // Otherwise fetch fresh data
    setDataState(createLoadingResult());
    
    const result = await fetchFn();
    
    if (isSuccess(result)) {
      // Update cache
      cacheRef.current = {
        key,
        data: result.data,
        timestamp: Date.now()
      };
    }
    
    setDataState(result);
    return result;
  }, [key, fetchFn, options.staleTimeMs]);
  
  // Function to invalidate the cache
  const invalidateCache = useCallback(() => {
    cacheRef.current = null;
  }, []);
  
  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  return {
    dataState,
    refresh: () => fetchData(true),
    invalidateCache
  };
}
```

## Example Implementations

### 1. Data Fetching Hook: useMetadata

```typescript
export function useMetadata(mangaId: number): UseMetadataResult {
  // Define state with proper typing
  const [metadataState, setMetadataState] = useState<AsyncResult<MangaMetadata | undefined, Error>>(createIdleResult());
  
  // Fetch metadata query using trpc (TanStack Query v5: no onSuccess/onError in useQuery options)
  const { data: metadataResult, isPending, isError: queryIsError, error: queryError } = trpc.metadata.getMangaMetadata.useQuery(
    { mangaId },
    { enabled: !!mangaId }
  );
  
  // Sync tRPC query state into AsyncResult state
  useEffect(() => {
    if (!mangaId) return;
    if (isPending) {
      setMetadataState(createLoadingResult());
    } else if (queryIsError) {
      setMetadataState(createErrorResult(
        queryError instanceof Error ? queryError : new Error(`Failed to fetch metadata: ${String(queryError)}`)
      ));
    } else if (metadataResult !== undefined) {
      setMetadataState(createSuccessResult(metadataResult));
    }
  }, [mangaId, isPending, queryIsError, queryError, metadataResult]);
  
  // Safe extraction of metadata with type guards
  const metadata = isSuccess(metadataState) ? metadataState.data : undefined;
  
  // Helper for safely accessing metadata fields
  const getMetadataField = <K extends keyof MangaMetadata, D>(
    fieldName: K, 
    defaultValue: D
  ): MangaMetadata[K] | D => {
    if (!isSuccess(metadataState) || !metadataState.data) {
      return defaultValue;
    }
    
    const metadata = metadataState.data;
    return metadata[fieldName] !== undefined ? metadata[fieldName] : defaultValue;
  };
  
  // Refresh metadata with proper AsyncResult handling
  const refreshMetadata = async (): Promise<AsyncResult<void, Error>> => {
    if (!mangaId) {
      return createErrorResult(new Error('Cannot refresh metadata: No manga ID provided'));
    }
    
    setMetadataState(createLoadingResult());
    
    try {
      await utils.metadata.getMangaMetadata.invalidate({ mangaId });
      return createSuccessResult<void, Error>(undefined);
    } catch (error) {
      const errorObj = error instanceof Error 
        ? error 
        : new Error(`Failed to refresh metadata: ${String(error)}`);
      
      setMetadataState(createErrorResult(errorObj));
      return createErrorResult<void, Error>(errorObj);
    }
  };
  
  return {
    metadata,
    getMetadataField,
    refreshMetadata,
    metadataState,
    isLoading
  };
}
```

### 2. Component Implementation: SearchStep

```tsx
export const SearchStep: React.FC<SearchStepProps> = ({ onSelect }) => {
  const [searchState, setSearchState] = useState<AsyncResult<MangaSearchResult[], Error>>(createIdleResult());
  const { searchManga } = useMetadataProviders();
  
  const handleSearch = async (query: string) => {
    // Input validation
    if (!query || query.trim().length === 0) {
      setSearchState(createErrorResult(new Error('Search query cannot be empty')));
      return;
    }
    
    // Set loading state
    setSearchState(createLoadingResult());
    
    // Perform search
    const result = await searchManga(query);
    
    // Update state with result
    setSearchState(result);
  };
  
  // Render search results based on state
  return (
    <div>
      <SearchForm onSubmit={handleSearch} />
      
      {handleAsyncResult(searchState, {
        onIdle: () => <p>Enter a search query to begin</p>,
        onLoading: () => <LoadingSpinner />,
        onError: (error) => <ErrorMessage message={error.message} />,
        onSuccess: (results) => (
          results.length > 0 
            ? <SearchResults results={results} onSelect={onSelect} />
            : <p>No results found</p>
        )
      })}
    </div>
  );
}
```

### 3. Adapter Implementation: MangaDexAdapter

```typescript
export class MangaDexAdapter extends BaseIntegrationAdapter<MangaDexConfig> implements IntegrationAdapter<MangaDexConfig> {
  private createContextualError: ReturnType<typeof createContextualErrorCreator>;
  
  constructor(config: MangaDexConfig) {
    super(config);
    
    this.createContextualError = createContextualErrorCreator({
      service: 'MangaDexAdapter',
      resourceType: 'manga'
    });
  }
  
  /**
   * Search for manga using enhanced error handling
   */
  async searchMangaAsync(query: string, options?: SearchOptions): Promise<AsyncResult<MangaSearchResult[], ContextualError>> {
    return withEnhancedErrorHandling(async () => {
      // Validate input
      if (!query || query.trim().length === 0) {
        throw new Error('Search query cannot be empty');
      }
      
      // Make API request
      const response = await this.client.manga.search(query, {
        limit: options?.limit ?? 20,
        offset: options?.offset ?? 0
      });
      
      // Validate response
      if (!response || !response.data) {
        throw new Error(`Invalid response from MangaDex API for query "${query}"`);
      }
      
      // Process results
      if (!Array.isArray(response.data)) {
        return createSuccessResult([]);
      }
      
      // Map to standard format
      const results = response.data.map(manga => ({
        id: manga.id,
        title: manga.attributes.title.en || Object.values(manga.attributes.title)[0] || 'Unknown',
        source: 'mangadex',
        sourceId: manga.id,
        metadata: {
          coverUrl: manga.attributes.coverUrl,
          description: manga.attributes.description?.en,
          status: manga.attributes.status,
          genres: manga.attributes.tags
            .filter(tag => tag.attributes.group === 'genre')
            .map(tag => tag.attributes.name.en)
        }
      }));
      return createSuccessResult(results);
    }, {
      operation: 'searchManga',
      service: 'MangaDexAdapter',
      resourceType: 'manga',
      details: { query, options }
    });
  }
  
  /**
   * Public interface method that unwraps the AsyncResult
   */
  async searchManga(query: string, options?: SearchOptions): Promise<MangaSearchResult[]> {
    const result = await this.searchMangaAsync(query, options);
    
    if (isSuccess(result)) {
      return result.data;
    }
    
    if (isError(result)) {
      throw result.error;
    }
    
    throw new Error(`Unknown state in searchManga for query "${query}"`);
  }
}
```

## Conclusion

The AsyncResult pattern provides a comprehensive solution for handling asynchronous operations in a type-safe manner. By adopting this pattern throughout the Mugiwara-Kaizoku codebase, we achieve:

1. **Consistent Error Handling**: All async operations handle errors in a standardized way
2. **Complete State Coverage**: Every possible state of an async operation is accounted for
3. **Type Safety**: TypeScript ensures type-safe access to data and errors
4. **Improved UX**: Loading and error states are clearly represented in the UI
5. **Developer Experience**: Common patterns and utilities reduce boilerplate code
6. **Maintainability**: Consistent patterns make the codebase easier to understand and modify
7. **Enhanced Debugging**: Contextual errors provide better insights when issues occur

When integrated with enhanced error handling using the contextual error creator and withEnhancedErrorHandling utilities, the AsyncResult pattern becomes even more powerful, providing rich error context and consistent error propagation throughout the application.

By following the patterns and examples in this guide, developers can ensure that async operations are handled consistently, making the codebase more robust, maintainable, and user-friendly.