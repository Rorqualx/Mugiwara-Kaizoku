/**
 * useImageRetry Hook
 *
 * Provides automatic retry with exponential backoff for image loading.
 * Appends a cache-busting query parameter on each retry attempt.
 */

import { useState, useCallback, useRef, useEffect } from 'react';

interface UseImageRetryOptions {
  /** Original image source URL */
  src: string | null;
  /** Maximum automatic retry attempts before showing error */
  maxRetries?: number;
  /** Base delay in milliseconds (doubled each retry) */
  baseDelay?: number;
}

interface UseImageRetryReturn {
  /** The current source URL (with cache-bust param on retries) */
  currentSrc: string | null;
  /** Whether auto-retry is in progress */
  isRetrying: boolean;
  /** Whether all retries are exhausted */
  hasFailed: boolean;
  /** Current retry attempt number (0 = first load) */
  retryCount: number;
  /** Called on image error — triggers auto-retry or sets hasFailed */
  handleError: () => void;
  /** Manual retry — resets count and tries again */
  manualRetry: () => void;
}

export function useImageRetry({
  src,
  maxRetries = 3,
  baseDelay = 1000,
}: UseImageRetryOptions): UseImageRetryReturn {
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset state when src changes
  useEffect(() => {
    setRetryCount(0);
    setIsRetrying(false);
    setHasFailed(false);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, [src]);

  // Cleanup timer on unmount
  useEffect(() => {
    return (): void => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handleError = useCallback((): void => {
    if (retryCount < maxRetries) {
      setIsRetrying(true);
      const delay = baseDelay * Math.pow(2, retryCount);
      timerRef.current = setTimeout(() => {
        setRetryCount(prev => prev + 1);
        setIsRetrying(false);
        timerRef.current = null;
      }, delay);
    } else {
      setHasFailed(true);
      setIsRetrying(false);
    }
  }, [retryCount, maxRetries, baseDelay]);

  const manualRetry = useCallback((): void => {
    setRetryCount(0);
    setHasFailed(false);
    setIsRetrying(false);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    // Trigger a fresh attempt by setting count to 1 after reset
    setRetryCount(1);
  }, []);

  // Build cache-busted src
  const currentSrc = src && retryCount > 0
    ? `${src}${src.includes('?') ? '&' : '?'}retry=${retryCount}`
    : src;

  return {
    currentSrc,
    isRetrying,
    hasFailed,
    retryCount,
    handleError,
    manualRetry,
  };
}
