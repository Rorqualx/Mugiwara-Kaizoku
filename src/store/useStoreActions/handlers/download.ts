/**
 * Download Handler
 *
 * Handles chapter downloads with queue management.
 * Uses Promise.all for parallel downloads instead of sequential await.
 *
 * Extracted from: useStoreActions.ts (lines 410-435)
 */

import { useCallback } from 'react';

/**
 * Dependencies for the download handler
 */
interface DownloadDependencies {
  downloadMutation: {
    mutateAsync: (params: { mangaId: number; chapterIndex: number }) => Promise<unknown>;
  };
  queueActions: {
    addToQueue: (item: {
      id: number;
      mangaId: number;
      chapterId: number;
      title: string;
    }) => void;
  };
  showError: (opts: { title: string; message: string }) => void;
}

/**
 * Creates the handleDownload callback
 *
 * Downloads chapters in parallel using Promise.all
 * instead of sequential awaits to improve performance
 * and fix no-await-in-loop ESLint warning.
 */
export function useDownloadHandler(
  deps: DownloadDependencies
): (mangaId: number, chapterIds: number[]) => Promise<void> {
  const { downloadMutation, queueActions, showError } = deps;

  return useCallback(
    async (mangaId: number, chapterIds: number[]): Promise<void> => {
      try {
        // Add all to local queue first
        chapterIds.forEach((chapterId) => {
          queueActions.addToQueue({
            id: Date.now() + chapterId,
            mangaId,
            chapterId,
            title: `Chapter ${chapterId}`,
          });
        });

        // Download all chapters in parallel (fixes no-await-in-loop)
        await Promise.all(
          chapterIds.map((chapterId) =>
            downloadMutation.mutateAsync({
              mangaId,
              chapterIndex: chapterId,
            })
          )
        );
      } catch (error: unknown) {
        showError({
          title: 'Download Failed',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
    [downloadMutation, queueActions, showError]
  );
}
