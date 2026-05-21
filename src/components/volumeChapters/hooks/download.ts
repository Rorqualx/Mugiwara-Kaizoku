/**
 * Download Mutation Hooks
 *
 * React hooks for quick download operations.
 * Extracted from: hooks.ts (lines 219-304)
 */

import { notifications } from '@mantine/notifications';

import type { QuickDownloadResponse } from '@/types/quickDownload.types';
import { logger } from '@/utils/logger';
import { notify } from '@/utils/notify';
import { mapSummaryToNotification } from '@/utils/quickDownload/notification-mapping';
import { trpc } from '@/utils/trpc-client';

// ============================================================================
// Type Definitions
// ============================================================================

export interface QuickDownloadMutationOptions {
    mangaId: number | undefined;
    chapterIds: number[];
    onForceRefresh?: (() => void) | undefined;
}

// ============================================================================
// Download Mutations
// ============================================================================

/**
 * Quick Download mutation for volume-level downloads
 * Automatically searches Prowlarr for the best volume pack and downloads it
 *
 * @param options - Mutation options including mangaId, chapterIds, and refresh callback
 * @returns tRPC mutation object
 */
export function useQuickDownloadVolume({
    mangaId,
    chapterIds,
    onForceRefresh
}: QuickDownloadMutationOptions): ReturnType<typeof trpc.manga.quickDownloadWithSearch.useMutation> {
    const utils = trpc.useUtils();

    return trpc.manga.quickDownloadWithSearch.useMutation({
        onSuccess: async (data: unknown) => {
            // Type guard for QuickDownloadResponse
            if (!data || typeof data !== 'object' || !('summary' in data) || !('results' in data)) {
                logger.error('[Quick Download] Invalid response format:', data);
                notify({ severity: 'ERROR', title: 'Error', message: 'Invalid response from server' });
                return;
            }

            const response = data as QuickDownloadResponse;
            const firstResult = response.results.find(r => r.status === 'STARTED');
            notifications.show(mapSummaryToNotification(response.summary, {
                startedTitle: 'Volume Quick Download Started',
                ...(firstResult?.releaseTitle !== undefined ? { firstReleaseTitle: firstResult.releaseTitle } : {}),
                ...(firstResult?.indexer !== undefined ? { firstIndexer: firstResult.indexer } : {}),
            }));

            // Always refetch on a successful tRPC call — even partial / no-results
            // outcomes can change Chapter rows (e.g., updated downloadStatus
            // from a previous run cleaning up).
            try {
                await utils.manga.get.invalidate({ id: mangaId ?? 0 });
                await utils.manga.get.refetch({ id: mangaId ?? 0 });
                await utils.reader.verifyChapterFiles.invalidate({ chapterIds });
                if (onForceRefresh) onForceRefresh();
            } catch (error) {
                logger.error('[Quick Download] Refetch error:', error);
            }
        },
        onError: (error) => {
            notify({ severity: 'ERROR', title: 'Error', message: error.message || 'Failed to start volume download' });
        }
    });
}
