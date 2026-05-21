/**
 * Hook for initiating download searches for monitored manga
 *
 * Supports two modes:
 * 1. All monitored manga with missing chapters (when no selection)
 * 2. Selected manga only (when items selected in library view)
 *
 * @module hooks/useSearchDownload
 */

import { useCallback } from 'react';

import { notifications } from '@mantine/notifications';

import { useLibraryViewStore } from '@/store/index';
import { toNumberId } from '@/utils/id-converters';
import { logger } from '@/utils/logger';
import { notify } from '@/utils/notify';
import { trpc } from '@/utils/trpc-client/index';

/**
 * Return type for useSearchDownload hook
 */
export interface UseSearchDownloadResult {
  /** Handler to initiate download search */
  handleSearchDownload: () => Promise<void>;
  /** Whether a search is currently in progress */
  isSearching: boolean;
  /** Whether manga are currently selected in library view */
  hasSelection: boolean;
  /** Number of selected manga */
  selectedCount: number;
}

/**
 * Hook for searching and downloading missing chapters
 *
 * When no manga are selected, searches all monitored manga with missing chapters.
 * When manga are selected in library view, only searches those selected manga.
 *
 * Uses the existing wanted.searchChapters mutation which triggers
 * autoDownloadScheduler.triggerManga() for each manga.
 *
 * @returns {UseSearchDownloadResult} Hook state and handlers
 *
 * @example
 * ```tsx
 * const { handleSearchDownload, isSearching, hasSelection, selectedCount } = useSearchDownload();
 *
 * <Button
 *   onClick={handleSearchDownload}
 *   loading={isSearching}
 * >
 *   {hasSelection ? `Search (${selectedCount})` : 'Search'}
 * </Button>
 * ```
 */
export function useSearchDownload(): UseSearchDownloadResult {
  // Get selected manga IDs from library view store
  const selectedItems = useLibraryViewStore((state) => state.selectedItems);
  const hasSelection = selectedItems.length > 0;

  // Query distinct manga IDs with missing chapters (for "search all" mode)
  // Only enabled when no selection to avoid unnecessary queries
  const monitoredMangaQuery = trpc.wanted.getMissingMangaIds.useQuery(undefined, {
    staleTime: 60 * 1000, // 1 minute
    enabled: !hasSelection,
  });

  // Use existing searchChapters mutation which triggers auto-download
  const searchMutation = trpc.wanted.searchChapters.useMutation();

  const handleSearchDownload = useCallback(async (): Promise<void> => {
    const notificationId = 'search-download-progress';

    try {
      let mangaIds: number[];

      if (hasSelection) {
        // Mode: Selected manga only
        mangaIds = selectedItems.map((id) => toNumberId(id));

        notifications.show({
          id: notificationId,
          title: 'Searching Selected Manga',
          message: `Searching downloads for ${mangaIds.length} selected manga...`,
          color: 'blue',
          loading: true,
          autoClose: false,
        });
      } else {
        // Mode: All monitored manga with missing chapters
        const { data } = monitoredMangaQuery;
        if (!data || data.mangaIds.length === 0) {
          notify({ severity: 'SUCCESS', title: 'No Missing Chapters', message: 'All monitored chapters are already downloaded' });
          return;
        }

        mangaIds = data.mangaIds;

        if (mangaIds.length === 0) {
          notify({ severity: 'SUCCESS', title: 'No Missing Chapters', message: 'All monitored chapters are already downloaded' });
          return;
        }

        notifications.show({
          id: notificationId,
          title: 'Searching All Monitored',
          message: `Searching downloads for ${mangaIds.length} manga...`,
          color: 'blue',
          loading: true,
          autoClose: false,
        });
      }

      // Trigger the search via existing mutation
      const result = await searchMutation.mutateAsync({ mangaIds });

      // Update notification with results
      const failedMsg = result.failed > 0 ? ` (${result.failed} failed)` : '';
      notifications.update({
        id: notificationId,
        title: 'Search Complete',
        message: `Started ${result.triggered} downloads${failedMsg}. View progress on Jobs page.`,
        color: result.failed > 0 ? 'yellow' : 'green',
        loading: false,
        autoClose: 5000,
      });

      logger.info(`[SearchDownload] Triggered: ${result.triggered}, Failed: ${result.failed}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('[SearchDownload] Error:', errorMessage);

      notifications.update({
        id: notificationId,
        title: 'Search Failed',
        message: errorMessage,
        color: 'red',
        loading: false,
        autoClose: 5000,
      });
    }
  }, [hasSelection, selectedItems, monitoredMangaQuery, searchMutation]);

  return {
    handleSearchDownload,
    isSearching: searchMutation.isPending,
    hasSelection,
    selectedCount: selectedItems.length,
  };
}
