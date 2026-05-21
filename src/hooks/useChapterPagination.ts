/**
 * Hook for managing chapter pagination and virtual scrolling
 *
 * Handles large manga with 1000+ chapters efficiently by:
 * - Configurable chapter fetch limits
 * - Lazy loading with pagination
 * - Virtual scrolling support
 *
 * @module hooks/useChapterPagination
 */

import { useState, useCallback, useMemo } from 'react';

/**
 * Configuration for chapter pagination
 */
export interface ChapterPaginationConfig {
  /** Initial number of chapters to fetch (default: 500) */
  initialLimit?: number;
  /** Number of chapters to load per page (default: 200) */
  pageSize?: number;
  /** Enable automatic loading when scrolling (default: false) */
  autoLoad?: boolean;
}

/**
 * Hook for paginated chapter loading
 *
 * @param mangaId - ID of the manga
 * @param totalChapters - Total number of chapters (from metadata)
 * @param config - Pagination configuration
 * @returns Pagination state and controls
 */
export function useChapterPagination(
  mangaId: number,
  totalChapters: number,
  config: ChapterPaginationConfig = {}
): {
  currentLimit: number;
  needsPagination: boolean;
  hasMore: boolean;
  loadedPercentage: number;
  loadedCount: number;
  totalCount: number;
  remainingCount: number;
  loadMore: () => void;
  loadAll: () => void;
  reset: () => void;
  autoLoad: boolean;
} {
  const {
    initialLimit = 500,
    pageSize = 200,
    autoLoad = false
  } = config;

  const [currentLimit, setCurrentLimit] = useState(initialLimit);

  // Calculate if we need pagination
  const needsPagination = totalChapters > initialLimit;
  const hasMore = currentLimit < totalChapters;
  const loadedPercentage = Math.min((currentLimit / totalChapters) * 100, 100);

  /**
   * Load next page of chapters
   */
  const loadMore = useCallback(() => {
    if (hasMore) {
      setCurrentLimit(prev => Math.min(prev + pageSize, totalChapters));
    }
  }, [hasMore, pageSize, totalChapters]);

  /**
   * Load all remaining chapters
   */
  const loadAll = useCallback(() => {
    setCurrentLimit(totalChapters);
  }, [totalChapters]);

  /**
   * Reset to initial limit
   */
  const reset = useCallback(() => {
    setCurrentLimit(initialLimit);
  }, [initialLimit]);

  return {
    currentLimit,
    needsPagination,
    hasMore,
    loadedPercentage,
    loadedCount: currentLimit,
    totalCount: totalChapters,
    remainingCount: totalChapters - currentLimit,
    loadMore,
    loadAll,
    reset,
    autoLoad
  };
}

/**
 * Hook for virtual scrolling chapter list
 *
 * @param chapters - Array of chapters
 * @param config - Virtual scrolling configuration
 * @returns Virtual scrolling helpers
 */
export function useVirtualChapterList<T>(
  chapters: T[],
  config: {
    /** Enable virtual scrolling (default: auto-detect based on count) */
    enabled?: boolean;
    /** Threshold for enabling virtual scrolling (default: 200) */
    threshold?: number;
    /** Height of each chapter row in pixels (default: 60) */
    itemHeight?: number;
  } = {}
): {
  shouldUseVirtualScrolling: boolean;
  itemHeight: number;
  estimatedHeight: number;
  itemCount: number;
} {
  const {
    enabled = chapters.length > (config.threshold ?? 200),
    threshold = 200,
    itemHeight = 60
  } = config;

  const shouldUseVirtualScrolling = useMemo(
    () => enabled && chapters.length > threshold,
    [enabled, chapters.length, threshold]
  );

  const estimatedHeight = useMemo(
    () => Math.min(chapters.length * itemHeight, 800), // Max 800px height
    [chapters.length, itemHeight]
  );

  return {
    shouldUseVirtualScrolling,
    itemHeight,
    estimatedHeight,
    itemCount: chapters.length
  };
}

/**
 * Performance metrics for chapter loading
 */
export function useChapterPerformanceMetrics(
  chapterCount: number,
  loadTime?: number
): {
  chapterCount: number;
  isLarge: boolean;
  isVeryLarge: boolean;
  isExtreme: boolean;
  performanceRating: 'excellent' | 'good' | 'fair' | 'poor';
  recommendation: string;
  loadTime?: number;
  estimatedMemoryUsage: string;
} {
  const metrics = useMemo(() => {
    const isLarge = chapterCount > 500;
    const isVeryLarge = chapterCount > 1000;
    const isExtreme = chapterCount > 2000;

    let performanceRating: 'excellent' | 'good' | 'fair' | 'poor';
    let recommendation: string;

    if (chapterCount < 200) {
      performanceRating = 'excellent';
      recommendation = 'No optimization needed';
    } else if (chapterCount < 500) {
      performanceRating = 'good';
      recommendation = 'Consider enabling virtual scrolling';
    } else if (chapterCount < 1000) {
      performanceRating = 'fair';
      recommendation = 'Virtual scrolling recommended';
    } else {
      performanceRating = 'poor';
      recommendation = 'Virtual scrolling and pagination strongly recommended';
    }

    const baseMetrics = {
      chapterCount,
      isLarge,
      isVeryLarge,
      isExtreme,
      performanceRating,
      recommendation,
      estimatedMemoryUsage: `~${Math.round(chapterCount * 2)}KB` // Rough estimate
    };

    return loadTime !== undefined
      ? { ...baseMetrics, loadTime }
      : baseMetrics;
  }, [chapterCount, loadTime]);

  return metrics;
}
