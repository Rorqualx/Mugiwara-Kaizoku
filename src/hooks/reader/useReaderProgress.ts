/**
 * useReaderProgress Hook
 *
 * Manages reading progress tracking and persistence.
 */

import { useCallback, useEffect, useRef } from 'react';

import type { MangaFile } from '@/types/reader/reader-types';
import { logger } from '@/utils/logger';
import { PROGRESS_SAVE_DEBOUNCE_MS } from '@/utils/reader/constants';
import { trpc } from '@/utils/trpc-client/index';

import type { UseReaderProgressReturn } from './types';

interface UseReaderProgressOptions {
  currentFile: MangaFile | null;
  currentPage: number;
  currentChapterId: number | null;
}

/** Input type for progress mutation */
interface ProgressMutationInput {
  mangaId: number;
  chapterId: number;
  currentPage: number;
  totalPages: number;
}

/** Save progress immediately (for cleanup effects) */
function saveProgressImmediately(
  file: MangaFile,
  page: number,
  mutateAsync: (input: ProgressMutationInput) => Promise<unknown>,
  context: string
): void {
  void mutateAsync({
    mangaId: file.mangaId,
    chapterId: file.chapterId,
    currentPage: page,
    totalPages: file.totalPages
  }).catch((err: unknown) => logger.error(`Failed to save progress ${context}`, { error: err }));
}

export function useReaderProgress({
  currentFile,
  currentPage,
  currentChapterId
}: UseReaderProgressOptions): UseReaderProgressReturn {
  const progressMutation = trpc.reader.updateProgress.useMutation();
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Save progress with debounce (for frequent page changes)
  const saveProgress = useCallback((page: number) => {
    if (!currentFile) return;

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      progressMutation.mutate({
        mangaId: currentFile.mangaId,
        chapterId: currentFile.chapterId,
        currentPage: page,
        totalPages: currentFile.totalPages
      });
    }, PROGRESS_SAVE_DEBOUNCE_MS);
  }, [currentFile, progressMutation]);

  // Save progress on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (currentFile && currentPage) {
        saveProgressImmediately(currentFile, currentPage, progressMutation.mutateAsync, 'on unmount');
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFile, currentPage]);

  // Save progress when changing chapters
  useEffect(() => {
    return () => {
      if (currentFile && currentPage) {
        saveProgressImmediately(currentFile, currentPage, progressMutation.mutateAsync, 'on chapter change');
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentChapterId]);

  return { saveProgress };
}
