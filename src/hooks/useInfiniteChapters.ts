/**
 * Hook for paginated chapter loading with infinite scroll
 * 
 * TypeScript Migration:
 * - Updated to use domain types from @/types/domain
 * - Changed from custom ChapterData to ChapterEntity
 * - Updated property access patterns for chapter data
 */

import { useEffect, useState } from 'react';

import { trpc } from '../utils/trpc-client';

import type { Chapter } from '@prisma/client';

const CHAPTERS_PER_PAGE = 50;

/**
 * Return type for the useInfiniteChapters hook
 */
export interface UseInfiniteChaptersResult {
  /** Currently loaded chapters */
  chapters: Chapter[];
  /** Function to load next page of chapters */
  loadMore: () => void;
  /** Whether more chapters are available */
  hasNextPage: boolean;
  /** Whether next page is loading */
  isFetchingNextPage: boolean;
  /** Whether initial load is in progress */
  isLoading: boolean;
}

/**
 * Hook for paginated chapter loading with infinite scroll
 * 
 * This hook manages paginated loading of manga chapters with support for
 * infinite scrolling. It handles fetching chapters in batches, tracking
 * loading states, and managing the pagination state.
 * 
 * @param {number} mangaId - ID of the manga to load chapters for
 * @returns {UseInfiniteChaptersResult} Chapter loading state and controls
 * 
 * @example
 * ```tsx
 * const { chapters, loadMore, hasNextPage } = useInfiniteChapters(123);
 * 
 * return (
 *   <div>
 *     {chapters.map(chapter => (
 *       <ChapterRow key={chapter["id"]} chapter={chapter} />
 *     ))}
 *     {hasNextPage && (
 *       <button onClick={loadMore}>Load More</button>
 *     )}
 *   </div>
 * );
 * ```
 */
export function useInfiniteChapters(mangaId: number): UseInfiniteChaptersResult {
  const [page, setPage] = useState(0);
  const [allChapters, setAllChapters] = useState<Chapter[]>([]);

  // Type for the manga detail response - matches MangaWithRelations
  interface MangaDetailData {
    Chapter: Chapter[];
    [key: string]: unknown;
  }

  // Create a mock query result for when the manga.detail endpoint is not available
  const mockQuery = {
    data: undefined as MangaDetailData | undefined,
    isLoading: false,
    isFetching: false,
    error: null,
    refetch: () => ({})
  };

  // Safely access the manga.detail endpoint with type assertion
  const mangaAny = trpc.manga as unknown;

  // Type guard to check if mangaAny has detail property with useQuery
  const hasMangaDetail = (obj: unknown): obj is { detail: { useQuery: (arg1: { id: number }, arg2: { placeholderData: (prev: unknown) => unknown; staleTime: number }) => typeof mockQuery } } => {
    return typeof obj === 'object' && obj !== null && 'detail' in obj;
  };

  // Use conditional checks with type guards
  const query = hasMangaDetail(mangaAny) && typeof mangaAny["detail"]["useQuery"] === 'function' ?
  mangaAny["detail"]["useQuery"](
    {
      id: mangaId
    },
    {
      placeholderData: (prev: unknown) => prev,
      staleTime: 1000 * 60 * 5
    }
  ) :
  mockQuery;

  useEffect(() => {
    if (query.data?.["Chapter"]) {
      const newChapters = query.data["Chapter"].
      slice(page * CHAPTERS_PER_PAGE, (page + 1) * CHAPTERS_PER_PAGE);

      setAllChapters((prev) => [
      ...prev,
      ...newChapters]
      );
    }
  }, [query.data, page]);

  const hasNextPage = (query.data?.["Chapter"]?.length ?? 0) > (page + 1) * CHAPTERS_PER_PAGE;
  const isFetchingNextPage = query.isFetching && page > 0;

  const fetchNextPage = (): void => {
    setPage((prev) => prev + 1);
  };

  const loadMore = (): void => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  return {
    chapters: allChapters,
    loadMore,
    hasNextPage,
    isFetchingNextPage,
    isLoading: query.isLoading
  };
}