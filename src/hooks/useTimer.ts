/**
 * Safe Timer Hook
 *
 * Provides memory-safe timer functions that automatically clean up
 * when components unmount, preventing memory leaks.
 */

import { useEffect, useRef, useCallback } from 'react';

interface TimerOptions {
  immediate?: boolean;
  autoClean?: boolean;
}

/**
 * Hook for safe setTimeout usage
 * Automatically cleans up timer on unmount
 */
export function useTimeout(
  callback: () => void,
  delay: number | null,
  _options: TimerOptions = {}
): { clear: () => void; ref: React.MutableRefObject<NodeJS.Timeout | undefined> } {
  const savedCallback = useRef(callback);
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Update callback ref when it changes
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the timeout
  useEffect(() => {
    if (delay === null) {
      return;
    }

    const tick = (): void => savedCallback.current();

    timeoutRef.current = setTimeout(tick, delay);

    // Cleanup
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [delay]);

  // Manual clear function
  const clear = useCallback((): void => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
    }
  }, []);

  return { clear, ref: timeoutRef };
}

/**
 * Hook for safe setInterval usage
 * Automatically cleans up interval on unmount
 */
export function useInterval(
  callback: () => void,
  delay: number | null,
  options: TimerOptions = {}
): { clear: () => void; restart: () => void; ref: React.MutableRefObject<NodeJS.Timeout | undefined> } {
  const savedCallback = useRef(callback);
  const intervalRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Update callback ref when it changes
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the interval
  useEffect(() => {
    if (delay === null) {
      return;
    }

    const tick = (): void => savedCallback.current();

    if (options.immediate) {
      tick();
    }

    intervalRef.current = setInterval(tick, delay);

    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [delay, options.immediate]);

  // Manual control functions
  const clear = useCallback((): void => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = undefined;
    }
  }, []);

  const restart = useCallback((): void => {
    clear();
    if (delay !== null) {
      const tick = (): void => savedCallback.current();
      intervalRef.current = setInterval(tick, delay);
    }
  }, [clear, delay]);

  return { clear, restart, ref: intervalRef };
}

/**
 * Hook for debounced callbacks
 * Automatically cleans up timers on unmount
 */
export function useDebounce<T extends (...args: unknown[]) => void>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const callbackRef = useRef(callback);

  // Update callback ref
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return useCallback((...args: Parameters<T>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      callbackRef.current(...args);
    }, delay);
  }, [delay]) as T;
}

/**
 * Hook for throttled callbacks
 * Automatically cleans up timers on unmount
 */
export function useThrottle<T extends (...args: unknown[]) => void>(
  callback: T,
  delay: number
): T {
  const lastRun = useRef(Date.now());
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const callbackRef = useRef(callback);

  // Update callback ref
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return useCallback((...args: Parameters<T>) => {
    const now = Date.now();
    const timeSinceLastRun = now - lastRun.current;

    if (timeSinceLastRun >= delay) {
      lastRun.current = now;
      callbackRef.current(...args);
    } else {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        lastRun.current = Date.now();
        callbackRef.current(...args);
      }, delay - timeSinceLastRun);
    }
  }, [delay]) as T;
}

/**
 * Hook for animation frame management
 * Automatically cancels on unmount
 */
export function useAnimationFrame(
  callback: (deltaTime: number) => void,
  isActive = true
): void {
  const requestRef = useRef<number | undefined>(undefined);
  const previousTimeRef = useRef<number | undefined>(undefined);
  const callbackRef = useRef(callback);

  // Update callback ref
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    const animate = (time: number): void => {
      if (previousTimeRef.current !== undefined) {
        const deltaTime = time - previousTimeRef.current;
        callbackRef.current(deltaTime);
      }
      previousTimeRef.current = time;
      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [isActive]);
}

export default {
  useTimeout,
  useInterval,
  useDebounce,
  useThrottle,
  useAnimationFrame
};
