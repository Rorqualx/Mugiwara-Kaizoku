/**
 * Manga Detail Page Handler Factory
 *
 * Creates handler functions for the manga detail page with
 * injected dependencies for better testability and separation of concerns.
 *
 * @module pages/manga/manga-detail-handlers
 */

import type { AppRouter } from '@/server/trpc/root';
import { toNumberId } from '@/utils/id-converters';
import { logger } from '@/utils/logger';
import { notify } from '@/utils/notify';

import type { Chapter as ChapterEntity } from '@prisma/client';
import type { inferRouterOutputs } from '@trpc/server';

type RouterOutput = inferRouterOutputs<AppRouter>;

/**
 * Notification options for success/error messages
 */
interface NotificationOptions {
  title: string;
  message: string;
}

/**
 * Dependencies required by the manga detail handlers
 */
export interface MangaDetailHandlerDeps {
  /** Current manga ID from route params */
  mangaId: number | undefined;
  /** Manga data with chapters and relations */
  manga: RouterOutput['manga']['get'] | null;
  /** Library ID for navigation after deletion */
  libraryId?: number | null | undefined;
  /** Function to show success notification */
  showSuccess: (opts: NotificationOptions) => void;
  /** Function to show error notification */
  showError: (opts: NotificationOptions) => void;
  /** Mutation to remove manga from library */
  removeMangaMutation: {
    mutateAsync: (input: { id: number; shouldRemoveFiles: boolean }) => Promise<unknown>;
  };
  /** Mutation to download individual chapters */
  downloadMutation: {
    mutateAsync: (input: { mangaId: number; chapterIndex: number }) => Promise<unknown>;
  };
  /** Next.js router for navigation */
  router: {
    replace: (path: string) => Promise<boolean>;
  };
  /** Setter for selected chapter state */
  setSelectedChapter: (chapter: ChapterEntity | null) => void;
  /** Setter for initial modal tab */
  setInitialModalTab: (tab: 'details' | 'search') => void;
  /** Setter for chapter modal open state */
  setChapterModalOpened: (open: boolean) => void;
}

/**
 * Factory function that creates all manga detail page handlers
 *
 * @param deps - Dependencies required by the handlers
 * @returns Object containing all handler functions
 *
 * @example
 * ```typescript
 * const handlers = createMangaDetailHandlers({
 *   mangaId,
 *   manga,
 *   showSuccess,
 *   showError,
 *   removeMangaMutation,
 *   downloadMutation,
 *   router,
 *   setSelectedChapter,
 *   setInitialModalTab,
 *   setChapterModalOpened
 * });
 *
 * // Use handlers
 * await handlers.handleRemoveManga(true);
 * handlers.handleToggleMonitoring(123, true);
 * ```
 */
export function createMangaDetailHandlers(deps: MangaDetailHandlerDeps): {
  handleRemoveManga: (shouldRemoveFiles: boolean) => Promise<void>;
  handleToggleMonitoring: (chapterId: string | number, monitored: boolean) => void;
  handleAutoSearch: (chapterId: string | number) => void;
  handleManualSearch: (chapterId: string | number) => void;
  handleDownloadChapters: (mangaId: string | number, chapterIds: (string | number)[]) => void;
} {
  const {
    mangaId,
    manga,
    libraryId,
    showSuccess,
    showError,
    removeMangaMutation,
    downloadMutation,
    router,
    setSelectedChapter,
    setInitialModalTab,
    setChapterModalOpened
  } = deps;

  /**
   * Handle manga removal with optional file deletion
   *
   * Removes the manga from the database and optionally deletes
   * all associated files from the filesystem.
   *
   * @param shouldRemoveFiles - Whether to also delete chapter files
   */
  const handleRemoveManga = async (shouldRemoveFiles: boolean): Promise<void> => {
    if (mangaId === undefined || isNaN(mangaId)) {
      showError({
        title: 'Removal Failed',
        message: 'Invalid manga ID'
      });
      return;
    }

    // TypeScript now knows mangaId is a valid number
    const safeMangaId: number = mangaId;
    logger.info(
      `MangaDetailPage: Removing manga ID ${safeMangaId}, shouldRemoveFiles: ${shouldRemoveFiles}`
    );

    try {
      await removeMangaMutation.mutateAsync({
        id: safeMangaId,
        shouldRemoveFiles
      });

      showSuccess({
        title: 'Manga Removed',
        message: `Manga has been successfully removed${shouldRemoveFiles ? ' along with its files' : ''}`
      });

      // Navigate to library page if available, otherwise home
      const redirectPath = libraryId ? `/library/${libraryId}` : '/';
      logger.info(`MangaDetailPage: Successfully removed manga, redirecting to ${redirectPath}`);
      void router.replace(redirectPath);
    } catch (error: unknown) {
      logger.error('MangaDetailPage: Error removing manga:', error);
      showError({
        title: 'Removal Failed',
        message: error instanceof Error ? error.message : 'Failed to remove manga'
      });
    }
  };

  /**
   * Handle chapter monitoring toggle notification
   *
   * Shows a notification when a chapter's monitoring status changes.
   * The actual toggle mutation should be handled separately.
   *
   * @param chapterId - ID of the chapter being toggled
   * @param monitored - New monitoring status
   */
  const handleToggleMonitoring = (chapterId: string | number, monitored: boolean): void => {
    notify({ severity: 'INFO', title: monitored ? 'Chapter Monitored' : 'Chapter Unmonitored', message: `Chapter ${chapterId} is now ${monitored ? 'monitored' : 'not monitored'}` });
  };

  /**
   * Handle auto search notification for a chapter
   *
   * Shows a notification when auto search is triggered for a chapter.
   *
   * @param chapterId - ID of the chapter to search for
   */
  const handleAutoSearch = (chapterId: string | number): void => {
    notify({ severity: 'INFO', title: 'Auto Search', message: `Searching for chapter ${chapterId}` });
  };

  /**
   * Handle manual search for a chapter
   *
   * Finds the chapter by ID and opens the chapter detail modal
   * with the search tab selected.
   *
   * @param chapterId - ID of the chapter to search for
   */
  const handleManualSearch = (chapterId: string | number): void => {
    // Convert chapterId to number for comparison
    const numericId = typeof chapterId === 'string' ? parseInt(chapterId, 10) : chapterId;

    // Find the chapter from manga's chapters array
    const foundChapter = manga?.Chapter.find((ch: ChapterEntity) => ch.id === numericId);

    if (!foundChapter) {
      notify({ severity: 'ERROR', title: 'Chapter Not Found', message: `Could not find chapter ${chapterId}` });
      return;
    }

    // Set the selected chapter and open the modal to search tab
    setSelectedChapter(foundChapter);
    setInitialModalTab('search');
    setChapterModalOpened(true);
  };

  /**
   * Handle batch chapter download
   *
   * Downloads multiple chapters by finding their indices and
   * calling the download mutation for each one.
   *
   * @param mangaIdParam - ID of the manga (can be string or number)
   * @param chapterIds - Array of chapter IDs to download
   */
  const handleDownloadChapters = (mangaIdParam: string | number, chapterIds: (string | number)[]): void => {
    void (async (): Promise<void> => {
      try {
        // Convert IDs to the format expected by the API
        const mangaIdNumber =
          typeof mangaIdParam === 'string' ? toNumberId(mangaIdParam) : mangaIdParam;

        // Call the download mutation for each chapter in parallel
        // Each download is independent and can be executed concurrently
        await Promise.all(
          chapterIds.map(async (chapterId) => {
            // Convert chapterId to number for comparison
            const numericChapterId = typeof chapterId === 'string' ? parseInt(chapterId, 10) : chapterId;
            const chapterIndex = manga?.Chapter.find((ch: ChapterEntity) => ch.id === numericChapterId)?.index;
            if (chapterIndex !== undefined) {
              await downloadMutation.mutateAsync({
                mangaId: mangaIdNumber,
                chapterIndex: chapterIndex
              });
            }
          })
        );

        notify({ severity: 'INFO', title: 'Download Started', message: `Downloading ${chapterIds.length} chapter(s) from ${manga?.title ?? 'manga'}` });
      } catch (error: unknown) {
        logger.error('Error downloading chapters:', error);
        notify({ severity: 'ERROR', title: 'Download Failed', message: error instanceof Error ? error.message : 'Failed to start download' });
      }
    })();
  };

  return {
    handleRemoveManga,
    handleToggleMonitoring,
    handleAutoSearch,
    handleManualSearch,
    handleDownloadChapters
  };
}

/**
 * Type representing the return value of createMangaDetailHandlers
 */
export type MangaDetailHandlers = ReturnType<typeof createMangaDetailHandlers>;

/**
 * Individual handler type exports for consumers who need specific types
 */
export type HandleRemoveMangaFn = MangaDetailHandlers['handleRemoveManga'];
export type HandleToggleMonitoringFn = MangaDetailHandlers['handleToggleMonitoring'];
export type HandleAutoSearchFn = MangaDetailHandlers['handleAutoSearch'];
export type HandleManualSearchFn = MangaDetailHandlers['handleManualSearch'];
export type HandleDownloadChaptersFn = MangaDetailHandlers['handleDownloadChapters'];
