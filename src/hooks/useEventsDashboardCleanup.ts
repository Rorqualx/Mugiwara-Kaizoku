/**
 * Events Dashboard Cleanup Hook
 * 
 * Provides comprehensive cleanup management for the Events Dashboard component
 * to prevent memory leaks and navigation issues.
 * 
 * @module hooks/useEventsDashboardCleanup
 */

import { useEffect, useRef } from 'react';

/**
 * Return type for useEventsDashboardCleanup hook
 */
export interface UseEventsDashboardCleanupReturn {
  registerCleanup: (cleanup: () => void) => void;
}

/**
 * Hook for managing cleanup functions in the Events Dashboard
 *
 * This hook ensures all cleanup functions are properly executed when
 * the component unmounts, preventing memory leaks and navigation freezes.
 *
 * @returns Object with registerCleanup function
 *
 * @example
 * ```tsx
 * const { registerCleanup } = useEventsDashboardCleanup();
 *
 * useEffect(() => {
 *   const timer = setInterval(() => {}, 1000);
 *   registerCleanup(() => clearInterval(timer));
 * }, []);
 * ```
 */
export function useEventsDashboardCleanup(): UseEventsDashboardCleanupReturn {
  const cleanupRef = useRef<(() => void)[]>([]);

  /**
   * Register a cleanup function to be called on unmount
   *
   * @param cleanup - Function to be called during cleanup
   */
  const registerCleanup = (cleanup: () => void): void => {
    cleanupRef.current.push(cleanup);
  };

  // Execute all cleanup functions on unmount
  useEffect(() => {
    return () => {
      cleanupRef.current.forEach((cleanup) => {
        try {
          cleanup();
        } catch (error: unknown) {
          console.error('[EventsDashboard] Cleanup error:', error);
        }
      });
      cleanupRef.current = [];
    };
  }, []);

  return { registerCleanup };
}