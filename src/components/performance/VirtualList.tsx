/**
 * Virtual List Component
 * 
 * Optimized list rendering for mobile with:
 * - Virtual scrolling
 * - Dynamic item heights
 * - Smooth scrolling
 * - Intersection observer
 * - Pull to refresh integration
 */

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';

import { Box} from '@mantine/core';
import { useViewportSize, useResizeObserver } from '@mantine/hooks';

import { PullToRefresh } from '../responsive/PullToRefresh';

interface VirtualListProps<T> {
  /** Array of items to render */
  items: T[];
  /** Render function for each item */
  renderItem: (item: T, index: number) => React.ReactNode;
  /** Item height (fixed height mode) */
  itemHeight?: number;
  /** Get item height (dynamic height mode) */
  getItemHeight?: (item: T, index: number) => number;
  /** Number of items to render outside viewport */
  overscan?: number;
  /** Container height */
  height?: string | number;
  /** Enable pull to refresh */
  pullToRefresh?: boolean;
  /** Pull to refresh handler */
  onRefresh?: () => Promise<void>;
  /** Loading state */
  isLoading?: boolean;
  /** Empty state component */
  emptyState?: React.ReactNode;
  /** On scroll callback */
  onScroll?: (scrollTop: number) => void;
  /** Scroll to index */
  scrollToIndex?: number;
  /** Custom container styles */
  containerStyle?: React.CSSProperties;
  /** Enable smooth scrolling */
  smoothScroll?: boolean;
  /** Threshold for triggering onEndReached */
  onEndReachedThreshold?: number;
  /** Callback when end is reached */
  onEndReached?: () => void;
}

interface ItemPosition {
  index: number;
  offset: number;
  height: number;
}

export function VirtualList<T>({
  items,
  renderItem,
  itemHeight,
  getItemHeight,
  overscan = 3,
  height = '100%',
  pullToRefresh = false,
  onRefresh,
  isLoading = false,
  emptyState,
  onScroll,
  scrollToIndex,
  containerStyle,
  smoothScroll = true,
  onEndReachedThreshold = 0.8,
  onEndReached
}: VirtualListProps<T>): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [containerRef2, containerRect] = useResizeObserver();
  const { height: viewportHeight } = useViewportSize();

  const [scrollTop, setScrollTop] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Calculate item positions
  const itemPositions = useMemo(() => {
    const positions: ItemPosition[] = [];
    let offset = 0;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item === undefined) continue;
      const height = itemHeight ?? getItemHeight?.(item, i) ?? 100;
      positions.push({
        index: i,
        offset,
        height
      });
      offset += height;
    }

    return positions;
  }, [items, itemHeight, getItemHeight]);

  // Calculate total height
  const totalHeight = useMemo(() => {
    if (itemPositions.length === 0) return 0;
    const lastItem = itemPositions[itemPositions.length - 1];
    if (lastItem === undefined) return 0;
    return lastItem.offset + lastItem.height;
  }, [itemPositions]);

  // Calculate visible range
  const visibleRange = useMemo(() => {
    const containerHeight = containerRect.height || (
    typeof height === 'number' ? height : parseInt(height) || viewportHeight);

    // Find first visible item
    let startIndex = 0;
    for (let i = 0; i < itemPositions.length; i++) {
      const position = itemPositions[i];
      if (position !== undefined && position.offset + position.height > scrollTop) {
        startIndex = Math.max(0, i - overscan);
        break;
      }
    }

    // Find last visible item
    let endIndex = startIndex;
    for (let i = startIndex; i < itemPositions.length; i++) {
      const position = itemPositions[i];
      if (position !== undefined && position.offset > scrollTop + containerHeight) {
        endIndex = Math.min(itemPositions.length - 1, i + overscan);
        break;
      }
      endIndex = i;
    }

    return { start: startIndex, end: endIndex + 1 };
  }, [scrollTop, containerRect, height, viewportHeight, itemPositions, overscan]);

  // Handle scroll
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    const newScrollTop = target.scrollTop;

    setScrollTop(newScrollTop);
    setIsScrolling(true);

    // Clear existing timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    // Set scrolling to false after scroll ends
    scrollTimeoutRef.current = setTimeout(() => {
      setIsScrolling(false);
    }, 150);

    // Call onScroll callback
    onScroll?.(newScrollTop);

    // Check if end reached
    if (onEndReached && containerRect.height) {
      const scrollPercentage = (newScrollTop + containerRect.height) / totalHeight;
      if (scrollPercentage >= onEndReachedThreshold) {
        onEndReached();
      }
    }
  }, [onScroll, onEndReached, containerRect, totalHeight, onEndReachedThreshold]);

  // Scroll to index
  useEffect(() => {
    if (scrollToIndex !== undefined &&
    scrollToIndex >= 0 &&
    scrollToIndex < itemPositions.length &&
    scrollRef.current) {
      const position = itemPositions[scrollToIndex];
      if (position !== undefined) {
        scrollRef.current.scrollTo({
          top: position.offset,
          behavior: smoothScroll ? 'smooth' : 'auto'
        });
      }
    }
  }, [scrollToIndex, itemPositions, smoothScroll]);

  // Render visible items
  const visibleItems = useMemo(() => {
    if (items.length === 0) return null;

    const elements: React.ReactNode[] = [];

    for (let i = visibleRange.start; i < visibleRange.end; i++) {
      if (i >= items.length) break;

      const item = items[i];
      const position = itemPositions[i];

      // Skip if item or position is undefined
      if (item === undefined || item === null || position === undefined) continue;

      elements.push(
        <Box
          key={i}
          style={{
            position: 'absolute',
            top: position.offset,
            left: 0,
            right: 0,
            height: position.height,
            willChange: isScrolling ? 'transform' : 'auto'
          }}>

          {renderItem(item, i)}
        </Box>
      );
    }

    return elements;
  }, [items, visibleRange, itemPositions, renderItem, isScrolling]);

  // Empty state
  if (items.length === 0 && !isLoading) {
    return (
      <Box
        ref={containerRef2}
        style={{
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          ...containerStyle
        }}>

        {emptyState ?? <div>No items to display</div>}
      </Box>);

  }

  const content =
  <Box
    ref={scrollRef}
    style={{
      height,
      overflow: 'auto',
      WebkitOverflowScrolling: 'touch',
      ...containerStyle
    }}
    onScroll={handleScroll}>

      <Box
      style={{
        position: 'relative',
        height: totalHeight,
        willChange: 'transform'
      }}>

        {visibleItems}
      </Box>
    </Box>;

  // Wrap with pull to refresh if enabled
  if (pullToRefresh && onRefresh) {
    return (
      <Box ref={containerRef} style={{ height }}>
        <PullToRefresh onRefresh={onRefresh} enabled={!isLoading}>
          {content}
        </PullToRefresh>
      </Box>);

  }

  return <Box ref={containerRef}>{content}</Box>;
}

/**
 * Virtual list with dynamic heights using ResizeObserver
 */
export function DynamicVirtualList<T>({
  items,
  renderItem,
  estimatedItemHeight = 100,
  ...props

}: Omit<VirtualListProps<T>, 'itemHeight' | 'getItemHeight'> & {estimatedItemHeight?: number;}): React.ReactElement {
  const itemHeights = useRef<Map<number, number>>(new Map());
  const resizeObserver = useRef<ResizeObserver | undefined>(undefined);

  // Create resize observer
  useEffect(() => {
    resizeObserver.current = new ResizeObserver((entries) => {
      entries.forEach((entry) => {
        const index = parseInt(entry.target.getAttribute('data-index') ?? '0');
        const height = entry.contentRect.height;

        if (itemHeights.current.get(index) !== height) {
          itemHeights.current.set(index, height);
          // Force re-render when heights change
          // In production, you'd want to batch these updates
        }
      });
    });

    return () => {
      resizeObserver.current?.disconnect();
    };
  }, []);

  // Enhanced render item with resize observer
  const enhancedRenderItem = useCallback((item: T, index: number) => {
    const originalElement = renderItem(item, index);

    return (
      <Box
        data-index={index}
        ref={(el) => {
          if (el && resizeObserver.current) {
            resizeObserver.current.observe(el);
          }
        }}>

        {originalElement}
      </Box>);

  }, [renderItem]);

  // Get item height with fallback to estimate
  const getItemHeight = useCallback((item: T, index: number) => {
    return itemHeights.current.get(index) ?? estimatedItemHeight;
  }, [estimatedItemHeight]);

  return (
    <VirtualList
      items={items}
      renderItem={enhancedRenderItem}
      getItemHeight={getItemHeight}
      {...props} />);

}