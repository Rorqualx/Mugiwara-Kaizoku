# Enhanced Error Handling Comprehensive Guide

## Table of Contents
1. [Overview](#overview)
2. [Core Principles](#core-principles)
3. [Error Handling Architecture](#error-handling-architecture)
4. [Contextual Errors](#contextual-errors)
5. [Integration with AsyncResult Pattern](#integration-with-asyncresult-pattern)
6. [Implementation Patterns](#implementation-patterns)
7. [Best Practices](#best-practices)
8. [Common Pitfalls](#common-pitfalls)
9. [Error Handling in React Components](#error-handling-in-react-components)
10. [Error Handling in APIs and Adapters](#error-handling-in-apis-and-adapters)
11. [Timeout and Cancellation](#timeout-and-cancellation)
12. [Error Recovery Strategies](#error-recovery-strategies)
13. [Example Implementations](#example-implementations)
14. [Migration Guide](#migration-guide)
15. [Conclusion](#conclusion)

## Overview

The Enhanced Error Handling pattern provides a comprehensive approach to handling errors in the Mugiwara-Kaizoku codebase. It builds on top of the AsyncResult pattern and adds contextual information to errors, making them more informative and easier to debug.

### Key Benefits

- **Contextual Errors**: Errors include information about where they occurred and relevant context
- **Consistent Error Structure**: Standardized error format across the codebase
- **Type Safety**: Fully type-safe error handling with TypeScript
- **Better Debugging**: Rich error context makes debugging easier
- **Improved User Experience**: Better error messages for end users
- **Error Recovery**: Standardized patterns for error recovery
- **Error Propagation**: Clean patterns for propagating errors up the call stack
- **Integration with AsyncResult**: Seamless integration with the AsyncResult pattern

## Core Principles

### 1. Errors Should Be Informative

Errors should provide enough context to understand what went wrong, where it happened, and why.

### 2. Errors Should Be Typed

TypeScript should be used to ensure type safety when handling errors.

### 3. Errors Should Be Handled at the Appropriate Level

Not all errors should bubble up to the user. Some should be handled silently, some should be logged, and some should be displayed to the user.

### 4. Never Swallow Errors

Always handle or propagate errors - never ignore them.

### 5. Standardized Error Handling

Use consistent patterns for handling errors across the codebase.

## Error Handling Architecture

The error handling architecture is built around the following components:

1. **ContextualError**: A base error type that includes context about where the error occurred
2. **ErrorContext**: An interface defining what context to include with errors
3. **createContextualErrorCreator**: A factory function for creating contextual errors
4. **withEnhancedErrorHandling**: A utility for wrapping async operations with enhanced error handling
5. **AsyncResult Integration**: Integration with the AsyncResult pattern

### Error Type Hierarchy

```typescript
// Base error types
interface BaseError extends Error {
  code?: string;
  statusCode?: number;
}

interface ContextualError extends BaseError {
  service: string;
  operation: string;
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, unknown>;
}
```

## Contextual Errors

Contextual errors include additional information about where the error occurred, making them more useful for debugging.

### ErrorContext Interface

```typescript
export interface ErrorContext {
  service?: string;      // Service/module where the error occurred
  operation?: string;    // Operation being performed when error occurred
  resourceType?: string; // Type of resource being accessed
  resourceId?: string;   // ID of resource being accessed
  details?: Record<string, unknown>; // Additional context
}
```

### Contextual Error Creator

```typescript
export function createContextualErrorCreator(defaultContext: Partial<ErrorContext>) {
  return (message: string, operation?: string, details?: Record<string, unknown>): Error => {
    const error = new Error(message);
    
    // Add context properties to the error object
    Object.assign(error, {
      ...defaultContext,
      ...(operation ? { operation } : {}),
      ...(details ? { details } : {})
    });
    
    return error;
  };
}
```

### Using the Contextual Error Creator

```typescript
class MyService {
  private createError: ReturnType<typeof createContextualErrorCreator>;
  
  constructor() {
    // Create a service-specific error creator
    this.createError = createContextualErrorCreator({
      service: 'MyService',
      resourceType: 'widget'
    });
  }
  
  async getWidget(id: string): Promise<Widget> {
    try {
      // Implementation...
    } catch (error) {
      // Create a contextual error with operation and details
      throw this.createError(
        `Failed to get widget: ${error instanceof Error ? error.message : String(error)}`,
        'getWidget',
        { widgetId: id }
      );
    }
  }
}
```

## Integration with AsyncResult Pattern

The enhanced error handling pattern integrates seamlessly with the AsyncResult pattern, which is the primary pattern for handling asynchronous operations in the codebase.

### withEnhancedErrorHandling Utility

```typescript
export async function withEnhancedErrorHandling<T>(
  operation: () => Promise<T>,
  context: ErrorContext
): Promise<AsyncResult<T, Error>> {
  try {
    const result = await operation();
    return createSuccessResult(result);
  } catch (error) {
    // Add context to the error
    const contextualError = error instanceof Error ? error : new Error(String(error));
    
    // Add context properties to the error object
    Object.assign(contextualError, context);
    
    return createErrorResult(contextualError);
  }
}
```

### Using withEnhancedErrorHandling

```typescript
async function fetchUserData(userId: string): Promise<AsyncResult<UserData, Error>> {
  return withEnhancedErrorHandling(async () => {
    // Validate input
    if (!userId) {
      throw new Error('User ID is required');
    }
    
    // Make API request
    const response = await api.getUser(userId);
    
    // Process and return data
    return {
      id: response.id,
      name: response.name,
      email: response.email
    };
  }, {
    operation: 'fetchUserData',
    service: 'UserService',
    resourceType: 'user',
    resourceId: userId
  });
}
```

## Implementation Patterns

### Basic Error Handling Pattern

```typescript
try {
  // Operation that might throw
  const result = await someAsyncOperation();
  return createSuccessResult(result);
} catch (error) {
  // Create a well-formed error with context
  const contextualError = new Error(
    `Operation failed: ${error instanceof Error ? error.message : String(error)}`
  );
  
  // Add context
  Object.assign(contextualError, {
    operation: 'operationName',
    service: 'ServiceName',
    details: { /* relevant details */ }
  });
  
  return createErrorResult(contextualError);
}
```

### Pattern with Enhanced Error Handling

```typescript
return withEnhancedErrorHandling(async () => {
  // Validate inputs
  if (!isValidInput(params)) {
    throw this.createContextualError('Validation error: Invalid input', 'methodName');
  }
  
  // Perform operation
  const result = await someAsyncOperation();
  
  // Process result
  return processedResult;
}, {
  operation: 'methodName',
  service: 'ServiceName',
  resourceType: 'resourceType',
  details: { params }
});
```

### Pattern with Dependent Operations

```typescript
return withEnhancedErrorHandling(async () => {
  // First operation
  const result1 = await operation1();
  
  // Check result
  if (!isSuccess(result1)) {
    if (isError(result1)) {
      throw result1.error; // Re-throw with existing context
    }
    throw this.createContextualError('First operation failed', 'methodName');
  }
  
  // Second operation that depends on the first
  const result2 = await operation2(result1.data);
  
  // Check result
  if (!isSuccess(result2)) {
    if (isError(result2)) {
      throw result2.error; // Re-throw with existing context
    }
    throw this.createContextualError('Second operation failed', 'methodName');
  }
  
  // Return final result
  return finalizeResults(result1.data, result2.data);
}, {
  operation: 'methodName',
  service: 'ServiceName',
  resourceType: 'resourceType'
});
```

## Best Practices

### 1. Use createContextualError for Creating Errors

```typescript
// Define at the class level
private createError = createContextualErrorCreator({
  service: 'ServiceName',
  resourceType: 'resourceType'
});

// Use in methods
throw this.createError(
  `Failed to perform operation: ${error.message}`,
  'methodName',
  { param1: value1, param2: value2 }
);
```

### 2. Include Specific Error Messages

```typescript
// ❌ Bad: Generic error message
throw new Error('Operation failed');

// ✅ Good: Specific error message with context
throw this.createError(
  `Failed to fetch user with ID ${userId}: ${error.message}`,
  'fetchUser',
  { userId }
);
```

### 3. Use withEnhancedErrorHandling for Async Operations

```typescript
// Use withEnhancedErrorHandling for all async operations
return withEnhancedErrorHandling(async () => {
  // Implementation...
}, {
  operation: 'methodName',
  service: 'ServiceName'
});
```

### 4. Add Relevant Context to Errors

```typescript
// Include relevant context in errors
throw this.createError(
  'Invalid configuration',
  'initializeService',
  { 
    configPath: '/path/to/config.json',
    missingFields: ['apiKey', 'endpoint']
  }
);
```

### 5. Re-throw Existing Contextual Errors

```typescript
// If you already have a contextual error, re-throw it rather than creating a new one
try {
  await someOperation();
} catch (error) {
  if (error instanceof Error && 'operation' in error) {
    throw error; // Re-throw with existing context
  }
  
  // Create a new contextual error for non-contextual errors
  throw this.createError(
    `Operation failed: ${error instanceof Error ? error.message : String(error)}`,
    'currentOperation'
  );
}
```

### 6. Handle AsyncResult Errors Properly

```typescript
const result = await operation();

if (isError(result)) {
  // Option 1: Re-throw the error
  throw result.error;
  
  // Option 2: Return the error result
  return result;
  
  // Option 3: Create a new error with additional context
  throw this.createError(
    `Failed to perform operation: ${result.error.message}`,
    'currentOperation'
  );
}
```

### 7. Use Explicit Type Parameters with AsyncResult

```typescript
// Explicit type parameters for AsyncResult
const result: AsyncResult<UserData, Error> = await fetchUserData(userId);

// Or with function return type
async function fetchUserData(userId: string): Promise<AsyncResult<UserData, Error>> {
  // Implementation...
}
```

## Common Pitfalls

### 1. Swallowing Errors

**❌ Incorrect:**
```typescript
try {
  await someOperation();
} catch (error) {
  console.error('Operation failed:', error);
  // Error is swallowed, not propagated
}
```

**✅ Correct:**
```typescript
try {
  await someOperation();
} catch (error) {
  console.error('Operation failed:', error);
  // Propagate the error
  throw this.createError(
    `Operation failed: ${error instanceof Error ? error.message : String(error)}`,
    'operationName'
  );
}
```

### 2. Generic Error Messages

**❌ Incorrect:**
```typescript
throw new Error('Failed');
```

**✅ Correct:**
```typescript
throw this.createError(
  `Failed to fetch user with ID ${userId}: Server returned 404 Not Found`,
  'fetchUser',
  { userId, statusCode: 404 }
);
```

### 3. Not Adding Context to Errors

**❌ Incorrect:**
```typescript
try {
  await someOperation();
} catch (error) {
  throw error; // No context added
}
```

**✅ Correct:**
```typescript
try {
  await someOperation();
} catch (error) {
  // Add context to the error
  throw this.createError(
    `Operation failed: ${error instanceof Error ? error.message : String(error)}`,
    'operationName'
  );
}
```

### 4. Not Handling AsyncResult States Properly

**❌ Incorrect:**
```typescript
const result = await operation();
return result.data; // Might not have data!
```

**✅ Correct:**
```typescript
const result = await operation();

if (isSuccess(result)) {
  return result.data;
}

if (isError(result)) {
  throw result.error;
}

throw new Error('Unexpected AsyncResult state');
```

### 5. Not Validating Input Parameters

**❌ Incorrect:**
```typescript
async function fetchData(id: string): Promise<AsyncResult<Data, Error>> {
  // No validation, what if id is empty?
  return withEnhancedErrorHandling(async () => {
    return await api.fetchData(id);
  }, { /* context */ });
}
```

**✅ Correct:**
```typescript
async function fetchData(id: string): Promise<AsyncResult<Data, Error>> {
  return withEnhancedErrorHandling(async () => {
    // Validate input
    if (!id) {
      throw this.createError('ID is required', 'fetchData');
    }
    
    return await api.fetchData(id);
  }, { /* context */ });
}
```

## Error Handling in React Components

React components should handle errors gracefully to provide a good user experience.

### Using AsyncResult in Components

```tsx
function UserProfile({ userId }: { userId: string }) {
  const { userState, fetchUser } = useUser(userId);
  
  // Handle each AsyncResult state explicitly
  return handleAsyncResult(userState, {
    onIdle: () => <Button onClick={fetchUser}>Load User</Button>,
    onLoading: () => <LoadingSpinner />,
    onError: (error) => (
      <ErrorMessage
        title="Failed to load user"
        message={error.message}
        retry={fetchUser}
      />
    ),
    onSuccess: (user) => (
      <UserProfileView user={user} />
    )
  });
}
```

### Error Boundaries

Use React Error Boundaries to catch errors in component trees and display fallback UIs:

```tsx
class ErrorBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { fallback: React.ReactNode; children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log the error
    console.error('Component error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }

    return this.props.children;
  }
}

// Usage
function App() {
  return (
    <ErrorBoundary fallback={<ErrorPage />}>
      <MyComponent />
    </ErrorBoundary>
  );
}
```

### useErrorHandler Hook

Create a custom hook for handling errors in components:

```typescript
function useErrorHandler() {
  const [error, setError] = useState<Error | null>(null);
  
  const handleError = useCallback((error: unknown) => {
    const formattedError = error instanceof Error 
      ? error 
      : new Error(String(error));
    
    setError(formattedError);
    
    // Log the error
    console.error('Error caught:', formattedError);
  }, []);
  
  const clearError = useCallback(() => {
    setError(null);
  }, []);
  
  return {
    error,
    handleError,
    clearError
  };
}

// Usage
function MyComponent() {
  const { error, handleError, clearError } = useErrorHandler();
  
  const fetchData = async () => {
    try {
      // Some operation that might fail
    } catch (err) {
      handleError(err);
    }
  };
  
  if (error) {
    return (
      <ErrorMessage 
        error={error} 
        onClose={clearError} 
        retry={fetchData} 
      />
    );
  }
  
  // Normal render
}
```

## Error Handling in APIs and Adapters

APIs and adapters should use enhanced error handling to provide detailed error information.

### API Client Pattern

```typescript
export class ApiClient {
  private createError: ReturnType<typeof createContextualErrorCreator>;
  
  constructor() {
    this.createError = createContextualErrorCreator({
      service: 'ApiClient'
    });
  }
  
  async request<T>(config: RequestConfig): Promise<AsyncResult<T, Error>> {
    return withEnhancedErrorHandling(async () => {
      try {
        // Make the request
        const response = await fetch(config.url, {
          method: config.method,
          headers: config.headers,
          body: config.body ? JSON.stringify(config.body) : undefined
        });
        
        // Check if response is ok
        if (!response.ok) {
          throw this.createError(
            `Request failed with status ${response.status}: ${response.statusText}`,
            'request',
            { 
              url: config.url,
              method: config.method,
              status: response.status 
            }
          );
        }
        
        // Parse response
        const data = await response.json();
        return data as T;
      } catch (error) {
        // If it's already a contextual error, re-throw it
        if (error instanceof Error && 'service' in error) {
          throw error;
        }
        
        // Otherwise, create a new contextual error
        throw this.createError(
          `Request failed: ${error instanceof Error ? error.message : String(error)}`,
          'request',
          { url: config.url, method: config.method }
        );
      }
    }, {
      operation: 'request',
      service: 'ApiClient',
      details: { url: config.url, method: config.method }
    });
  }
  
  // Convenience methods
  async get<T>(url: string, options?: RequestOptions): Promise<AsyncResult<T, Error>> {
    return this.request<T>({ url, method: 'GET', ...options });
  }
  
  async post<T>(url: string, data: unknown, options?: RequestOptions): Promise<AsyncResult<T, Error>> {
    return this.request<T>({ url, method: 'POST', body: data, ...options });
  }
  
  // And so on for other HTTP methods...
}
```

### Adapter Pattern

```typescript
export class MangadexAdapter implements IntegrationAdapter {
  private createError: ReturnType<typeof createContextualErrorCreator>;
  private client: ApiClient;
  
  constructor(config: AdapterConfig) {
    this.createError = createContextualErrorCreator({
      service: 'MangadexAdapter',
      resourceType: 'manga'
    });
    
    this.client = new ApiClient(config);
  }
  
  async searchMangaAsync(query: string): Promise<AsyncResult<MangaSearchResult[], Error>> {
    return withEnhancedErrorHandling(async () => {
      // Validate input
      if (!query || query.trim().length === 0) {
        throw this.createError('Search query cannot be empty', 'searchManga');
      }
      
      // Make API request
      const result = await this.client.get<ApiSearchResponse>('/manga', {
        params: { title: query }
      });
      
      // Handle API response
      if (isError(result)) {
        throw result.error;
      }
      
      // Process results
      const data = result.data;
      
      if (!data || !Array.isArray(data.results)) {
        throw this.createError(
          'Invalid API response format',
          'searchManga',
          { query }
        );
      }
      
      // Map to standard format
      return data.results.map(item => ({
        id: item.id,
        title: item.title,
        source: 'mangadex',
        sourceId: item.id,
        // Other fields...
      }));
    }, {
      operation: 'searchManga',
      service: 'MangadexAdapter',
      details: { query }
    });
  }
  
  // Public method that unwraps AsyncResult
  async searchManga(query: string): Promise<MangaSearchResult[]> {
    const result = await this.searchMangaAsync(query);
    
    if (isSuccess(result)) {
      return result.data;
    }
    
    if (isError(result)) {
      throw result.error;
    }
    
    throw new Error(`Unknown state in searchManga`);
  }
}
```

## Timeout and Cancellation

Handle timeouts and cancellations to prevent operations from hanging indefinitely.

### Timeout Pattern

```typescript
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string
): Promise<AsyncResult<T, Error>> {
  return new Promise<AsyncResult<T, Error>>(resolve => {
    // Create a timeout promise
    const timeoutPromise = new Promise<void>(timeoutResolve => {
      setTimeout(() => {
        timeoutResolve();
        resolve(createErrorResult(new Error(timeoutMessage)));
      }, timeoutMs);
    });
    
    // Execute the original promise
    promise.then(
      result => resolve(createSuccessResult(result)),
      error => resolve(createErrorResult(error instanceof Error ? error : new Error(String(error))))
    );
  });
}

// Usage
const result = await withTimeout(
  api.fetchData(),
  5000,
  'Operation timed out after 5 seconds'
);
```

### Cancellation Pattern with AbortController

```typescript
async function withCancellation<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs?: number
): Promise<AsyncResult<T, Error>> {
  // Create abort controller
  const controller = new AbortController();
  const { signal } = controller;
  
  // Set up timeout if provided
  let timeoutId: NodeJS.Timeout | undefined;
  if (timeoutMs) {
    timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  }
  
  try {
    const result = await operation(signal);
    return createSuccessResult(result);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return createErrorResult(
        new Error(`Operation was cancelled${timeoutMs ? ` after ${timeoutMs}ms timeout` : ''}`)
      );
    }
    
    return createErrorResult(
      error instanceof Error ? error : new Error(String(error))
    );
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

// Usage
const result = await withCancellation(
  async (signal) => {
    const response = await fetch('/api/data', { signal });
    return await response.json();
  },
  5000 // 5 second timeout
);
```

## Error Recovery Strategies

Implement error recovery strategies to make the application more resilient.

### Retry Pattern

```typescript
async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number;
    delayMs?: number;
    backoffFactor?: number;
    shouldRetry?: (error: Error) => boolean;
  } = {}
): Promise<AsyncResult<T, Error>> {
  const {
    maxRetries = 3,
    delayMs = 1000,
    backoffFactor = 2,
    shouldRetry = () => true
  } = options;
  
  let currentDelay = delayMs;
  let attempts = 0;
  let lastError: Error | undefined;
  
  while (attempts <= maxRetries) {
    try {
      const result = await operation();
      return createSuccessResult(result);
    } catch (error) {
      attempts++;
      
      const typedError = error instanceof Error ? error : new Error(String(error));
      lastError = typedError;
      
      // If we've exceeded max retries or shouldn't retry this error, return error
      if (attempts > maxRetries || !shouldRetry(typedError)) {
        return createErrorResult(typedError);
      }
      
      // Add retry information to the error for logging
      Object.assign(typedError, {
        retryAttempt: attempts,
        maxRetries
      });
      
      console.warn(`Retry ${attempts}/${maxRetries} after error:`, typedError);
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, currentDelay));
      
      // Increase delay for next attempt
      currentDelay *= backoffFactor;
    }
  }
  
  // This should never be reached, but TypeScript requires a return
  return createErrorResult(
    lastError || new Error('Failed after maximum retry attempts')
  );
}

// Usage
const result = await withRetry(
  () => api.fetchData(),
  {
    maxRetries: 3,
    delayMs: 1000,
    backoffFactor: 2,
    shouldRetry: (error) => {
      // Only retry network errors or 5xx status codes
      return error.message.includes('network') || 
             ('statusCode' in error && (error as any).statusCode >= 500);
    }
  }
);
```

### Circuit Breaker Pattern

```typescript
class CircuitBreaker {
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  
  constructor(
    private readonly options: {
      failureThreshold: number;
      resetTimeoutMs: number;
    }
  ) {}
  
  async execute<T>(
    operation: () => Promise<T>
  ): Promise<AsyncResult<T, Error>> {
    // Check if circuit is open
    if (this.state === 'open') {
      // Check if reset timeout has elapsed
      const now = Date.now();
      if (now - this.lastFailureTime > this.options.resetTimeoutMs) {
        this.state = 'half-open';
      } else {
        return createErrorResult(
          new Error('Circuit breaker is open')
        );
      }
    }
    
    try {
      const result = await operation();
      
      // Success - reset failure count and close circuit
      this.failureCount = 0;
      this.state = 'closed';
      
      return createSuccessResult(result);
    } catch (error) {
      // Failure - increment count and update time
      this.failureCount++;
      this.lastFailureTime = Date.now();
      
      // Check if threshold is reached
      if (this.failureCount >= this.options.failureThreshold) {
        this.state = 'open';
      }
      
      return createErrorResult(
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }
  
  reset(): void {
    this.failureCount = 0;
    this.state = 'closed';
  }
  
  getState(): 'closed' | 'open' | 'half-open' {
    return this.state;
  }
}

// Usage
const breaker = new CircuitBreaker({
  failureThreshold: 3,
  resetTimeoutMs: 30000 // 30 seconds
});

const result = await breaker.execute(() => api.fetchData());
```

### Fallback Pattern

```typescript
async function withFallback<T>(
  primaryOperation: () => Promise<T>,
  fallbackOperation: () => Promise<T>
): Promise<AsyncResult<T, Error>> {
  try {
    // Try primary operation
    const result = await primaryOperation();
    return createSuccessResult(result);
  } catch (primaryError) {
    try {
      // If primary fails, try fallback
      console.warn('Primary operation failed, using fallback:', primaryError);
      const fallbackResult = await fallbackOperation();
      
      // Add information that this is a fallback result
      return createSuccessResult({
        ...fallbackResult,
        _isFallback: true
      } as unknown as T);
    } catch (fallbackError) {
      // Both operations failed
      return createErrorResult(
        new Error(
          `Primary error: ${primaryError instanceof Error ? primaryError.message : String(primaryError)}. ` +
          `Fallback error: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`
        )
      );
    }
  }
}

// Usage
const result = await withFallback(
  () => api.fetchFromMainServer(),
  () => api.fetchFromBackupServer()
);
```

## Example Implementations

### 1. API Client with Enhanced Error Handling

```typescript
export class HttpClient {
  private readonly baseUrl: string;
  private createError: ReturnType<typeof createContextualErrorCreator>;
  
  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.createError = createContextualErrorCreator({
      service: 'HttpClient'
    });
  }
  
  async request<T>(config: {
    path: string;
    method: string;
    params?: Record<string, string>;
    body?: unknown;
    headers?: Record<string, string>;
    timeout?: number;
  }): Promise<AsyncResult<T, Error>> {
    return withEnhancedErrorHandling(async () => {
      // Construct URL with query parameters
      const url = new URL(config.path, this.baseUrl);
      
      if (config.params) {
        Object.entries(config.params).forEach(([key, value]) => {
          url.searchParams.append(key, value);
        });
      }
      
      // Create abort controller for timeout
      const controller = new AbortController();
      const { signal } = controller;
      
      // Set up timeout if provided
      let timeoutId: NodeJS.Timeout | undefined;
      if (config.timeout) {
        timeoutId = setTimeout(() => controller.abort(), config.timeout);
      }
      
      try {
        // Make the request
        const response = await fetch(url.toString(), {
          method: config.method,
          headers: {
            'Content-Type': 'application/json',
            ...config.headers
          },
          body: config.body ? JSON.stringify(config.body) : undefined,
          signal
        });
        
        // Clean up timeout
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        
        // Check if response is ok
        if (!response.ok) {
          throw this.createError(
            `Request failed with status ${response.status}: ${response.statusText}`,
            'request',
            { 
              url: url.toString(),
              method: config.method,
              status: response.status 
            }
          );
        }
        
        // Parse response based on content type
        const contentType = response.headers.get('content-type');
        
        if (contentType?.includes('application/json')) {
          return await response.json() as T;
        } else {
          return await response.text() as unknown as T;
        }
      } catch (error) {
        // Clean up timeout
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        
        // Handle abort error
        if (error instanceof DOMException && error.name === 'AbortError') {
          throw this.createError(
            `Request timed out after ${config.timeout}ms`,
            'request',
            { url: url.toString(), method: config.method, timeout: config.timeout }
          );
        }
        
        // Re-throw contextual errors
        if (error instanceof Error && 'service' in error) {
          throw error;
        }
        
        // Create contextual error for other errors
        throw this.createError(
          `Request failed: ${error instanceof Error ? error.message : String(error)}`,
          'request',
          { url: url.toString(), method: config.method }
        );
      }
    }, {
      operation: 'request',
      service: 'HttpClient',
      details: { 
        url: `${this.baseUrl}${config.path}`, 
        method: config.method,
        params: config.params
      }
    });
  }
  
  // Convenience methods
  async get<T>(path: string, options?: {
    params?: Record<string, string>;
    headers?: Record<string, string>;
    timeout?: number;
  }): Promise<AsyncResult<T, Error>> {
    return this.request<T>({
      path,
      method: 'GET',
      ...options
    });
  }
  
  async post<T>(path: string, body: unknown, options?: {
    params?: Record<string, string>;
    headers?: Record<string, string>;
    timeout?: number;
  }): Promise<AsyncResult<T, Error>> {
    return this.request<T>({
      path,
      method: 'POST',
      body,
      ...options
    });
  }
  
  // Additional methods for other HTTP verbs...
}
```

### 2. Adapter with Enhanced Error Handling

```typescript
export class MangadexAdapter implements IntegrationAdapter {
  private client: HttpClient;
  private createError: ReturnType<typeof createContextualErrorCreator>;
  
  constructor(config: MangadexConfig) {
    this.client = new HttpClient(config.baseUrl);
    this.createError = createContextualErrorCreator({
      service: 'MangadexAdapter',
      resourceType: 'manga'
    });
  }
  
  async searchMangaAsync(query: string, options?: SearchOptions): Promise<AsyncResult<MangaSearchResult[], Error>> {
    return withEnhancedErrorHandling(async () => {
      // Validate input
      if (!query || query.trim().length === 0) {
        throw this.createError('Search query cannot be empty', 'searchManga');
      }
      
      // Prepare search parameters
      const params: Record<string, string> = {
        title: query,
        limit: String(options?.limit || 20),
        offset: String(options?.offset || 0)
      };
      
      // Make API request with retry logic
      const result = await withRetry(
        () => this.client.get<MangadexSearchResponse>('/manga', { params }),
        {
          maxRetries: 2,
          shouldRetry: (error) => {
            // Only retry network errors or server errors, not client errors
            return !('statusCode' in error) || ((error as any).statusCode >= 500);
          }
        }
      );
      
      // Handle API response
      if (isError(result)) {
        throw result.error;
      }
      
      // Process results
      const data = result.data;
      
      if (!data || !Array.isArray(data.data)) {
        throw this.createError(
          'Invalid API response format',
          'searchManga',
          { query }
        );
      }
      
      // Map to standard format
      return data.data.map(manga => ({
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
    }, {
      operation: 'searchManga',
      service: 'MangadexAdapter',
      resourceType: 'manga',
      details: { query, options }
    });
  }
  
  // Public interface method that unwraps the AsyncResult
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
  
  // Additional methods...
}
```

### 3. React Hook with Enhanced Error Handling

```typescript
export function useMangaSearch(initialQuery: string = ''): {
  query: string;
  setQuery: (query: string) => void;
  searchState: AsyncResult<MangaSearchResult[], Error>;
  search: () => Promise<AsyncResult<MangaSearchResult[], Error>>;
  isSearching: boolean;
  error: Error | null;
  results: MangaSearchResult[];
} {
  // State
  const [query, setQuery] = useState<string>(initialQuery);
  const [searchState, setSearchState] = useState<AsyncResult<MangaSearchResult[], Error>>(createIdleResult());
  
  // Get adapter instance
  const { getMangadexAdapter } = useAdapters();
  const adapter = getMangadexAdapter();
  
  // Search function
  const search = useCallback(async (): Promise<AsyncResult<MangaSearchResult[], Error>> => {
    // Check if query is valid
    if (!query || query.trim().length < 3) {
      const error = new Error('Search query must be at least 3 characters');
      setSearchState(createErrorResult(error));
      return createErrorResult(error);
    }
    
    // Set loading state
    setSearchState(createLoadingResult());
    
    // Perform search with timeout
    const result = await withTimeout(
      adapter.searchMangaAsync(query),
      10000, // 10 second timeout
      `Search for "${query}" timed out after 10 seconds`
    );
    
    // Update state with search result
    setSearchState(result);
    return result;
  }, [query, adapter]);
  
  // Derived values
  const isSearching = isLoading(searchState);
  const error = isError(searchState) ? searchState.error : null;
  const results = isSuccess(searchState) ? searchState.data : [];
  
  return {
    query,
    setQuery,
    searchState,
    search,
    isSearching,
    error,
    results
  };
}
```

## Migration Guide

When migrating existing code to use enhanced error handling, follow these steps:

### Step 1: Identify Code That Needs Migration

Look for:
- Functions that throw errors without proper context
- Error handling with generic error messages
- Inconsistent error handling patterns
- Code that swallows errors without proper handling

### Step 2: Add Contextual Error Creators to Classes

```typescript
// Before
class MyService {
  async getWidget(id: string): Promise<Widget> {
    try {
      // Implementation...
    } catch (error) {
      throw new Error(`Failed to get widget: ${error.message}`);
    }
  }
}

// After
class MyService {
  private createError: ReturnType<typeof createContextualErrorCreator>;
  
  constructor() {
    this.createError = createContextualErrorCreator({
      service: 'MyService',
      resourceType: 'widget'
    });
  }
  
  async getWidget(id: string): Promise<Widget> {
    try {
      // Implementation...
    } catch (error) {
      throw this.createError(
        `Failed to get widget: ${error instanceof Error ? error.message : String(error)}`,
        'getWidget',
        { widgetId: id }
      );
    }
  }
}
```

### Step 3: Update Async Methods with withEnhancedErrorHandling

```typescript
// Before
async function fetchData(id: string): Promise<Data> {
  try {
    const response = await api.getData(id);
    return response;
  } catch (error) {
    throw new Error(`Failed to fetch data: ${error.message}`);
  }
}

// After
async function fetchData(id: string): Promise<AsyncResult<Data, Error>> {
  return withEnhancedErrorHandling(async () => {
    // Validate input
    if (!id) {
      throw this.createError('ID is required', 'fetchData');
    }
    
    const response = await api.getData(id);
    return response;
  }, {
    operation: 'fetchData',
    service: 'DataService',
    resourceType: 'data',
    resourceId: id
  });
}
```

### Step 4: Update Error Messages to Be More Informative

```typescript
// Before
throw new Error('Failed to load user');

// After
throw this.createError(
  `Failed to load user with ID ${userId}: ${error instanceof Error ? error.message : String(error)}`,
  'loadUser',
  { userId, requestTime: new Date().toISOString() }
);
```

### Step 5: Add Public Interface Methods That Unwrap AsyncResult

```typescript
// Before
async function searchManga(query: string): Promise<MangaEntity[]> {
  // Implementation...
}

// After
// Private implementation with AsyncResult
async function searchMangaAsync(query: string): Promise<AsyncResult<MangaEntity[], Error>> {
  return withEnhancedErrorHandling(async () => {
    // Implementation...
  }, {
    operation: 'searchManga',
    service: 'MangaService',
    resourceType: 'manga'
  });
}

// Public interface method that unwraps AsyncResult
async function searchManga(query: string): Promise<MangaEntity[]> {
  const result = await searchMangaAsync(query);
  
  if (isSuccess(result)) {
    return result.data;
  }
  
  if (isError(result)) {
    throw result.error;
  }
  
  throw new Error(`Unknown state in searchManga`);
}
```

### Step 6: Update React Components to Handle Errors Properly

```typescript
// Before
function UserProfile({ userId }: { userId: string }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  const fetchUser = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await api.getUser(userId);
      setUser(data);
    } catch (err) {
      setError('Failed to load user');
    } finally {
      setLoading(false);
    }
  };
  
  // Render logic...
}

// After
function UserProfile({ userId }: { userId: string }) {
  const [userState, setUserState] = useState<AsyncResult<User, Error>>(createIdleResult());
  
  const fetchUser = async () => {
    setUserState(createLoadingResult());
    
    const result = await withEnhancedErrorHandling(async () => {
      if (!userId) {
        throw new Error('User ID is required');
      }
      
      return await api.getUser(userId);
    }, {
      operation: 'fetchUser',
      service: 'UserProfileComponent',
      resourceType: 'user',
      resourceId: userId
    });
    
    setUserState(result);
  };
  
  // Render with handleAsyncResult
  return handleAsyncResult(userState, {
    onIdle: () => <Button onClick={fetchUser}>Load User</Button>,
    onLoading: () => <LoadingSpinner />,
    onError: (error) => (
      <ErrorMessage
        title="Failed to load user"
        message={error.message}
        retry={fetchUser}
      />
    ),
    onSuccess: (user) => (
      <UserProfileView user={user} />
    )
  });
}
```

## Conclusion

The Enhanced Error Handling pattern, when integrated with the AsyncResult pattern, provides a comprehensive solution for handling errors in a type-safe and informative way. By adding context to errors and using consistent patterns for error handling, we can improve debugging, provide better user experiences, and make our code more robust and maintainable.

Key benefits of this pattern include:

1. **Contextual Errors**: Errors include information about where they occurred and relevant context
2. **Consistent Error Structure**: Standardized error format across the codebase
3. **Type Safety**: Fully type-safe error handling with TypeScript
4. **Better Debugging**: Rich error context makes debugging easier
5. **Improved User Experience**: Better error messages for end users
6. **Error Recovery**: Standardized patterns for error recovery
7. **Error Propagation**: Clean patterns for propagating errors up the call stack
8. **Integration with AsyncResult**: Seamless integration with the AsyncResult pattern

By following the patterns and best practices in this guide, you can ensure that errors in your code are handled consistently, informatively, and in a type-safe manner.