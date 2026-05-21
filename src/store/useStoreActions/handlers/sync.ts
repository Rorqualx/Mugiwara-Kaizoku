/**
 * Sync Handler
 *
 * Synchronizes manga data with external sources.
 *
 * Extracted from: useStoreActions.ts (lines 448-463)
 */

import { useCallback } from 'react';

/**
 * Dependencies for the sync handler
 */
interface SyncDependencies {
  syncMutation: {
    mutateAsync: (params: { id: number }) => Promise<unknown>;
  };
  syncActions: {
    addSyncTask: (mangaId: number) => void;
  };
  showError: (opts: { title: string; message: string }) => void;
}

/**
 * Creates the handleSync callback
 *
 * Handles manga synchronization with:
 * - Task tracking
 * - API integration
 * - Error handling
 *
 * @param deps - Dependencies for the sync handler
 * @returns Callback function to sync manga data
 */
export function useSyncHandler(
  deps: SyncDependencies
): (mangaId: number) => Promise<void> {
  const { syncMutation, syncActions, showError } = deps;

  return useCallback(
    async (mangaId: number) => {
      try {
        // Update the sync status in the UI
        syncActions.addSyncTask(mangaId);

        // Call the API to fix out of sync chapters
        await syncMutation.mutateAsync({
          id: mangaId
        });
      } catch (error: unknown) {
        showError({
          title: 'Sync Failed',
          message:
            error instanceof Error
              ? error instanceof Error
                ? error.message
                : String(error)
              : 'Unknown error'
        });
      }
    },
    [syncMutation, syncActions, showError]
  );
}
