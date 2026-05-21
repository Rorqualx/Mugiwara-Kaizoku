/**
 * useAsyncState Hook
 * 
 * STANDARD: This is the REQUIRED hook for ALL async operations in Mugiwara-Kaizoku.
 * Provides consistent state management with automatic cleanup and cancellation.
 * 
 * @see /docs/development/STATE_MANAGEMENT_STANDARD.md
 */

import { useState, useEffect, useRef, useCallback } from 'react';
export interface AsyncState<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
}
export interface UseAsyncStateOptions {
  /**
   * Whether to execute immediately on mount
   * @default true
   */
  immediate?: boolean;

  /**
   * Retry count on failure
   * @default 0
   */
  retryCount?: number;

  /**
   * Retry delay in milliseconds
   * @default 1000
   */
  retryDelay?: number;

  /**
   * Cache key for result caching
   */
  cacheKey?: string;

  /**
   * Cache time in milliseconds
   * @default 5 * 60 * 1000 (5 minutes)
   */
  cacheTime?: number;
}

// Simple in-memory cache
const cache = new Map<string, {
  data: unknown;
  timestamp: number;
}>();
export function useAsyncState<T>(asyncFn: (signal: AbortSignal) => Promise<T>, deps: React.DependencyList = [], options: UseAsyncStateOptions = {}): AsyncState<T> & {
  refetch: () => Promise<void>;
  reset: () => void;
} {
  const {
    immediate = true,
    retryCount = 0,
    retryDelay = 1000,
    cacheKey,
    cacheTime = 5 * 60 * 1000
  } = options;
  const [state, setState] = useState<AsyncState<T>>(() => {
    // Check cache on initial load
    if (cacheKey) {
      const cached = cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < cacheTime) {
        return {
          data: cached.data as T,
          isLoading: false,
          error: null
        };
      }
    }
    return {
      data: null,
      isLoading: immediate,
      error: null
    };
  });
  const abortControllerRef = useRef<AbortController | undefined>(undefined);
  const retryCountRef = useRef(0);
  const mountedRef = useRef(true);
  const execute = useCallback(async () => {
    // Check cache first
    if (cacheKey) {
      const cached = cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < cacheTime) {
        setState({
          data: cached.data as T,
          isLoading: false,
          error: null
        });
        return;
      }
    }

    // Cancel any existing request
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    // Reset retry count
    retryCountRef.current = 0;

    // Set loading state
    setState((prev: AsyncState<T>) => ({
      ...prev,
      isLoading: true,
      error: null
    }));
    async function attemptFetch(): Promise<void> {
      try {
        const controller = abortControllerRef.current;
        if (!controller) {
          throw new Error('AbortController not initialized');
        }
        const data = await asyncFn(controller.signal);

        // Only update state if component is still mounted
        if (mountedRef.current) {
          setState({
            data,
            isLoading: false,
            error: null
          });

          // Cache successful result
          if (cacheKey) {
            cache.set(cacheKey, {
              data,
              timestamp: Date.now()
            });
          }
        }
      } catch (error: unknown) {
        // Ignore abort errors
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }

        // Retry logic
        if (retryCountRef.current < retryCount) {
          retryCountRef.current++;
          await new Promise<void>((resolve) => {
            setTimeout(() => {
              resolve();
            }, retryDelay);
          });

          // Only retry if not aborted and still mounted
          if (!abortControllerRef.current?.signal.aborted && mountedRef.current) {
            return attemptFetch();
          }
        }

        // Set error state if still mounted
        if (mountedRef.current) {
          setState({
            data: null,
            isLoading: false,
            error: error instanceof Error ? error : new Error(String(error))
          });
        }
      }
    }
    await attemptFetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps is intentionally spread to allow custom dependencies
  }, [asyncFn, cacheKey, cacheTime, retryCount, retryDelay, ...deps]);
  const reset = useCallback(() => {
    // Cancel any pending request
    abortControllerRef.current?.abort();

    // Clear cache if exists
    if (cacheKey) {
      cache.delete(cacheKey);
    }

    // Reset state
    setState({
      data: null,
      isLoading: false,
      error: null
    });
  }, [cacheKey]);
  useEffect(() => {
    mountedRef.current = true;
    if (immediate) {
      void execute();
    }

    // Cleanup function
    return () => {
      mountedRef.current = false;
      abortControllerRef.current?.abort();
    };
  }, [execute, immediate]);
  return {
    ...state,
    refetch: execute,
    reset
  };
}

/**
 * Clear the entire cache or specific keys
 */
export function clearAsyncStateCache(key?: string): void {
  if (key) {
    cache.delete(key);
  } else {
    cache.clear();
  }
}