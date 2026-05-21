/**
 * Error Handling Examples with AsyncResult Pattern
 * 
 * This file demonstrates the recommended patterns for error handling using AsyncResult
 * in the Mugiwara-Kaizoku codebase.
 */

import { 
  AsyncResult, 
  createSuccessResult, 
  createErrorResult,
  isSuccess,
  isError,
  unwrapOr,
  withEnhancedErrorHandling,
  createContextualError,
  createContextualErrorCreator
} from '../../utils/async-result';

/**
 * Example 1: Basic AsyncResult Error Handling
 * 
 * Demonstrates the basic pattern for handling errors with AsyncResult.
 */
async function fetchDataBasic(url: string): Promise<AsyncResult<unknown, Error>> {
  try {
    // Simulate API call
    const response = await fetch(url);
    
    // Check response status
    if (!response.ok) {
      return createErrorResult(
        new Error(`API request failed with status ${response.status}: ${response.statusText}`)
      );
    }
    
    // Try to parse response
    try {
      const data = await response.json();
      return createSuccessResult(data);
    } catch (parseError) {
      return createErrorResult(
        new Error(`Failed to parse response: ${parseError instanceof Error ? parseError.message : String(parseError)}`)
      );
    }
  } catch (error) {
    // Convert any error to a proper Error instance with descriptive message
    return createErrorResult(
      error instanceof Error 
        ? error 
        : new Error(`Failed to fetch data: ${String(error)}`)
    );
  }
}

/**
 * Example 2: Comprehensive Error Handling with Context
 * 
 * Demonstrates adding context to errors for better debugging.
 */
async function fetchDataWithContext(
  url: string, 
  resourceId: string,
  operationName: string
): Promise<AsyncResult<unknown, Error>> {
  try {
    // Create a base error message template with context
    const errorContext = {
      resourceId,
      operation: operationName,
      timestamp: new Date().toISOString()
    };
    
    // Simulate API call
    const response = await fetch(url);
    
    // Check response status with detailed error
    if (!response.ok) {
      const contextualError = createContextualError(
        `API request failed with status ${response.status}: ${response.statusText}`,
        'API_ERROR',
        errorContext
      );
      return createErrorResult(contextualError);
    }
    
    // Try to parse response
    try {
      const data = await response.json();
      return createSuccessResult(data);
    } catch (parseError) {
      const contextualError = createContextualError(
        `Failed to parse response: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
        'PARSE_ERROR',
        errorContext,
        parseError instanceof Error ? parseError : undefined
      );
      return createErrorResult(contextualError);
    }
  } catch (error) {
    // Create contextual error with original error as cause
    const contextualError = createContextualError(
      `Failed to fetch data: ${error instanceof Error ? error.message : String(error)}`,
      'NETWORK_ERROR',
      errorContext,
      error instanceof Error ? error : undefined
    );
    return createErrorResult(contextualError);
  }
}

/**
 * Example 3: Using Enhanced Error Handling Utility
 * 
 * Demonstrates using the withEnhancedErrorHandling utility for cleaner code.
 */
async function fetchDataEnhanced(
  url: string,
  resourceId: string
): Promise<AsyncResult<unknown, Error>> {
  return withEnhancedErrorHandling(async () => {
    // Simulate API call
    const response = await fetch(url);
    
    // Check response status
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}: ${response.statusText}`);
    }
    
    // Parse response
    const data = await response.json();
    return createSuccessResult(data);
  }, {
    resourceId,
    operation: 'fetchData',
    url
  });
}

/**
 * Example 4: Service-specific Error Creator
 * 
 * Demonstrates creating a service-specific error creator for consistent errors.
 */
class ApiService {
  private createApiError: ReturnType<typeof createContextualErrorCreator>;
  
  constructor(serviceName: string) {
    // Create a service-specific error creator
    this.createApiError = createContextualErrorCreator({
      service: serviceName,
      version: '1.0.0'
    });
  }
  
  /**
   * Fetch data from API with consistent error handling
   */
  async fetchData(
    url: string,
    resourceId: string
  ): Promise<AsyncResult<unknown, Error>> {
    try {
      // Simulate API call
      const response = await fetch(url);
      
      // Check response status
      if (!response.ok) {
        return createErrorResult(
          this.createApiError(
            `API request failed with status ${response.status}: ${response.statusText}`,
            'API_ERROR',
            { resourceId, url }
          )
        );
      }
      
      // Parse response
      const data = await response.json();
      return createSuccessResult(data);
    } catch (error) {
      return createErrorResult(
        this.createApiError(
          `Failed to fetch data: ${error instanceof Error ? error.message : String(error)}`,
          'NETWORK_ERROR',
          { resourceId, url },
          error instanceof Error ? error : undefined
        )
      );
    }
  }
}

/**
 * Example 5: Timeout Protection for AsyncResult
 * 
 * Demonstrates adding timeout protection to async operations.
 */
async function fetchWithTimeout<T>(
  url: string,
  timeoutMs: number = 5000
): Promise<AsyncResult<T, Error>> {
  try {
    // Create a timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Request timed out after ${timeoutMs}ms`)), timeoutMs);
    });
    
    // Race between the fetch and the timeout
    const response = await Promise.race([
      fetch(url),
      timeoutPromise
    ]) as Response;
    
    // Check response status
    if (!response.ok) {
      return createErrorResult(
        new Error(`API request failed with status ${response.status}: ${response.statusText}`)
      );
    }
    
    // Parse response
    const data = await response.json();
    return createSuccessResult(data as T);
  } catch (error) {
    return createErrorResult(
      error instanceof Error
        ? error
        : new Error(`Failed to fetch data: ${String(error)}`)
    );
  }
}

/**
 * Example 6: Using AsyncResult in Component Logic
 * 
 * Demonstrates proper handling of AsyncResult in UI components.
 */
function handleComponentData<T>(result: AsyncResult<T, Error>, defaultValue: T): {
  data: T;
  isLoading: boolean;
  error?: string;
} {
  // Always provide a default value to ensure data is available
  const data = unwrapOr(result, defaultValue);
  
  // Set loading state based on result
  const isLoading = result.status === 'loading';
  
  // Extract error message if present
  const error = isError(result) ? result.error.message : undefined;
  
  return { data, isLoading, error };
}

/**
 * Example 7: Using AsyncResult in Data Fetching Hook
 * 
 * Demonstrates implementing a data fetching hook with proper error handling.
 */
function useData<T>(
  fetchFn: () => Promise<AsyncResult<T, Error>>,
  defaultValue: T
): {
  data: T;
  isLoading: boolean;
  error?: string;
  refetch: () => Promise<void>;
} {
  // Use state to track the async result
  const [result, setResult] = useState<AsyncResult<T, Error>>(createLoadingResult());
  
  // Function to fetch data
  const fetchData = async () => {
    try {
      setResult(createLoadingResult());
      const response = await fetchFn();
      setResult(response);
    } catch (error) {
      setResult(createErrorResult(
        error instanceof Error ? error : new Error(String(error))
      ));
    }
  };
  
  // Fetch data on mount
  useEffect(() => {
    fetchData();
  }, []);
  
  // Return hook interface
  return {
    data: unwrapOr(result, defaultValue),
    isLoading: result.status === 'loading',
    error: isError(result) ? result.error.message : undefined,
    refetch: fetchData
  };
}

// Placeholder to prevent errors in the example
function useState<T>(initialValue?: T): [T, (value: T) => void] {
  return [initialValue as T, () => {}];
}

// Placeholder to prevent errors in the example
function useEffect(fn: () => void, deps: any[]): void {}