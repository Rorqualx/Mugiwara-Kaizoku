/**
 * Event Handlers for Manga Detail Page
 *
 * Extracted event handlers and callbacks for the manga detail page.
 * These handlers are created as factory functions to allow dependency injection.
 *
 * @module pages/manga/detail-handlers
 */

import type { MangaWithRelations } from '@/types/search.types';
import { logger } from '@/utils/logger';
import { notify } from '@/utils/notify';

import type { Chapter as ChapterEntity } from '@prisma/client';
import type { NextRouter } from 'next/router';

/**
 * Dependencies for createRemoveMangaHandler
 */
interface RemoveMangaHandlerDeps {
  mangaId: number | undefined;
  showError: (params: { title: string; message: string }) => void;
  showSuccess: (params: { title: string; message: string }) => void;
  removeMangaMutation: {
    mutateAsync: (params: { id: number; shouldRemoveFiles: boolean }) => Promise<unknown>;
  };
  router: NextRouter;
}

/**
 * Creates a handler for removing manga
 *
 * @param deps - Dependencies for the handler
 * @returns Async function that handles manga removal
 */
export function createRemoveMangaHandler(deps: RemoveMangaHandlerDeps): (shouldRemoveFiles: boolean) => Promise<void> {
  return async (shouldRemoveFiles: boolean): Promise<void> => {
    const { mangaId, showError, showSuccess, removeMangaMutation, router } = deps;

    if (mangaId === undefined || isNaN(mangaId)) {
      showError({
        title: 'Removal Failed',
        message: 'Invalid manga ID'
      });
      return;
    }

    const safeMangaId: number = mangaId;
    logger.info('MangaDetailPage: Removing manga ID ' + safeMangaId + ', shouldRemoveFiles: ' + shouldRemoveFiles);

    try {
      await removeMangaMutation.mutateAsync({
        id: safeMangaId,
        shouldRemoveFiles
      });

      showSuccess({
        title: 'Manga Removed',
        message: 'Manga has been successfully removed' + (shouldRemoveFiles ? ' along with its files' : '')
      });

      logger.info('MangaDetailPage: Successfully removed manga, redirecting to home page');
      void router.replace('/');
    } catch (error: unknown) {
      logger.error('MangaDetailPage: Error removing manga:', error);
      showError({
        title: 'Removal Failed',
        message: error instanceof Error ? error.message : 'Failed to remove manga'
      });
    }
  };
}

/**
 * Dependencies for createManualSearchHandler
 */
interface ManualSearchHandlerDeps {
  manga: MangaWithRelations | null;
  setSelectedChapter: (chapter: ChapterEntity | null) => void;
  setInitialModalTab: (tab: 'details' | 'search') => void;
  setChapterModalOpened: (opened: boolean) => void;
}

/**
 * Creates a handler for manual chapter search
 *
 * @param deps - Dependencies for the handler
 * @returns Function that handles manual search
 */
export function createManualSearchHandler(deps: ManualSearchHandlerDeps): (chapterId: string | number) => void {
  return (chapterId: string | number): void => {
    const { manga, setSelectedChapter, setInitialModalTab, setChapterModalOpened } = deps;

    // Convert chapterId to number for comparison
    const numericId = typeof chapterId === 'string' ? parseInt(chapterId, 10) : chapterId;

    // Find the chapter from manga's chapters array
    const foundChapter = manga?.Chapter.find((ch: ChapterEntity) => ch.id === numericId);

    if (!foundChapter) {
      notify({ severity: 'ERROR', title: "Chapter Not Found", message: 'Could not find chapter ' + chapterId });
      return;
    }

    // Set the selected chapter and open the modal to search tab
    setSelectedChapter(foundChapter);
    setInitialModalTab('search');
    setChapterModalOpened(true);
  };
}

/**
 * Handler for toggling chapter monitoring
 *
 * @param chapterId - The chapter ID
 * @param monitored - Whether the chapter should be monitored
 */
export function handleToggleMonitoring(chapterId: string | number, monitored: boolean): void {
  notify({ severity: 'INFO', title: monitored ? "Chapter Monitored" : "Chapter Unmonitored", message: 'Chapter ' + chapterId + ' is now ' + (monitored ? 'monitored' : 'not monitored') });
}

/**
 * Handler for auto search
 *
 * @param chapterId - The chapter ID
 */
export function handleAutoSearch(chapterId: string | number): void {
  notify({ severity: 'INFO', title: "Auto Search", message: 'Searching for chapter ' + chapterId });
}
