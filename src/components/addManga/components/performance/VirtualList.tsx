/**
 * VirtualList Component
 *
 * High-performance virtual scrolling for large lists
 */
import type { CSSProperties, ReactElement} from 'react';
import React, { useRef, useState, useEffect, useCallback, useMemo, memo } from 'react';

import { Box, ScrollArea, Center, Loader} from '@mantine/core';
import { useIntersection } from '@mantine/hooks';
import { useVirtualizer } from '@tanstack/react-virtual';

import { logger } from '@/utils/logger';
interface VirtualListProps<T> {
    /** Array of items to render */
    items: T[];
    /** Height of the scrollable container */
    height: number;
    /** Estimated size of each item (for dynamic sizing) */
    estimateSize?: number | ((index: number) => number);
    /** Render function for each item */
    renderItem: (item: T, index: number) => ReactElement;
    /** Optional gap between items */
    gap?: number;
    /** Overscan count (number of items to render outside visible area) */
    overscan?: number;
    /** Loading state */
    isLoading?: boolean;
    /** Load more callback for infinite scrolling */
    onLoadMore?: () => void;
    /** Has more items to load */
    hasMore?: boolean;
    /** Empty state component */
    emptyState?: ReactElement;
    /** Custom loading component */
    loadingComponent?: ReactElement;
    /** Enable horizontal scrolling */
    horizontal?: boolean;
    /** Custom scroll area props */
    scrollAreaProps?: Record<string, unknown>;
    /** Enable smooth scrolling */
    smoothScroll?: boolean;
    /** Debug mode - shows rendering info */
    debug?: boolean;
}
/**
 * High-performance virtual list component
 */
// eslint-disable-next-line complexity -- Complex virtual scrolling component with multiple features
export const VirtualList = memo(function VirtualList<T>({ items, height, estimateSize = 50, renderItem, gap = 0, overscan = 5, isLoading = false, onLoadMore, hasMore = false, emptyState, loadingComponent, horizontal = false, scrollAreaProps = {}, smoothScroll = true, debug = false }: VirtualListProps<T>) {
    const parentRef = useRef<HTMLDivElement>(null);
    const _scrollRef = useRef<HTMLDivElement>(null);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    // Create virtualizer instance
    const virtualizer = useVirtualizer({
        count: items.length,
        getScrollElement: () => parentRef.current,
        estimateSize: typeof estimateSize === 'function' ? estimateSize : () => estimateSize,
        overscan,
        horizontal,
        gap
    });
    const virtualItems = virtualizer.getVirtualItems();
    // Intersection observer for infinite scrolling
    const { ref: intersectionRef, entry } = useIntersection({
        root: parentRef.current,
        threshold: 0.1
    });
    // Handle infinite scrolling
    useEffect(() => {
        if (entry?.isIntersecting &&
            !isLoadingMore &&
            hasMore &&
            onLoadMore &&
            !isLoading) {
            setIsLoadingMore(true);
            onLoadMore();
        }
    }, [entry?.isIntersecting, isLoadingMore, hasMore, onLoadMore, isLoading]);
    // Reset loading state when items change
    useEffect(() => {
        setIsLoadingMore(false);
    }, [items.length]);
    // Scroll to item function
    const _scrollToIndex = useCallback((index: number, options?: {
        align?: 'start' | 'center' | 'end' | 'auto';
    }) => {
        virtualizer.scrollToIndex(index, {
            align: options?.align ?? 'auto',
            behavior: smoothScroll ? 'smooth' : 'auto'
        });
    }, [virtualizer, smoothScroll]);
    // Calculate total size
    const totalSize = virtualizer.getTotalSize();
    // Empty state
    if (!isLoading && items.length === 0 && emptyState) {
        return emptyState;
    }
    // Loading state
    if (isLoading && items.length === 0) {
        return (<Center h={height}>
        {loadingComponent ?? <Loader size="lg"/>}
      </Center>);
    }
    const listStyle: CSSProperties = horizontal ?
        {
            height: '100%',
            width: totalSize,
            position: 'relative'
        } :
        {
            height: totalSize,
            width: '100%',
            position: 'relative'
        };
    const itemStyle = (virtualItem: { start: number; size: number }): CSSProperties => horizontal ?
        {
            position: 'absolute',
            top: 0,
            left: 0,
            width: virtualItem.size,
            height: '100%',
            transform: `translateX(${virtualItem.start}px)`
        } :
        {
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: virtualItem.size,
            transform: `translateY(${virtualItem.start}px)`
        };
    return (<Box style={{ position: 'relative' }}>
      {debug &&
            <Box style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    zIndex: 1000,
                    background: 'rgba(0,0,0,0.8)',
                    color: 'white',
                    padding: '4px 8px',
                    fontSize: '11px',
                    borderRadius: '4px'
                }}>

          <div>Total: {items.length}</div>
          <div>Visible: {virtualItems.length}</div>
          <div>Start: {virtualItems[0]?.index ?? 0}</div>
          <div>End: {virtualItems[virtualItems.length - 1]?.index ?? 0}</div>
        </Box>}

      <ScrollArea h={height} ref={parentRef} {...scrollAreaProps} type="auto" scrollbarSize={8}>

        <div style={listStyle}>
          {virtualItems.map((virtualItem) => {
            const item = items[virtualItem.index];
            if (item === undefined) return null;
            return (<div key={virtualItem.key} data-index={virtualItem.index} ref={virtualizer.measureElement} style={itemStyle(virtualItem)}>

                {renderItem(item, virtualItem.index)}
              </div>);
        })}

          {/* Infinite scroll trigger */}
          {hasMore &&
            <div ref={intersectionRef} style={{
                    position: 'absolute',
                    [horizontal ? 'left' : 'top']: totalSize - 100,
                    [horizontal ? 'height' : 'width']: '100%',
                    [horizontal ? 'width' : 'height']: 100
                }}>

              {isLoadingMore &&
                    <Center h="100%">
                  <Loader size="sm"/>
                </Center>}
            </div>}
        </div>
      </ScrollArea>
    </Box>);
}) as <T>(props: VirtualListProps<T>) => ReactElement;
export interface UseVirtualListStateReturn<T> {
    items: T[];
    setItems: React.Dispatch<React.SetStateAction<T[]>>;
    loadMore: (fetchFn: (page: number, pageSize: number) => Promise<T[]>) => Promise<void>;
    reset: () => void;
    updateItem: (index: number, updater: (item: T) => T) => void;
    removeItem: (index: number) => void;
    isLoading: boolean;
    hasMore: boolean;
    page: number;
}

/**
 * Hook for managing virtual list state
 */
export function useVirtualListState<T>(initialItems: T[] = [], pageSize: number = 20): UseVirtualListStateReturn<T> {
    const [items, setItems] = useState<T[]>(initialItems);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const loadMore = useCallback(async (fetchFn: (page: number, pageSize: number) => Promise<T[]>) => {
        if (isLoading || !hasMore)
            return;
        setIsLoading(true);
        try {
            const newItems = await fetchFn(page, pageSize);
            if (newItems.length < pageSize) {
                setHasMore(false);
            }
            setItems((prev) => [...prev, ...newItems]);
            setPage((prev) => prev + 1);
        }
        catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
logger.error('Error loading more items:', errorMessage);
        }
        finally {
            setIsLoading(false);
        }
    }, [page, pageSize, isLoading, hasMore]);
    const reset = useCallback(() => {
        setItems([]);
        setPage(0);
        setHasMore(true);
        setIsLoading(false);
    }, []);
    const updateItem = useCallback((index: number, updater: (item: T) => T) => {
        setItems((prev) => {
            const newItems = [...prev];
            const item = newItems[index];
            if (item !== undefined) {
                newItems[index] = updater(item);
            }
            return newItems;
        });
    }, []);
    const removeItem = useCallback((index: number) => {
        setItems((prev) => prev.filter((_, i) => i !== index));
    }, []);
    return {
        items,
        setItems,
        page,
        hasMore,
        isLoading,
        loadMore,
        reset,
        updateItem,
        removeItem
    };
}
/**
 * Virtual grid component for 2D layouts
 */
interface VirtualGridProps<T> extends Omit<VirtualListProps<T>, 'horizontal'> {
    /** Number of columns */
    columns: number;
    /** Height of each row */
    rowHeight: number;
    /** Gap between columns */
    columnGap?: number;
}
export const VirtualGrid = memo(function VirtualGrid<T>({ items, columns, rowHeight, columnGap = 0, ...props }: VirtualGridProps<T>) {
    // Group items into rows
    const rows = useMemo(() => {
        const result: T[][] = [];
        for (let i = 0; i < items.length; i += columns) {
            result.push(items.slice(i, i + columns));
        }
        return result;
    }, [items, columns]);
    const renderRow = useCallback((row: T[], rowIndex: number) => <div style={{
            display: 'flex',
            gap: columnGap,
            width: '100%',
            height: rowHeight
        }}>

      {row.map((item, colIndex) => <div key={`${rowIndex}-${colIndex}`} style={{ flex: 1 }}>

          {props.renderItem(item, rowIndex * columns + colIndex)}
        </div>)}
      {/* Fill empty cells in last row */}
      {row.length < columns && Array.from({ length: columns - row.length }).map((_, i) => <div key={`empty-${i}`} style={{ flex: 1 }}/>)}
    </div>, [columns, columnGap, rowHeight, props]);
    return (<VirtualList {...props} items={rows} estimateSize={rowHeight} renderItem={renderRow}/>);
}) as <T>(props: VirtualGridProps<T>) => ReactElement;
