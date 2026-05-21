/**
 * Async Loading State Hook
 * 
 * Centralized hook for managing loading states with error handling
 * to eliminate code duplication across components.
 * Replaces ~50+ instances of setIsLoading(true) try/finally patterns.
 */

import { useState, useCallback, useRef } from 'react';

import { getErrorMessage } from '../utils/errors/helpers';
import { showError } from '../utils/notifications/helpers';

/**
 * Options for useAsyncLoadingState hook
 */
export interface UseAsyncLoadingStateOptions {
  /**
   * Custom error handler
   */
  onError?: (error: unknown) => void;
  
  /**
   * Whether to show error notification automatically
   * @default true
   */
  showErrorNotification?: boolean;
  
  /**
   * Custom error notification title
   */
  errorNotificationTitle?: string;
  
  /**
   * Whether to reset error on next execution
   * @default true
   */
  resetErrorOnExecute?: boolean;
  
  /**
   * Initial loading state
   * @default false
   */
  initialLoading?: boolean;
}

/**
 * Return type for useAsyncLoadingState hook
 */
export interface UseAsyncLoadingStateReturn<T = unknown> {
  /**
   * Current loading state
   */
  isLoading: boolean;
  
  /**
   * Current error if any
   */
  error: Error | null;
  
  /**
   * Last successful result
   */
  data: T | undefined;
  
  /**
   * Execute an async operation with loading state management
   */
  execute: <R = T>(fn: () => Promise<R>) => Promise<R | undefined>;
  
  /**
   * Execute multiple operations in parallel
   */
  executeAll: <R = T>(fns: Array<() => Promise<R>>) => Promise<(R | undefined)[]>;
  
  /**
   * Reset state
   */
  reset: () => void;
  
  /**
   * Manually set loading state
   */
  setIsLoading: (loading: boolean) => void;
  
  /**
   * Manually set error
   */
  setError: (error: Error | null) => void;
  
  /**
   * Manually set data
   */
  setData: (data: T | undefined) => void;
}

/**
 * Hook for managing loading states with automatic error handling
 * 
 * @param options - Configuration options
 * @returns Loading state management utilities
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { isLoading, error, data, execute } = useAsyncLoadingState<User>();
 *   
 *   const loadUser = async () => {
 *     const user = await execute(() => fetchUser(userId));
 *     if (user) {
 *       logger.info('User loaded:', user);
 *     }
 *   };
 *   
 *   if (isLoading) return <Spinner />;
 *   if (error) return <ErrorMessage error={error} />;
 *   if (data) return <UserProfile user={data} />;
 * }
 * ```
 */
export function useAsyncLoadingState<T = unknown>(
  options: UseAsyncLoadingStateOptions = {}
): UseAsyncLoadingStateReturn<T> {
  const {
    onError,
    showErrorNotification = true,
    errorNotificationTitle,
    resetErrorOnExecute = true,
    initialLoading = false
  } = options;
  
  const [isLoading, setIsLoading] = useState(initialLoading);
  const [error, setError] = useState<Error | null>(null);
  const [data, setData] = useState<T | undefined>(undefined);
  
  // Use ref to track if component is still mounted
  const isMounted = useRef(true);
  
  // Cleanup on unmount
  useState(() => {
    return () => {
      isMounted.current = false;
    };
  });
  
  /**
   * Execute a single async operation
   */
  const execute = useCallback(async <R = T>(
    fn: () => Promise<R>
  ): Promise<R | undefined> => {
    // Reset error if configured
    if (resetErrorOnExecute && error) {
      setError(null);
    }
    
    setIsLoading(true);
    
    try {
      const result = await fn();

      // Only update state if component is still mounted
      if (isMounted.current) {
        setData(result as T);
        setError(null);
      }
      
      return result;
    } catch (err: unknown) {
      const errorObj = err instanceof Error 
        ? err 
        : new Error(getErrorMessage(err));
      
      // Only update state if component is still mounted
      if (isMounted.current) {
        setError(errorObj);
        
        // Call custom error handler
        if (onError) {
          onError(errorObj);
        }
        
        // Show error notification
        if (showErrorNotification) {
          showError(errorObj, errorNotificationTitle);
        }
      }
      
      return undefined;
    } finally {
      // Only update state if component is still mounted
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  }, [
    error, 
    resetErrorOnExecute, 
    onError, 
    showErrorNotification, 
    errorNotificationTitle
  ]);
  
  /**
   * Execute multiple operations in parallel
   */
  const executeAll = useCallback(async <R = T>(
    fns: Array<() => Promise<R>>
  ): Promise<(R | undefined)[]> => {
    // Reset error if configured
    if (resetErrorOnExecute && error) {
      setError(null);
    }
    
    setIsLoading(true);
    
    try {
      const results = await Promise.allSettled(fns.map(fn => fn()));
      
      const processedResults: (R | undefined)[] = [];
      let lastError: Error | null = null;
      
      for (const result of results) {
        if (result["status"] === 'fulfilled') {
          processedResults.push(result.value);
        } else {
          const errorObj = result.reason instanceof Error 
            ? result.reason 
            : new Error(getErrorMessage(result.reason));
          
          lastError = errorObj;
          processedResults.push(undefined);
          
          // Call error handler for each failed operation
          if (onError) {
            onError(errorObj);
          }
        }
      }
      
      // Update state with last error if any
      if (isMounted.current) {
        if (lastError) {
          setError(lastError);
          
          if (showErrorNotification) {
            showError(lastError, errorNotificationTitle);
          }
        } else {
          setError(null);
        }
      }
      
      return processedResults;
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  }, [
    error,
    resetErrorOnExecute,
    onError,
    showErrorNotification,
    errorNotificationTitle
  ]);
  
  /**
   * Reset all state
   */
  const reset = useCallback(() => {
    setIsLoading(false);
    setError(null);
    setData(undefined);
  }, []);
  
  return {
    isLoading,
    error,
    data,
    execute,
    executeAll,
    reset,
    setIsLoading,
    setError,
    setData
  };
}