import type { RefObject, Dispatch, SetStateAction } from 'react';
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';

import { useIntersection } from '@mantine/hooks';

/**
 * Configuration options for pagination
 * 
 * @interface UsePaginationProps
 * @template T Type of items being paginated
 * @property {T[]} items - Array of items to paginate
 * @property {number} [itemsPerPage=20] - Number of items to display per page
 * @property {number} [threshold=0.8] - Intersection threshold for infinite scroll
 * @property {boolean} [infiniteScroll=false] - Whether to use infinite scroll
 */
interface UsePaginationProps<T> {
  items: T[];
  itemsPerPage?: number;
  threshold?: number;
  infiniteScroll?: boolean;
}

/**
 * Return type for the usePagination hook
 */
export interface UsePaginationResult<T> {
  /** Current page number */
  currentPage: number;
  /** Function to set current page */
  setCurrentPage: Dispatch<SetStateAction<number>>;
  /** Items for current page */
  displayedItems: T[];
  /** Total number of pages */
  totalPages: number;
  /** Ref for container element */
  containerRef: RefObject<HTMLDivElement | null>;
  /** Ref for intersection observer */
  intersectionRef: (node: HTMLElement | null) => void;
  /** Function to load next page */
  loadMore: () => void;
  /** Whether more pages exist */
  hasMore: boolean;
}

/**
 * Hook for handling pagination with optional infinite scroll
 * 
 * This hook manages pagination state and can optionally implement infinite scroll
 * functionality. It supports both traditional pagination and infinite scroll modes,
 * with configurable items per page and intersection threshold.
 * 
 * @template T Type of items being paginated
 * @param {UsePaginationProps<T>} props - Configuration options
 * @returns {UsePaginationResult<T>} Pagination state and controls
 * 
 * @example
 * ```tsx
 * const { 
 *   displayedItems, 
 *   containerRef,
 *   intersectionRef,
 *   hasMore 
 * } = usePagination({
 *   items: mangaList,
 *   itemsPerPage: 20,
 *   infiniteScroll: true
 * });
 * ```
 */
export function usePagination<T>({
  items,
  itemsPerPage = 20,
  threshold = 0.8,
  infiniteScroll = false
}: UsePaginationProps<T>): UsePaginationResult<T> {
  const [currentPage, setCurrentPage] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastIntersectionState = useRef(false);
  const isLoadingMoreRef = useRef(false);

  // Get intersection observer ref
  const { ref: intersectionRef, entry } = useIntersection({
    root: null,
    threshold
  });

  // Calculate total pages
  const totalPages = useMemo(() =>
  Math.ceil(items.length / itemsPerPage),
  [items.length, itemsPerPage]
  );

  // Calculate displayed items based on current page and mode
  const displayedItems = useMemo(() => {
    const endIndex = currentPage * itemsPerPage;
    return infiniteScroll ?
    items.slice(0, endIndex) :
    items.slice(endIndex - itemsPerPage, endIndex);
  }, [items, currentPage, itemsPerPage, infiniteScroll]);

  // Load more function
  const loadMore = useCallback(() => {
    if (currentPage < totalPages && !isLoadingMoreRef.current) {
      isLoadingMoreRef.current = true;
      setCurrentPage((prev) => prev + 1);
      // Reset loading flag after state update is processed
      setTimeout(() => {
        isLoadingMoreRef.current = false;
      }, 0);
    }
  }, [currentPage, totalPages]);

  // Handle intersection for infinite scroll
  useEffect(() => {
    const isIntersecting = entry?.isIntersecting ?? false;

    // Only trigger if intersection state changed from false to true
    // and we're not already loading more items
    if (infiniteScroll &&
    isIntersecting &&
    !lastIntersectionState.current &&
    currentPage < totalPages &&
    !isLoadingMoreRef.current) {
      loadMore();
    }

    lastIntersectionState.current = isIntersecting;
  }, [entry?.isIntersecting, infiniteScroll, totalPages, currentPage, loadMore]);

  return {
    currentPage,
    setCurrentPage,
    displayedItems,
    totalPages,
    containerRef,
    intersectionRef,
    loadMore,
    hasMore: currentPage < totalPages
  };
}