/**
 * useScrapingProgress Hook
 *
 * Custom React hook for tracking ComicVine scraping progress with time estimation.
 * Provides real-time progress updates, speed calculation, and ETA estimation.
 *
 * @module components/addManga/steps/wizard/volumes-chapters/hooks/useScrapingProgress
 */

import { useCallback, useState } from 'react';

import type { ScrapingProgress } from '../types';

// ============================================================================
// Types
// ============================================================================

/** Return value from the useScrapingProgress hook */
export interface UseScrapingProgressReturn {
  progress: ScrapingProgress;
  startProgress: (operation: string, total: number) => void;
  updateProgress: (current: number) => void;
  completeProgress: () => void;
  errorProgress: (errorMessage?: string) => void;
  resetProgress: () => void;
}

// ============================================================================
// Constants
// ============================================================================

/** Initial/idle progress state */
const INITIAL_PROGRESS: ScrapingProgress = {
  status: 'idle',
  operation: '',
  current: 0,
  total: 0,
  startTime: 0,
  itemsPerSecond: 0,
  estimatedTimeRemaining: 0,
};

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Custom hook for tracking scraping progress with time estimation
 *
 * @returns Progress state and control functions
 *
 * @example
 * ```tsx
 * const { progress, startProgress, updateProgress, completeProgress } = useScrapingProgress();
 *
 * // Start tracking
 * startProgress('Scraping ComicVine Volumes', 15);
 *
 * // Update as items are processed
 * updateProgress(1);
 * updateProgress(2);
 * // ...
 *
 * // Mark complete
 * completeProgress();
 * ```
 */
export function useScrapingProgress(): UseScrapingProgressReturn {
  const [progress, setProgress] = useState<ScrapingProgress>(INITIAL_PROGRESS);

  /**
   * Start tracking progress for a new operation
   */
  const startProgress = useCallback((operation: string, total: number): void => {
    setProgress({
      status: 'scraping',
      operation,
      current: 0,
      total,
      startTime: Date.now(),
      itemsPerSecond: 0,
      estimatedTimeRemaining: 0,
    });
  }, []);

  /**
   * Update progress with current item count
   * Automatically calculates speed and ETA
   */
  const updateProgress = useCallback((current: number): void => {
    setProgress((prev) => {
      if (prev.status !== 'scraping') return prev;

      const elapsed = (Date.now() - prev.startTime) / 1000;
      const itemsPerSecond = current > 0 && elapsed > 0 ? current / elapsed : 0;
      const remaining = prev.total - current;
      const estimatedTimeRemaining = itemsPerSecond > 0 ? remaining / itemsPerSecond : 0;

      return {
        ...prev,
        current,
        itemsPerSecond,
        estimatedTimeRemaining,
      };
    });
  }, []);

  /**
   * Mark the operation as complete
   */
  const completeProgress = useCallback((): void => {
    setProgress((prev) => ({
      ...prev,
      status: 'complete',
      current: prev.total,
      estimatedTimeRemaining: 0,
    }));

    // Auto-reset after brief delay to show completion
    setTimeout(() => {
      setProgress(INITIAL_PROGRESS);
    }, 2000);
  }, []);

  /**
   * Mark the operation as failed
   */
  const errorProgress = useCallback((_errorMessage?: string): void => {
    setProgress((prev) => ({
      ...prev,
      status: 'error',
    }));

    // Auto-reset after showing error
    setTimeout(() => {
      setProgress(INITIAL_PROGRESS);
    }, 5000);
  }, []);

  /**
   * Reset to initial idle state
   */
  const resetProgress = useCallback((): void => {
    setProgress(INITIAL_PROGRESS);
  }, []);

  return {
    progress,
    startProgress,
    updateProgress,
    completeProgress,
    errorProgress,
    resetProgress,
  };
}
