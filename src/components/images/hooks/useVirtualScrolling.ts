/**
 * Hook for virtual scrolling logic in galleries
 * Handles visible range calculation for performance optimization
 */

import { useMemo, useRef } from 'react';

import { useViewportSize } from '@mantine/hooks';

export interface UseVirtualScrollingOptions {
  /** Total number of items */
  totalItems: number;
  /** Number of columns in the grid */
  columns: number;
  /** Height of each thumbnail */
  thumbnailHeight: number;
  /** Whether virtual scrolling is enabled */
  enabled?: boolean;
  /** Buffer size for pre-rendering */
  scrollBuffer?: number;
}

export interface UseVirtualScrollingReturn {
  /** Start index of visible range */
  startIndex: number;
  /** End index of visible range */
  endIndex: number;
  /** Reference to the gallery container */
  galleryRef: React.RefObject<HTMLDivElement>;
}

export function useVirtualScrolling({
  totalItems,
  columns,
  thumbnailHeight,
  enabled = true,
  scrollBuffer = 3
}: UseVirtualScrollingOptions): UseVirtualScrollingReturn {
  const { height: viewportHeight } = useViewportSize();
  const galleryRef = useRef<HTMLDivElement>(null);

  // Calculate visible range for virtual scrolling
  const visibleRange = useMemo(() => {
    if (!enabled || !galleryRef.current) {
      return { start: 0, end: totalItems };
    }

    const itemsPerRow = columns;
    const rowHeight = thumbnailHeight + 32; // Height + gap + padding
    const visibleRows = Math.ceil(viewportHeight / rowHeight) + scrollBuffer;
    const totalRows = Math.ceil(totalItems / itemsPerRow);

    // Calculate based on scroll position
    // This is simplified - in production you'd track scroll position
    const startRow = 0;
    const endRow = Math.min(startRow + visibleRows, totalRows);

    return {
      start: startRow * itemsPerRow,
      end: endRow * itemsPerRow
    };
  }, [enabled, viewportHeight, columns, thumbnailHeight, scrollBuffer, totalItems]);

  return {
    startIndex: visibleRange.start,
    endIndex: visibleRange.end,
    galleryRef
  };
}