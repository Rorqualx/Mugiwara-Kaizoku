/**
 * useReaderProgress Hook
 *
 * Manages reading progress tracking and persistence.
 *
 * A page turn schedules a debounced save of the page just turned TO. The one
 * save that has not been sent yet is kept in a ref together with the chapter
 * it belongs to, and is sent at once when the reader moves to another chapter,
 * is closed, or the tab is hidden.
 *
 * (The previous version flushed from an effect cleanup keyed on the current
 * page. That cleanup ran on every page turn: it cancelled the debounced save
 * for the new page and sent the PREVIOUS page instead, so there was one request
 * per turn and the server was always one page behind.)
 */

import { useCallback, useEffect, useRef } from 'react';

import type { MangaFile } from '@/types/reader/reader-types';
import { logger } from '@/utils/logger';
import { PROGRESS_SAVE_DEBOUNCE_MS } from '@/utils/reader/constants';
import { trpc } from '@/utils/trpc-client/index';

import type { UseReaderProgressReturn } from './types';

interface UseReaderProgressOptions {
  currentFile: MangaFile | null;
  currentChapterId: number | null;
}

/** Input type for progress mutation */
interface ProgressMutationInput {
  mangaId: number;
  chapterId: number;
  currentPage: number;
  totalPages: number;
}

export function useReaderProgress({
  currentFile,
  currentChapterId
}: UseReaderProgressOptions): UseReaderProgressReturn {
  const progressMutation = trpc.reader.updateProgress.useMutation();
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** The scheduled save that has not been sent yet, if any. */
  const pendingRef = useRef<ProgressMutationInput | null>(null);

  // Latest mutate function, so the flush below never closes over a stale one.
  const mutateRef = useRef(progressMutation.mutateAsync);
  mutateRef.current = progressMutation.mutateAsync;

  /** Sends the pending save now and cancels its timer. No-op when nothing is pending. */
  const flush = useCallback((context: string): void => {
    if (saveTimerRef.current !== null) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const pending = pendingRef.current;
    if (!pending) return;
    pendingRef.current = null;
    mutateRef.current(pending).catch((err: unknown) => {
      logger.error(`Failed to save progress ${context}`, { error: err });
    });
  }, []);

  // Save progress with debounce (for frequent page changes)
  const saveProgress = useCallback((page: number) => {
    if (!currentFile) return;

    pendingRef.current = {
      mangaId: currentFile.mangaId,
      chapterId: currentFile.chapterId,
      currentPage: page,
      totalPages: currentFile.totalPages
    };

    if (saveTimerRef.current !== null) {
      clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      flush('after page turn');
    }, PROGRESS_SAVE_DEBOUNCE_MS);
  }, [currentFile, flush]);

  // Leaving a chapter (and unmounting, which also runs this cleanup): send the
  // last page of the chapter being left. The pending entry carries its own
  // chapter id, so it cannot be attributed to the chapter being opened.
  useEffect(() => {
    return () => { flush('on chapter change'); };
  }, [currentChapterId, flush]);

  // Tab hidden or page being unloaded: the debounce timer may never fire.
  useEffect(() => {
    const onHide = (): void => {
      if (document.visibilityState === 'hidden') flush('on tab hide');
    };
    const onPageHide = (): void => { flush('on page hide'); };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [flush]);

  return { saveProgress };
}
