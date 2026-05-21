/**
 * Monitoring Mutation Hooks
 *
 * React hooks for toggling chapter/volume monitoring status.
 * Extracted from: hooks.ts (lines 126-217)
 */

import { notifications } from '@mantine/notifications';

import { logger } from '@/utils/logger';
import { notify } from '@/utils/notify';
import { trpc } from '@/utils/trpc-client';

// ============================================================================
// Type Definitions
// ============================================================================

export interface ToggleMonitoringMutationOptions {
  mangaId: number | undefined;
  onForceRefresh?: (() => void) | undefined;
}

// ============================================================================
// Monitoring Mutations
// ============================================================================

/**
 * Mutation for toggling volume-level monitoring status
 * Updates all chapters in a volume to be monitored/unmonitored
 *
 * @param options - Mutation options including mangaId and refresh callback
 * @returns tRPC mutation object
 */
export function useToggleVolumeMonitoring({
  mangaId,
  onForceRefresh
}: ToggleMonitoringMutationOptions): ReturnType<typeof trpc.manga.toggleVolumeMonitoring.useMutation> {
  const utils = trpc.useUtils();

  return trpc.manga.toggleVolumeMonitoring.useMutation({
    onSuccess: async (data) => {
      try {
        // Invalidate the query cache to ensure React Query knows the data is stale
        await utils.manga.get.invalidate({ id: mangaId ?? 0 });

        // Then refetch to get fresh data
        await utils.manga.get.refetch({ id: mangaId ?? 0 });

        // Trigger force refresh in parent
        if (onForceRefresh) onForceRefresh();

        notifications.show({
          title: data.monitored ? 'Volume Monitoring Enabled' : 'Volume Monitoring Disabled',
          message: data.monitored
            ? `${data.updatedCount} chapters will be monitored`
            : `${data.updatedCount} chapters removed from monitoring`,
          color: data.monitored ? 'green' : 'yellow'
        });
      } catch (error) {
        logger.error('[Volume Bookmark] Refetch error:', error);
        notify({ severity: 'WARNING', title: 'Warning', message: 'Bookmark updated but page refresh failed. Please reload the page.' });
      }
    },
    onError: (error) => {
      notify({ severity: 'ERROR', title: 'Error', message: error.message });
    }
  });
}

/**
 * Mutation for toggling individual chapter monitoring status
 *
 * @param options - Mutation options including mangaId and refresh callback
 * @returns tRPC mutation object
 */
export function useToggleChapterMonitoring({
  mangaId,
  onForceRefresh
}: ToggleMonitoringMutationOptions): ReturnType<typeof trpc.manga.toggleChapterMonitoring.useMutation> {
  const utils = trpc.useUtils();

  return trpc.manga.toggleChapterMonitoring.useMutation({
    onSuccess: async (_data, _variables) => {
      try {
        // Invalidate the query cache to ensure React Query knows the data is stale
        await utils.manga.get.invalidate({ id: mangaId ?? 0 });

        // Then refetch to get fresh data
        await utils.manga.get.refetch({ id: mangaId ?? 0 });

        // Trigger force refresh in parent
        if (onForceRefresh) onForceRefresh();
      } catch (error) {
        logger.error('[Chapter Bookmark] Refetch error:', error);
      }
    },
    onError: (error) => {
      notify({ severity: 'ERROR', title: 'Error', message: error.message });
    }
  });
}
