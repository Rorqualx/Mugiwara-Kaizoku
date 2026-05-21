/**
 * Store Actions Hook - Main Aggregator
 *
 * Provides a unified interface for store actions across multiple slices.
 * Aggregates handlers from decomposed modules while maintaining backward compatibility.
 *
 * Architecture:
 * - useStoreActions/types.ts - Type definitions (0 handlers)
 * - useStoreActions/type-guards.ts - Validation functions (0 handlers)
 * - useStoreActions/mutations.ts - Mutation setup (0 handlers)
 * - useStoreActions/handlers/update-manga.ts - Update handler (1 handler)
 * - useStoreActions/handlers/download.ts - Download handler (1 handler)
 * - useStoreActions/handlers/sync.ts - Sync handler (1 handler)
 * - useStoreActions/handlers/settings.ts - Settings handler (1 handler)
 *
 * Total: 4 handlers across 7 modules
 * Original: 526 lines -> Refactored: ~100 lines (81% reduction)
 *
 * @module store/useStoreActions
 */

import { useNotification } from '@/hooks/useNotification';

import {
  useMangaStore,
  useDownloadQueueStore,
  useUIStore,
  useLibraryStore,
  useIntegrationStore,
  useSyncStore,
} from '../index';

// Import types for re-export

// Import mutation hook

// Import handler factories
import { useDownloadHandler } from './handlers/download';
import { useUpdateSettingsHandler } from './handlers/settings';
import { useSyncHandler } from './handlers/sync';
import { useUpdateMangaHandler } from './handlers/update-manga';
import { useStoreActionsMutations } from './mutations';

import type { UseStoreActionsReturn } from './types';

// Re-export types for consumers
export type {
  MangaWithRelations,
  UpdatedManga,
  IntegrationSettingKey,
  SettingsUpdateInput,
  UseStoreActionsReturn,
} from './types';

export { isValidMetadata, isRecord } from './type-guards';
export type { ValidMetadata } from './type-guards';

/**
 * Combined store actions hook
 *
 * Provides a unified interface for interacting with the application state.
 * Combines actions from multiple store slices and adds API integration.
 *
 * @returns Combined store actions with handlers
 *
 * @example
 * ```typescript
 * const {
 *   handleUpdateManga,
 *   handleDownload,
 *   handleSync
 * } = useStoreActions();
 *
 * await handleUpdateManga(123, { title: 'New Title' });
 * await handleDownload(123, [1, 2, 3]);
 * ```
 */
export function useStoreActions(): UseStoreActionsReturn {
  const { showSuccess, showError } = useNotification();

  // Store actions
  const mangaActions = useMangaStore();
  const queueActions = useDownloadQueueStore();
  const uiActions = useUIStore();
  const libraryActions = useLibraryStore();
  const integrationActions = useIntegrationStore();
  const syncActions = useSyncStore();

  // Get mutations
  const { updateMangaMutation, downloadMutation, syncMutation, settingsMutation } =
    useStoreActionsMutations();

  // Create handlers with dependencies
  // Cast mutation to expected type since tRPC mutation result includes additional properties
  const handleUpdateManga = useUpdateMangaHandler({
    updateMangaMutation: updateMangaMutation as Parameters<typeof useUpdateMangaHandler>[0]['updateMangaMutation'],
    mangaActions,
    uiActions,
    showSuccess,
    showError,
  });

  const handleDownload = useDownloadHandler({
    downloadMutation,
    queueActions,
    showError,
  });

  const handleSync = useSyncHandler({
    syncMutation,
    syncActions,
    showError,
  });

  const handleUpdateSettings = useUpdateSettingsHandler({
    settingsMutation,
    integrationActions,
    showError,
  });

  // Return combined actions
  return {
    // Spread all store actions
    ...mangaActions,
    ...queueActions,
    ...uiActions,
    ...libraryActions,
    ...integrationActions,
    ...syncActions,
    // Combined handlers
    handleUpdateManga,
    handleDownload,
    handleSync,
    handleUpdateSettings,
  };
}
