/**
 * Centralized State Management Hook for Manga Detail Page
 *
 * This hook aggregates all state management, data fetching, and derived state
 * for the manga detail page component. It serves as a single source of truth
 * for all page-level state.
 *
 * @module hooks/manga/useMangaDetailPageState
 */

import React from 'react';

import { useRouter } from 'next/router';

import {
  useMangaDetailModals,
  useMangaDetailData,
  useMangaMetadataExtraction,
  useMangaProviderCheck,
  useMangaDetailMutations
} from '@/hooks/manga';
import { useManga } from '@/hooks/useManga';
import { useNotification } from '@/hooks/useNotification';
import type { MangaWithRelations } from '@/types/search.types';
import type { AsyncResult } from '@/utils/async-result';
import { toNumberId } from '@/utils/id-converters';
import { trpc } from '@/utils/trpc-client';

/**
 * Return type for useMangaDetailPageState hook
 */
export interface MangaDetailPageState {
  // Modal and UI state
  modals: ReturnType<typeof useMangaDetailModals>;

  // Router and navigation
  router: ReturnType<typeof useRouter>;
  mangaId: number | undefined;

  // tRPC utils for cache management
  utils: ReturnType<typeof trpc.useUtils>;

  // Notification helpers
  showSuccess: (params: { title: string; message: string }) => void;
  showError: (params: { title: string; message: string }) => void;

  // Manga update handler
  handleUpdateManga: (mangaId: number, updates: Partial<MangaWithRelations>) => Promise<AsyncResult<unknown, Error>>;
  isLoading: boolean;

  // Refresh state
  refreshCounter: number;
  setRefreshCounter: React.Dispatch<React.SetStateAction<number>>;

  // Manga data
  manga: MangaWithRelations | null;
  loadingTimeout: boolean;
  refetch: () => Promise<void>;

  // Extracted metadata
  extractedMetadata: unknown;

  // Provider check
  isProviderBound: (providerId: string) => boolean;

  // Derived chapter statistics
  totalChapters: number;
  monitoredCount: number;
  allMonitored: boolean;
  someMonitored: boolean;
  noneMonitored: boolean;

  // Mutations
  mutations: ReturnType<typeof useMangaDetailMutations>;
}

/**
 * Centralized state management hook for the manga detail page
 *
 * Aggregates all state, data fetching, and derived values needed by the page component.
 * This reduces the complexity of the main component by centralizing state management.
 *
 * @returns Complete page state object
 */
export function useMangaDetailPageState(): MangaDetailPageState {
  // Router and ID extraction
  const router = useRouter();
  const { id } = router.query;
  const mangaId = typeof id === 'string' ? toNumberId(id) : undefined;

  // tRPC utils for cache invalidation
  const utils = trpc.useUtils();

  // Notification helpers
  const { showSuccess, showError } = useNotification();

  // Manga update handler
  const { handleUpdateManga, isLoading } = useManga();

  // Modal and expansion state
  const modals = useMangaDetailModals();

  // Refresh counter for forcing updates
  const [refreshCounter, setRefreshCounter] = React.useState(0);

  // Fetch manga data
  const { manga, loadingTimeout, refetch } = useMangaDetailData(mangaId, isLoading);

  // Extract metadata
  const extractedMetadata = useMangaMetadataExtraction(manga);

  // Provider check
  const { isProviderBound } = useMangaProviderCheck(manga);

  // Derive chapter statistics
  const totalChapters = manga?.Chapter.length ?? 0;
  const monitoredCount = manga?.Chapter.filter(ch => ch.monitored).length ?? 0;
  const allMonitored = totalChapters > 0 && monitoredCount === totalChapters;
  const someMonitored = monitoredCount > 0 && monitoredCount < totalChapters;
  const noneMonitored = monitoredCount === 0;

  // Get all mutations
  const {
    toggleSeriesMonitoringMutation,
    seriesQuickDownloadMutation,
    removeMangaMutation,
    downloadMutation,
    refreshMetadataMutation,
    handleToggleMangaBookmark,
    handleSeriesQuickDownload
  } = useMangaDetailMutations({
    mangaId,
    manga,
    utils,
    refetch,
    setRefreshCounter,
    _allMonitored: allMonitored,
    _someMonitored: someMonitored,
    _noneMonitored: noneMonitored
  });

  return {
    modals,
    router,
    mangaId,
    utils,
    showSuccess,
    showError,
    handleUpdateManga,
    isLoading,
    refreshCounter,
    setRefreshCounter,
    manga,
    loadingTimeout,
    refetch,
    extractedMetadata,
    isProviderBound,
    totalChapters,
    monitoredCount,
    allMonitored,
    someMonitored,
    noneMonitored,
    mutations: {
      toggleSeriesMonitoringMutation,
      seriesQuickDownloadMutation,
      removeMangaMutation,
      downloadMutation,
      refreshMetadataMutation,
      handleToggleMangaBookmark,
      handleSeriesQuickDownload
    }
  };
}
