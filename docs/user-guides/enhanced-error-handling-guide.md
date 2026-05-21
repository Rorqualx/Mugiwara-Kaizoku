# Enhanced Error Handling Guide

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Enhanced Error Handling Guide

---
# Enhanced Error Handling Guide with AsyncResult Pattern

This guide provides a comprehensive approach to error handling in the Mugiwara-Kaizoku codebase using the AsyncResult pattern. Following these patterns ensures consistent, robust error handling throughout the application.

## 1. Core Principles of Error Handling

### Fundamental Rules

1. **Never swallow errors** - Always propagate or handle errors explicitly
2. **Add context to errors** - Include operation details when throwing or returning errors
3. **Type safety first** - Use proper typing for all error handling
4. **Consistent patterns** - Apply the same error handling patterns across the codebase
5. **Graceful degradation** - Applications should fail gracefully with helpful error messages

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

## 2. Basic AsyncResult Error Handling

The AsyncResult pattern is the foundation of our error handling strategy.

### AsyncResult Structure

```typescript
type AsyncResult<T, E = Error> =
  | { status: 'success'; data: T }
  | { status: 'error'; error: E }
  | { status: 'loading' }
  | { status: 'idle' };
```

### Creating AsyncResults

```typescript
// Success case
const result = createSuccessResult<MangaEntity, Error>(mangaData);

// Error case
const result = createErrorResult<MangaEntity, Error>(
  new Error('Failed to fetch manga data')
);

// Loading state
const result = createLoadingResult<MangaEntity, Error>();

// Idle state
const result = createIdleResult<MangaEntity, Error>();
```

### Checking AsyncResult Status

Always use type guards for checking result status:

```typescript
// Type guards for checking AsyncResult status
import { isSuccess, isError, isLoading, isIdle } from '../utils/async-result';

// Checking result status
if (isSuccess(result)) {
  return result.data;
}
if (isError(result)) {
  handleError(result.error);
}
if (isLoading(result)) {
  showLoadingIndicator();
}
if (isIdle(result)) {
  initializeOperation();
}
```

### Basic Try-Catch Pattern

```typescript
async function fetchData(): Promise<AsyncResult<Data, Error>> {
  try {
    const response = await api.request();
    return createSuccessResult(response);
  } catch (error) {
    return createErrorResult(
      error instanceof Error 
        ? error 
        : new Error(`Failed to fetch data: ${String(error)}`)
    );
  }
}
```

## 3. Contextual Error Handling

### Creating Contextual Errors

```typescript
import { createContextualErrorCreator } from '../utils/errorHandling';

// Define a contextual error creator for the service
const createError = createContextualErrorCreator({
  service: 'MangaDexAdapter',
  resourceType: 'manga'
});

// Use it to create detailed errors
const error = createError(
  'Failed to fetch manga details', 
  'fetchMangaDetails',  // operation
  { mangaId: '12345' }  // additional context
);
```

### Enhanced Error Context Structure

```typescript
interface ErrorContext {
  service: string;      // The service that threw the error (e.g., 'ComicVineAdapter')
  operation: string;    // The specific operation that failed (e.g., 'searchManga')
  resourceType?: string; // The type of resource being operated on (e.g., 'manga')
  resourceId?: string;   // The ID of the specific resource (e.g., manga ID)
  details?: Record<string, unknown>; // Additional contextual details
}
```

### withEnhancedErrorHandling Wrapper

```typescript
import { withEnhancedErrorHandling } from '../utils/errorHandling';

// Wrap async operations with enhanced error context
const result = await withEnhancedErrorHandling(async () => {
  const response = await api.request();
  return createSuccessResult(response);
}, {
  service: 'MangaDexAdapter',
  operation: 'searchManga',
  resourceType: 'manga',
  details: { query: searchQuery }
});
```

## 4. Service-Specific Error Handling

### Adapter Implementation

```typescript
export class MangaDexAdapter implements MetadataIntegrationAdapter {
  private createError: ContextualErrorCreator;
  
  constructor() {
    // Initialize the error creator with service context
    this.createError = createContextualErrorCreator({
      service: 'MangaDexAdapter',
      resourceType: 'manga'
    });
  }
  
  async searchManga(query: string): Promise<AsyncResult<MangaSearchResult[], Error>> {
    return withEnhancedErrorHandling(async () => {
      try {
        const response = await this.client.search(query);
        
        if (!response || !response.data) {
          throw this.createError(
            'Invalid response structure from MangaDex API',
            'searchManga',
            { query }
          );
        }
        
        // Process and validate results
        return createSuccessResult(processedResults);
      } catch (error) {
        // Error is automatically enhanced with operation context
        throw error;
      }
    }, {
      operation: 'searchManga',
      details: { query }
    });
  }
}
```

### API Client Implementation

```typescript
export class ComicVineClient extends ApiClient {
  private createError: ContextualErrorCreator;
  
  constructor(config: ClientConfig) {
    super(config);
    this.createError = createContextualErrorCreator({
      service: 'ComicVineClient'
    });
  }
  
  async search(query: string): Promise<AsyncResult<SearchResponse, Error>> {
    try {
      const response = await this.httpClient.get('/search', {
        params: { query }
      });
      
      if (!isSuccess(response)) {
        return createErrorResult(
          this.createError(
            `API request failed: ${isError(response) ? response.error.message : 'Unknown error'}`,
            'search',
            { query }
          )
        );
      }
      
      return createSuccessResult(response.data);
    } catch (error) {
      return createErrorResult(
        this.createError(
          `Failed to search: ${error instanceof Error ? error.message : String(error)}`,
          'search',
          { query }
        )
      );
    }
  }
}
```

## 5. Timeout Protection for Async Operations

### Basic Timeout Pattern

```typescript
async function fetchWithTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs = 30000
): Promise<AsyncResult<T, Error>> {
  try {
    // Create a timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
    );
    
    // Race between timeout and actual operation
    const result = await Promise.race([
      operation(),
      timeoutPromise
    ]);
    
    return createSuccessResult(result);
  } catch (error) {
    return createErrorResult(
      error instanceof Error ? error : new Error(`Operation failed: ${String(error)}`)
    );
  }
}

// Usage
const result = await fetchWithTimeout(
  () => api.fetchLargeDataset(),
  60000 // 60 second timeout
);
```

### Advanced Timeout with Cancellation

```typescript
async function fetchWithCancellation<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs = 30000
): Promise<AsyncResult<T, Error>> {
  // Create abort controller for cancellation
  const controller = new AbortController();
  const { signal } = controller;
  
  // Set up timeout
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const result = await operation(signal);
    clearTimeout(timeoutId);
    return createSuccessResult(result);
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error instanceof DOMException && error.name === 'AbortError') {
      return createErrorResult(
        new Error(`Operation timed out after ${timeoutMs}ms`)
      );
    }
    
    return createErrorResult(
      error instanceof Error ? error : new Error(`Operation failed: ${String(error)}`)
    );
  }
}

// Usage
const result = await fetchWithCancellation(
  (signal) => fetch('https://api.example.com/data', { signal }),
  5000 // 5 second timeout
);
```

## 6. React Component Integration

### Using AsyncResult in React Components

```typescript
import { useState, useEffect } from 'react';
import { AsyncResult, createLoadingResult, createErrorResult, createSuccessResult } from '../utils/async-result';
import { isLoading, isError, isSuccess } from '../utils/async-result';

function MangaDetails({ mangaId }: { mangaId: string }) {
  const [mangaResult, setMangaResult] = useState<AsyncResult<MangaEntity, Error>>(
    createLoadingResult()
  );
  
  useEffect(() => {
    async function fetchManga() {
      try {
        setMangaResult(createLoadingResult());
        const result = await mangaService.getManga(mangaId);
        setMangaResult(createSuccessResult(result));
      } catch (error) {
        setMangaResult(createErrorResult(
          error instanceof Error ? error : new Error(`Failed to fetch manga: ${String(error)}`)
        ));
      }
    }
    
    fetchManga();
  }, [mangaId]);
  
  // Render based on state
  if (isLoading(mangaResult)) {
    return <LoadingSpinner />;
  }
  
  if (isError(mangaResult)) {
    return <ErrorDisplay error={mangaResult.error} retry={() => fetchManga()} />;
  }
  
  if (isSuccess(mangaResult)) {
    const manga = mangaResult.data;
    return (
      <div>
        <h1>{manga.title}</h1>
        {/* Render manga details */}
      </div>
    );
  }
  
  return null;
}
```

### Error Boundary Integration

```typescript
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error to monitoring service
    console.error('Error caught by boundary:', error, errorInfo);
  }

  resetErrorBoundary = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    if (this.state.error) {
      if (typeof this.props.fallback === 'function') {
        return this.props.fallback(this.state.error, this.resetErrorBoundary);
      }
      
      return this.props.fallback || (
        <div className="error-container">
          <h2>Something went wrong</h2>
          <p>{this.state.error.message}</p>
          <button onClick={this.resetErrorBoundary}>Try Again</button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Usage
function App() {
  return (
    <ErrorBoundary
      fallback={(error, reset) => (
        <div className="error-page">
          <h1>Application Error</h1>
          <p>Message: {error.message}</p>
          <button onClick={reset}>Reset Application</button>
        </div>
      )}
    >
      <MainContent />
    </ErrorBoundary>
  );
}
```

## 7. Best Practices

### Error Type Refinement

```typescript
// Function to safely refine unknown errors
function refineError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  
  if (typeof error === 'string') {
    return new Error(error);
  }
  
  return new Error(`Unknown error: ${String(error)}`);
}

// Usage
try {
  // Operation that might throw
} catch (error) {
  const refinedError = refineError(error);
  return createErrorResult(refinedError);
}
```

### Custom Error Types

```typescript
// Define domain-specific error types
class NetworkError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message);
    this.name = 'NetworkError';
  }
}

class ValidationError extends Error {
  constructor(message: string, public fieldErrors?: Record<string, string[]>) {
    super(message);
    this.name = 'ValidationError';
  }
}

class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

// Type guard functions
function isNetworkError(error: unknown): error is NetworkError {
  return error instanceof Error && error.name === 'NetworkError';
}

function isValidationError(error: unknown): error is ValidationError {
  return error instanceof Error && error.name === 'ValidationError';
}

function isAuthenticationError(error: unknown): error is AuthenticationError {
  return error instanceof Error && error.name === 'AuthenticationError';
}

// Usage with discriminated handling
function handleError(error: Error): void {
  if (isNetworkError(error)) {
    // Handle network error with status code
    console.error(`Network error (${error.statusCode}): ${error.message}`);
  } else if (isValidationError(error)) {
    // Handle validation errors with field details
    console.error(`Validation error: ${error.message}`, error.fieldErrors);
  } else if (isAuthenticationError(error)) {
    // Handle auth errors
    console.error(`Authentication error: ${error.message}`);
    redirectToLogin();
  } else {
    // Handle other errors
    console.error(`Error: ${error.message}`);
  }
}
```

### Retry Pattern

```typescript
async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number;
    delayMs?: number;
    backoffFactor?: number;
    retryableErrors?: (error: Error) => boolean;
  } = {}
): Promise<AsyncResult<T, Error>> {
  const {
    maxRetries = 3,
    delayMs = 1000,
    backoffFactor = 2,
    retryableErrors = (error) => !(error instanceof ValidationError)
  } = options;
  
  let currentDelay = delayMs;
  let attempts = 0;
  
  while (attempts <= maxRetries) {
    try {
      const result = await operation();
      return createSuccessResult(result);
    } catch (error) {
      attempts++;
      
      const refinedError = error instanceof Error ? error : new Error(String(error));
      
      // If we've exceeded max retries or error isn't retryable, return error
      if (attempts > maxRetries || !retryableErrors(refinedError)) {
        return createErrorResult(refinedError);
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, currentDelay));
      
      // Increase delay for next attempt
      currentDelay *= backoffFactor;
    }
  }
  
  // This should never be reached, but TypeScript requires a return
  return createErrorResult(new Error('Maximum retries exceeded'));
}

// Usage
const result = await withRetry(
  () => apiClient.fetchData(),
  {
    maxRetries: 5,
    delayMs: 500,
    backoffFactor: 1.5,
    retryableErrors: (error) => error instanceof NetworkError && error.statusCode !== 404
  }
);
```

## 8. Migration from Old Patterns to New Patterns

### Old Pattern: Direct Exception Throwing

```typescript
// Old pattern - throws exceptions directly
async function fetchManga(id: string): Promise<MangaEntity> {
  try {
    const response = await fetch(`/api/manga/${id}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch manga: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching manga:', error);
    throw error; // Re-throwing without context
  }
}
```

### New Pattern: AsyncResult with Context

```typescript
// New pattern - returns AsyncResult with context
async function fetchManga(id: string): Promise<AsyncResult<MangaEntity, Error>> {
  return withEnhancedErrorHandling(async () => {
    try {
      const response = await fetch(`/api/manga/${id}`);
      
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }
      
      const data = await response.json();
      
      // Validate response data
      if (!data || typeof data !== 'object' || !('id' in data)) {
        throw new Error('Invalid response format');
      }
      
      return createSuccessResult(data as MangaEntity);
    } catch (error) {
      throw error; // Error will be enhanced by withEnhancedErrorHandling
    }
  }, {
    service: 'MangaService',
    operation: 'fetchManga',
    resourceType: 'manga',
    resourceId: id
  });
}
```

### Old Pattern: Swallowing Errors

```typescript
// Old pattern - swallowing errors with console.log
function handleSubmit() {
  try {
    // Form processing logic
  } catch (error) {
    console.log('Error in form submission:', error);
    // Error is swallowed, no user feedback
  }
}
```

### New Pattern: Proper Error Handling

```typescript
// New pattern - proper error handling with user feedback
function handleSubmit() {
  try {
    // Form processing logic
  } catch (error) {
    const refinedError = refineError(error);
    
    // Log with context
    console.error('Form submission error:', {
      message: refinedError.message,
      stack: refinedError.stack,
      formState: { /* relevant form state */ }
    });
    
    // Provide user feedback
    notifications.error({
      title: 'Form Submission Failed',
      message: 'Could not submit form. Please try again.'
    });
    
    // Track for analytics
    errorTracking.captureException(refinedError, {
      tags: { component: 'SubmissionForm' }
    });
  }
}
```

### Old Pattern: Any Types

```typescript
// Old pattern - using any types
function processApiResponse(data: any) {
  return {
    id: data.id,
    name: data.name,
    status: data.status || 'unknown'
  };
}
```

### New Pattern: Type Guards

```typescript
// New pattern - using type guards
interface ApiResponse {
  id: string;
  name: string;
  status?: string;
}

function isValidApiResponse(data: unknown): data is ApiResponse {
  if (!data || typeof data !== 'object') {
    return false;
  }
  
  const obj = data as Record<string, unknown>;
  
  return (
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    (obj.status === undefined || typeof obj.status === 'string')
  );
}

function processApiResponse(data: unknown): AsyncResult<ProcessedData, Error> {
  if (!isValidApiResponse(data)) {
    return createErrorResult(
      new Error('Invalid API response format')
    );
  }
  
  return createSuccessResult({
    id: data.id,
    name: data.name,
    status: data.status || 'unknown'
  });
}
```

## Conclusion

Implementing this comprehensive error handling approach ensures that:

1. Errors are properly typed, contextual, and informative
2. Operations fail gracefully with proper feedback
3. Debugging is easier with detailed error contexts
4. Error handling is consistent across the codebase
5. The application is more resilient against unexpected failures

By following these patterns, we create a more robust, maintainable, and user-friendly application that handles errors in a standardized way throughout the codebase.