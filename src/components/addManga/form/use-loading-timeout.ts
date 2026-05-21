/**
 * Loading Timeout Hook
 *
 * Provides safety timeout to prevent loading state from getting stuck.
 * Automatically resets loading state after specified timeout period.
 *
 * @param isLoading - Current loading state
 * @param onTimeout - Callback when timeout occurs
 * @param timeoutMs - Timeout duration in milliseconds (default 15000)
 *
 * @example
 * ```tsx
 * const [isLoading, setIsLoading] = useState(false);
 * const [error, setError] = useState<string | null>(null);
 *
 * useLoadingTimeout(isLoading, () => {
 *   setIsLoading(false);
 *   setError('Operation timed out');
 * }, 15000);
 * ```
 */
import { useEffect, useRef } from 'react';

import { logger } from '@/utils/logger';

export function useLoadingTimeout(
  isLoading: boolean,
  onTimeout: () => void,
  timeoutMs: number = 15000
): void {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // Set new timeout if loading
    if (isLoading) {
      timeoutRef.current = setTimeout(() => {
        logger.warn('Loading timeout reached, resetting loading state');
        onTimeout();
      }, timeoutMs);
    }

    // Cleanup on unmount
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isLoading, onTimeout, timeoutMs]);
}
