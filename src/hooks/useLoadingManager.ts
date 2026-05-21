/**
 * Loading State Manager Hook
 * 
 * This hook provides a consistent interface for managing loading states
 * across the application. It wraps the setLoading function from useUIStore
 * and provides helper methods for common loading state patterns.
 * 
 * @module hooks/useLoadingManager
 */

import { useCallback } from 'react';

import { useUIStore } from '../store';

/**
 * Return type for the useLoadingManager hook
 */
export interface UseLoadingManagerResult {
  /**
   * Set loading state for a specific key
   * @param key - Unique identifier for this loading state
   * @param isLoading - Whether loading is active
   */
  setLoading: (key: string, isLoading: boolean) => void;

  /**
   * Start loading for a specific key
   * @param key - Unique identifier for this loading state
   */
  startLoading: (key: string) => void;

  /**
   * Stop loading for a specific key
   * @param key - Unique identifier for this loading state
   */
  stopLoading: (key: string) => void;

  /**
   * Wrap an async function with loading state management
   * @param key - Unique identifier for this loading state
   * @param fn - Async function to wrap
   * @returns Wrapped function that manages loading state
   */
  withLoading: <T, Args extends unknown[]>(
  key: string,
  fn: (...args: Args) => Promise<T>)
  => (...args: Args) => Promise<T>;
}

/**
 * Hook for managing loading states consistently
 * 
 * Provides a unified interface for setting, starting, and stopping loading states,
 * as well as a utility to wrap async functions with loading state management.
 * 
 * @returns {UseLoadingManagerResult} Loading state management utilities
 * 
 * @example
 * ```tsx
 * const { startLoading, stopLoading, withLoading } = useLoadingManager();
 * 
 * // Manual loading management
 * const handleClick = async () => {
 *   startLoading('save-data');
 *   try {
 *     await saveData();
 *   } finally {
 *     stopLoading('save-data');
 *   }
 * };
 * 
 * // Automatic loading management with withLoading
 * const handleSubmit = withLoading('form-submit', async (formData) => {
 *   await submitForm(formData);
 *   return true;
 * });
 * ```
 */
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

  const withLoading = useCallback(<T, Args extends unknown[]>(
  key: string,
  fn: (...args: Args) => Promise<T>) =>
  {
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