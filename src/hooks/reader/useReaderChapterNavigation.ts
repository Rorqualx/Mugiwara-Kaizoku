/**
 * useReaderChapterNavigation Hook
 *
 * Manages navigation between chapters (next, prev, jump).
 */

import { useCallback } from 'react';

import { trpc } from '@/utils/trpc-client/index';

import type { UseReaderChapterNavigationReturn, ChapterNavigationData } from './types';

interface UseReaderChapterNavigationOptions {
  currentMangaId: number | null;
  currentChapterId: number | null;
  loadChapter: (mangaId: number, chapterId: number) => Promise<void>;
}

export function useReaderChapterNavigation({
  currentMangaId,
  currentChapterId,
  loadChapter
}: UseReaderChapterNavigationOptions): UseReaderChapterNavigationReturn {
  // Get chapter navigation info
  const chapterNavQuery = trpc.reader.getChapterNavigation.useQuery(
    {
      mangaId: currentMangaId ?? 0,
      chapterId: currentChapterId ?? 0
    },
    {
      enabled: currentMangaId !== null && currentChapterId !== null
    }
  );

  // Navigate to next chapter
  const nextChapter = useCallback(async () => {
    const navData = chapterNavQuery.data as ChapterNavigationData | undefined;
    if (!navData || !currentMangaId) return;

    if (navData.nextChapter?.id) {
      await loadChapter(currentMangaId, navData.nextChapter.id);
    }
  }, [chapterNavQuery.data, currentMangaId, loadChapter]);

  // Navigate to previous chapter
  const prevChapter = useCallback(async () => {
    const navData = chapterNavQuery.data as ChapterNavigationData | undefined;
    if (!navData || !currentMangaId) return;

    if (navData.prevChapter?.id) {
      await loadChapter(currentMangaId, navData.prevChapter.id);
    }
  }, [chapterNavQuery.data, currentMangaId, loadChapter]);

  // Jump to specific chapter
  const jumpToChapter = useCallback(async (chapterId: number) => {
    if (!currentMangaId) return;
    await loadChapter(currentMangaId, chapterId);
  }, [currentMangaId, loadChapter]);

  return {
    chapterNavigation: chapterNavQuery.data as ChapterNavigationData | undefined,
    isLoadingNavigation: chapterNavQuery.isLoading,
    nextChapter,
    prevChapter,
    jumpToChapter
  };
}
