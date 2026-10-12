/**
 * useReaderArchive Hook
 *
 * Manages chapter loading with URL-based page serving.
 * Pages are served on-demand from the server API, eliminating
 * client-side archive downloads and extraction.
 */

import { useState, useCallback, useRef } from 'react';

import { useReaderStore } from '@/store/readerSlice';
import type { MangaFile, SupportedFormat } from '@/types/reader/reader-types';
import { logger } from '@/utils/logger';
import { trpc } from '@/utils/trpc-client/index';

import { isValidChapterInfo, isValidProgress } from './types';

import type { UseReaderArchiveReturn, ChapterInfoResponse } from './types';

export function useReaderArchive(): UseReaderArchiveReturn {
  // Select the three actions individually: subscribing to the whole store
  // re-rendered the reader on every store write (each page turn included).
  const setFile = useReaderStore((state) => state.setFile);
  const setPage = useReaderStore((state) => state.setPage);
  const addToHistory = useReaderStore((state) => state.addToHistory);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [pages, setPages] = useState<string[]>([]);
  const [currentMangaId, setCurrentMangaId] = useState<number | null>(null);
  const [currentChapterId, setCurrentChapterId] = useState<number | null>(null);

  // `mutate` is stable across renders; the mutation result object is not, and
  // depending on it gave loadChapter a new identity on every render.
  const { mutate: recordHistory } = trpc.reader.addHistory.useMutation();
  // `useUtils()` is stable across renders. `staleTime: 0` so reopening a
  // chapter reads the page saved moments ago, not a cached one.
  const utils = trpc.useUtils();
  const fetchProgress = useCallback<ProgressFetcher>(
    (input) => utils.reader.getProgress.fetch(input, { staleTime: 0 }),
    [utils]
  );

  /** Sequence number of the most recent loadChapter call. */
  const loadSeqRef = useRef(0);

  // Get page URL - now simply returns the URL string from the array
  const getPageUrl = useCallback((pageNumber: number): string | null => {
    if (pageNumber < 1 || pageNumber > pages.length) return null;
    return pages[pageNumber - 1] ?? null;
  }, [pages]);

  // Load chapter with URL-based page loading (no archive download!)
  const loadChapter = useCallback(async (mangaId: number, chapterId: number) => {
    // Pressing "next chapter" twice starts two loads; whichever response
    // arrives last must not win unless it is also the one asked for last.
    const seq = ++loadSeqRef.current;
    const isStale = (): boolean => loadSeqRef.current !== seq;

    setCurrentMangaId(mangaId);
    setCurrentChapterId(chapterId);
    setIsLoading(true);
    setError(null);
    setPages([]);

    try {
      // Parallel fetch of metadata and progress (NO archive download!)
      const [chapterInfoResult, savedPage] = await Promise.all([
        fetchChapterInfo(mangaId, chapterId),
        fetchSavedProgress(fetchProgress, mangaId, chapterId)
      ]);
      if (isStale()) return;

      if (chapterInfoResult instanceof Error) {
        setError(chapterInfoResult);
        return;
      }

      const chapterInfo = chapterInfoResult;

      if (chapterInfo.pageCount === 0) {
        setError(new Error('Chapter has no pages'));
        return;
      }

      // Generate page URLs pointing to server API (instant, no extraction needed)
      const pageUrls = generatePageUrls(mangaId, chapterId, chapterInfo.pageCount);
      setPages(pageUrls);

      const file = createMangaFile(mangaId, chapterId, chapterInfo);
      setFile(file);
      // A re-imported file can have fewer pages than when progress was saved.
      setPage(Math.min(Math.max(savedPage, 1), chapterInfo.pageCount));

      addToHistory({ mangaId, chapterId, timestamp: Date.now() });
      recordHistory({ mangaId, chapterId, pagesRead: 0, totalTime: 0 });

      logger.debug('Chapter loaded with URL-based pages', {
        mangaId,
        chapterId,
        pageCount: chapterInfo.pageCount
      });
    } catch (err: unknown) {
      if (isStale()) return;
      setError(err instanceof Error ? err : new Error('Failed to load chapter'));
    } finally {
      // A superseded load leaves the spinner to the load that replaced it.
      if (!isStale()) setIsLoading(false);
    }
  }, [setFile, setPage, addToHistory, recordHistory, fetchProgress]);

  // Reload the current chapter (e.g., after file source switch)
  const reloadCurrentChapter = useCallback(async () => {
    if (currentMangaId !== null && currentChapterId !== null) {
      await loadChapter(currentMangaId, currentChapterId);
    }
  }, [currentMangaId, currentChapterId, loadChapter]);

  return {
    pages,
    isLoading,
    error,
    loadChapter,
    getPageUrl,
    currentMangaId,
    currentChapterId,
    reloadCurrentChapter
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Generate page URLs for server-side page serving.
 * No client-side extraction needed - server handles everything.
 */
function generatePageUrls(mangaId: number, chapterId: number, pageCount: number): string[] {
  return Array.from(
    { length: pageCount },
    (_, i) => `/api/reader/page/${mangaId}/${chapterId}/${i + 1}`
  );
}

/**
 * Fetch chapter info including page count.
 */
async function fetchChapterInfo(
  mangaId: number,
  chapterId: number
): Promise<ChapterInfoResponse | Error> {
  try {
    const response = await fetch(`/api/reader/chapter-info/${mangaId}/${chapterId}`);
    if (!response.ok) {
      const errorData: unknown = await response.json().catch(() => null);
      const serverMessage = (errorData as { error?: { message?: string } } | null)?.error?.message;
      const message = serverMessage ?? `Failed to load chapter (HTTP ${response.status})`;
      logger.error('Failed to fetch chapter info', { mangaId, chapterId, status: response.status, serverMessage });
      return new Error(message);
    }

    const data: unknown = await response.json();
    if (isValidChapterInfo(data)) return data;
    return new Error('Invalid chapter info response from server');
  } catch (err) {
    logger.error('Chapter info fetch error', { mangaId, chapterId, error: err });
    return new Error('Network error loading chapter info');
  }
}

/** Reads the current user's saved progress for one chapter. */
type ProgressFetcher = (input: { mangaId: number; chapterId: number }) => Promise<unknown>;

/**
 * Fetch the page to resume at.
 * A chapter read to the end starts over at page 1. Returns page 1 if the
 * progress lookup fails (graceful degradation).
 */
async function fetchSavedProgress(
  fetchProgress: ProgressFetcher,
  mangaId: number,
  chapterId: number
): Promise<number> {
  try {
    const data = await fetchProgress({ mangaId, chapterId });
    if (!isValidProgress(data)) return 1;
    return data.completedAt === null || data.completedAt === undefined ? data.currentPage : 1;
  } catch (err) {
    logger.warn('Saved reading progress unavailable; starting at page 1', { mangaId, chapterId, error: err });
    return 1;
  }
}

/**
 * Create MangaFile metadata object from chapter info.
 */
function createMangaFile(
  mangaId: number,
  chapterId: number,
  chapterInfo: ChapterInfoResponse
): MangaFile {
  return {
    id: `${mangaId}-${chapterId}`,
    mangaId,
    chapterId,
    chapterTitle: chapterInfo.title,
    format: chapterInfo.format as SupportedFormat,
    totalPages: chapterInfo.pageCount,
    metadata: { title: chapterInfo.title }
  };
}
