/**
 * Custom hook for checking chapters across all manga
 */

import { useCallback } from 'react';

import { notifications } from '@mantine/notifications';

import { toNumberId } from '@/utils/id-converters';
import { logger } from '@/utils/logger';
import { notify } from '@/utils/notify';
import { trpc } from '@/utils/trpc-client/index';

/**
 * Hook for checking chapters across all manga
 */
export interface UseChapterCheckResult {
  handleCheckChapters: () => Promise<void>;
  isCheckingChapters: boolean;
}

/**
 * Hook to handle checking chapters for all manga
 */
export function useChapterCheck(): UseChapterCheckResult {
  // Use query to get all manga
  const mangaQuery = trpc.manga.query.useQuery(undefined, {
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  // Use mutation to check chapters for a specific manga
  const checkOutOfSyncChaptersMutation = trpc.manga.checkOutOfSyncChapters.useMutation();

  const handleCheckChapters = useCallback(async (): Promise<void> => {
    try {
      notifications.show({
        title: 'Search Monitoring',
        message: 'Global search monitoring initiated',
        color: 'blue',
        loading: true,
      });

      // Since there's no global check, we need to check manga one by one
      if (mangaQuery.data && Array.isArray(mangaQuery.data)) {
        // Use a single notification with progress updates
        const notificationId = 'check-chapters-progress';

        // Check chapters for each manga
        for (let i = 0; i < mangaQuery.data.length; i++) {
          const manga = mangaQuery.data[i];

          // Type guard to ensure manga is a Record with index signature
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- False positive, manga can be null/undefined
          if (!manga || typeof manga !== 'object' || Array.isArray(manga) || manga === null) {
            continue;
          }

          const mangaRecord = manga as Record<string, unknown>;
          if (!mangaRecord['id']) {
            continue;
          }

          // Update progress notification
          notifications.update({
            id: notificationId,
            title: 'Search Monitoring',
            message: `Checking manga ${i + 1}/${mangaQuery.data.length}: ${mangaRecord['title'] || 'Unknown'}`,
            color: 'blue',
            loading: true,
          });

          // Check chapters for this manga
          // eslint-disable-next-line no-await-in-loop -- Intentional sequential processing to avoid overwhelming the API
          await checkOutOfSyncChaptersMutation.mutateAsync({ mangaId: toNumberId(mangaRecord['id']) });
        }

        // Update notification when complete
        notifications.update({
          id: notificationId,
          title: 'Search Monitoring',
          message: 'Chapter check completed successfully',
          color: 'green',
          loading: false,
        });
      } else {
        // No manga data available
        notify({ severity: 'WARNING', title: 'Search Monitoring', message: 'No manga found to check' });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Chapter check errorMessage:', errorMessage);
      notify({ severity: 'ERROR', title: 'Chapter Check Error', message: 'Failed to check for new chapters' });
    }
  }, [mangaQuery.data, checkOutOfSyncChaptersMutation]);

  return {
    handleCheckChapters,
    isCheckingChapters: checkOutOfSyncChaptersMutation.isPending,
  };
}
