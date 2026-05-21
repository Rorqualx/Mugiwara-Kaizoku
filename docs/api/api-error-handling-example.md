# Api Error Handling Example

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Api Error Handling Example

---
# Enhanced API Error Handling Examples

## Overview

This document provides examples of implementing the enhanced error handling utilities in API services and components. The examples demonstrate best practices for error handling across different layers of the application.

## Service Layer Example

```typescript
// src/api/exampleService.ts

import { 
  AsyncResult, 
  createSuccessResult, 
  createErrorResult 
} from '../utils/async-result';
import {
  AppError,
  ValidationError,
  NotFoundError,
  createContextualErrorCreator,
  isValidResponse,
  validateArrayItems,
  createResponseValidator
} from '../utils/error-handling';

// Define service-specific error context
const errorCreator = createContextualErrorCreator({
  service: 'ExampleService',
  resourceType: 'Example'
});

// Define response types with proper typing
interface ExampleResponseItem {
  id: string;
  name: string;
  status: 'active' | 'inactive';
}

interface ExampleResponse {
  items: ExampleResponseItem[];
  totalCount: number;
}

// Type guard for ExampleResponseItem
function isExampleResponseItem(item: unknown): item is ExampleResponseItem {
  if (!item || typeof item !== 'object') return false;
  
  const obj = item as Record<string, unknown>;
  return (
    typeof obj.id === 'string' && 
    typeof obj.name === 'string' &&
    (obj.status === 'active' || obj.status === 'inactive')
  );
}

// Response validator for ExampleResponse
const validateExampleResponse = createResponseValidator<ExampleResponse>(
  ['items', 'totalCount'],
  response => ({
    ...response,
    // Ensure items are properly typed
    items: Array.isArray(response.items)
      ? response.items.filter(isExampleResponseItem)
      : []
  })
);

export class ExampleService {
  // Base URL for API requests
  private baseUrl: string;
  
  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }
  
  /**
   * Get a list of examples with consistent error handling
   */
  async getExamples(): Promise<AsyncResult<ExampleResponseItem[], Error>> {
    return errorCreator.withAsyncResultErrorHandling(
      async () => {
        try {
          // Make API request
          const response = await fetch(`${this.baseUrl}/examples`);
          
          if (!response.ok) {
            throw errorCreator.createApiError(
              `Failed to fetch examples: ${response.statusText}`,
              response.status
            );
          }
          
          const data = await response.json();
          
          // Validate response format
          const validationResult = validateExampleResponse(data);
          
          if (validationResult.status === 'error') {
            throw validationResult.error;
          }
          
          return validationResult.data.items;
        } catch (error) {
          // This error will be handled by withAsyncResultErrorHandling
          throw error;
        }
      },
      'getExamples'
    );
  }
  
  /**
   * Get a specific example by ID
   */
  async getExampleById(id: string): Promise<AsyncResult<ExampleResponseItem, Error>> {
    return errorCreator.withAsyncResultErrorHandling(
      async () => {
        try {
          // Make API request
          const response = await fetch(`${this.baseUrl}/examples/${id}`);
          
          if (response.status === 404) {
            throw errorCreator.createNotFoundError(id);
          }
          
          if (!response.ok) {
            throw errorCreator.createApiError(
              `Failed to fetch example: ${response.statusText}`,
              response.status
            );
          }
          
          const data = await response.json();
          
          // Validate item format
          if (!isExampleResponseItem(data)) {
            throw errorCreator.createValidationError(
              'Invalid example data format',
              { format: ['Response does not match expected schema'] }
            );
          }
          
          return data;
        } catch (error) {
          // This error will be handled by withAsyncResultErrorHandling
          throw error;
        }
      },
      'getExampleById',
      { resourceId: id }
    );
  }
  
  /**
   * Create a new example
   */
  async createExample(data: Omit<ExampleResponseItem, 'id'>): Promise<AsyncResult<ExampleResponseItem, Error>> {
    return errorCreator.withAsyncResultErrorHandling(
      async () => {
        try {
          // Validate input
          if (!data.name) {
            throw errorCreator.createValidationError(
              'Invalid example data',
              { name: ['Name is required'] }
            );
          }
          
          // Make API request
          const response = await fetch(`${this.baseUrl}/examples`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          });
          
          if (!response.ok) {
            throw errorCreator.createApiError(
              `Failed to create example: ${response.statusText}`,
              response.status
            );
          }
          
          const responseData = await response.json();
          
          // Validate response format
          if (!isExampleResponseItem(responseData)) {
            throw errorCreator.createValidationError(
              'Invalid response data format',
              { format: ['Response does not match expected schema'] }
            );
          }
          
          return responseData;
        } catch (error) {
          // This error will be handled by withAsyncResultErrorHandling
          throw error;
        }
      },
      'createExample'
    );
  }
}
```

## React Component Example

```tsx
// src/components/ExampleComponent.tsx

import React, { useState, useEffect } from 'react';
import { ExampleService } from '../api/exampleService';
import { isSuccess, isError, isLoading, isIdle } from '../utils/async-result';
import { AppError, isNotFoundError, isValidationError } from '../utils/error-handling';

// Component props with proper typing
interface ExampleComponentProps {
  exampleId?: string;
  onError?: (error: Error) => void;
}

// Example component that handles API errors properly
export function ExampleComponent({ exampleId, onError }: ExampleComponentProps) {
  // Service instance
  const service = new ExampleService('/api');
  
  // State with proper AsyncResult typing
  const [exampleData, setExampleData] = useState<AsyncResult<ExampleResponseItem, Error>>(
    createIdleResult()
  );
  
  // Fetch data with proper error handling
  useEffect(() => {
    if (!exampleId) return;
    
    async function fetchData() {
      // Set loading state
      setExampleData(createLoadingResult());
      
      // Fetch data with AsyncResult error handling
      const result = await service.getExampleById(exampleId);
      
      // Update state with result (success or error)
      setExampleData(result);
      
      // Call onError callback if error
      if (isError(result) && onError) {
        onError(result.error);
      }
    }
    
    fetchData();
  }, [exampleId, onError]);
  
  // Render based on AsyncResult state
  if (isIdle(exampleData)) {
    return <div>Enter an example ID to load data</div>;
  }
  
  if (isLoading(exampleData)) {
    return <div>Loading example data...</div>;
  }
  
  if (isError(exampleData)) {
    // Specialized error handling based on error type
    if (isNotFoundError(exampleData.error)) {
      return <div>Example with ID {exampleId} not found</div>;
    }
    
    if (isValidationError(exampleData.error)) {
      return (
        <div>
          <p>Validation Error: {exampleData.error.message}</p>
          <ul>
            {Object.entries(exampleData.error.errors).map(([field, messages]) => (
              <li key={field}>
                {field}: {messages.join(', ')}
              </li>
            ))}
          </ul>
        </div>
      );
    }
    
    // Generic error handling
    return <div>Error: {exampleData.error.message}</div>;
  }
  
  // Success state
  return (
    <div>
      <h2>{exampleData.data.name}</h2>
      <p>Status: {exampleData.data.status}</p>
    </div>
  );
}
```

## Error Boundary Component

```tsx
// src/components/ErrorBoundary.tsx

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AppError, isApiError } from '../utils/error-handling';

interface ErrorBoundaryProps {
  fallback?: ReactNode | ((error: Error) => ReactNode);
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error or call reporting service
    console.error('Error caught by ErrorBoundary:', error, errorInfo);
    
    // Call onError callback if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      // Render fallback UI if provided
      if (this.props.fallback) {
        if (typeof this.props.fallback === 'function' && this.state.error) {
          return this.props.fallback(this.state.error);
        }
        return this.props.fallback;
      }
      
      // Default error UI with specialized handling for different error types
      const error = this.state.error;
      
      if (error instanceof AppError) {
        // Show context information for AppError
        return (
          <div className="error-boundary">
            <h2>An error occurred</h2>
            <p>{error.message}</p>
            <details>
              <summary>Error details</summary>
              <pre>{JSON.stringify(error.context, null, 2)}</pre>
            </details>
          </div>
        );
      }
      
      if (isApiError(error)) {
        // Show status code for ApiError
        return (
          <div className="error-boundary">
            <h2>API Error: {error.statusCode}</h2>
            <p>{error.message}</p>
          </div>
        );
      }
      
      // Generic error display
      return (
        <div className="error-boundary">
          <h2>Something went wrong</h2>
          <p>{error?.message || 'Unknown error'}</p>
        </div>
      );
    }

    return this.props.children;
  }
}
```

## Best Practices

1. **Use AsyncResult Pattern**: Always return `AsyncResult<T, Error>` from asynchronous operations.
2. **Create Contextual Errors**: Use `createContextualErrorCreator` to create service-specific errors.
3. **Type Guards**: Implement type guards for response validation.
4. **Specialized Error Types**: Use specialized error types like `ValidationError` and `NotFoundError`.
5. **Consistent Error Handling**: Use `withAsyncResultErrorHandling` to wrap operations.
6. **Response Validation**: Use `isValidResponse` and `validateArrayItems` to validate API responses.
7. **Proper Error State Handling**: Check all states with `isSuccess`, `isError`, `isLoading`, and `isIdle`.
8. **Specialized UI for Error Types**: Show different UI based on error types.

By following these patterns, you'll have consistent, type-safe error handling throughout the application.