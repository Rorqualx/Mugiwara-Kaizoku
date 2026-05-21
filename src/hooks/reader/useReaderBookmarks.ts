/**
 * useReaderBookmarks Hook
 *
 * Manages bookmark state and operations for the reader component.
 * Provides toggle functionality for adding/removing bookmarks on the current page.
 */

import { useCallback } from 'react';

import type { MangaFile } from '@/types/reader/reader-types';
import { toNumberId } from '@/utils/id-converters';
import { trpc } from '@/utils/trpc-client';

interface UseReaderBookmarksProps {
  mangaId: string | string[] | undefined;
  chapterId: string | string[] | undefined;
  currentPage: number;
  file: MangaFile | null;
}

interface UseReaderBookmarksReturn {
  isBookmarked: boolean;
  toggleBookmark: () => void;
  bookmarksQuery: ReturnType<typeof trpc.reader.getBookmarks.useQuery>;
}

export function useReaderBookmarks({
  mangaId,
  chapterId,
  currentPage,
  file,
}: UseReaderBookmarksProps): UseReaderBookmarksReturn {
  // Fetch bookmarks for current manga
  const bookmarksQuery = trpc.reader.getBookmarks.useQuery(
    {
      mangaId: toNumberId(mangaId),
    },
    {
      enabled: !!mangaId,
    }
  );

  // Mutations
  const addBookmarkMutation = trpc.reader.addBookmark.useMutation({
    onSuccess: () => {
      void bookmarksQuery.refetch();
    },
  });

  const removeBookmarkMutation = trpc.reader.removeBookmark.useMutation({
    onSuccess: () => {
      void bookmarksQuery.refetch();
    },
  });

  // Check if current page is bookmarked
  const isBookmarked =
    bookmarksQuery.data?.some(
      (b: NonNullable<typeof bookmarksQuery.data>[number]) =>
        b.chapterId === toNumberId(chapterId) && b.pageNumber === currentPage
    ) ?? false;

  const currentBookmark = bookmarksQuery.data?.find(
    (b: NonNullable<typeof bookmarksQuery.data>[number]) =>
      b.chapterId === toNumberId(chapterId) && b.pageNumber === currentPage
  );

  // Toggle bookmark on current page
  const toggleBookmark = useCallback((): void => {
    if (!file) return;

    if (isBookmarked && currentBookmark) {
      void removeBookmarkMutation.mutateAsync({
        bookmarkId: currentBookmark.id,
      });
    } else {
      void addBookmarkMutation.mutateAsync({
        mangaId: file.mangaId,
        chapterId: file.chapterId,
        pageNumber: currentPage,
      });
    }
  }, [file, isBookmarked, currentBookmark, removeBookmarkMutation, addBookmarkMutation, currentPage]);

  return {
    isBookmarked,
    toggleBookmark,
    bookmarksQuery,
  };
}
