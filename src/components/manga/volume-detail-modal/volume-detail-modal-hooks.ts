/**
 * Volume Detail Modal Hooks
 *
 * Custom hooks for managing state, queries, and mutations
 * in the VolumeDetailModal component.
 */

import { useMemo, useState, useCallback } from 'react';

import { notifications } from '@mantine/notifications';

import type { TransmissionConfig, DelugeConfig, NZBGetConfig } from '@/types/config.types';
import type { QuickDownloadResponse } from '@/types/quickDownload.types';
import { notify } from '@/utils/notify';
import { mapSummaryToNotification } from '@/utils/quickDownload/notification-mapping';
import { selectSmartClient } from '@/utils/smartClientSelector';
import { trpc } from '@/utils/trpc-client';

// ============================================================================
// Local Types
// ============================================================================

/**
 * Settings data structure returned from API
 */
interface SettingsData {
  transmission?: TransmissionConfig;
  deluge?: DelugeConfig;
  nzbget?: NZBGetConfig;
  qbittorrent?: { enabled: boolean; host?: string; port?: number; username?: string; password?: string };
  [key: string]: unknown;
}

/**
 * Search result type for Prowlarr results
 */
interface SearchResult {
  guid: string;
  protocol?: string;
  publishDate: string;
  title: string;
  indexerName: string;
  size: number;
  seeders?: number;
  leechers?: number;
  infoUrl?: string;
  languages?: string[];
  audioLanguage?: string;
  isMultiLanguage?: boolean;
  isOfficial?: boolean;
  quality?: string;
  format?: string;
  publisher?: string;
}

/**
 * Enabled client option
 */
interface EnabledClient {
  value: string;
  label: string;
}

// ============================================================================
// Bookmark Hook
// ============================================================================

interface UseVolumeBookmarkResult {
  isBookmarked: boolean;
  toggle: () => void;
  isPending: boolean;
}

/**
 * Hook for managing volume bookmark state and mutations
 */
export function useVolumeBookmark(
  mangaId: number | undefined,
  volumeNumber: number | undefined
): UseVolumeBookmarkResult {
  const utils = trpc.useUtils();

  const { data: bookmarkedVolumeNumbers = [] } = trpc.manga.getBookmarkedVolumes.useQuery(
    { mangaId: mangaId ?? 0 },
    { enabled: !!mangaId && volumeNumber !== undefined }
  );

  const toggleMutation = trpc.manga.toggleVolumeBookmark.useMutation({
    onSuccess: (): void => {
      void utils.manga.getBookmarkedVolumes.invalidate({ mangaId: mangaId ?? 0 });
    }
  });

  const isBookmarked = volumeNumber !== undefined
    ? bookmarkedVolumeNumbers.includes(volumeNumber)
    : false;

  const toggle = useCallback((): void => {
    if (!mangaId || volumeNumber === undefined) return;

    void toggleMutation.mutate({
      mangaId,
      volumeNumber,
      bookmarked: !isBookmarked
    });
  }, [mangaId, volumeNumber, isBookmarked, toggleMutation]);

  return {
    isBookmarked,
    toggle,
    isPending: toggleMutation.isPending
  };
}

// ============================================================================
// Enabled Clients Hook
// ============================================================================

/**
 * Hook for fetching and computing enabled download clients
 */
export function useEnabledClients(): EnabledClient[] {
  const { data: settings } = trpc.settings.get.useQuery({ key: "all" });

  return useMemo((): EnabledClient[] => {
    const clients: EnabledClient[] = [];

    if (settings) {
      const settingsData = settings as SettingsData;

      if (settingsData.transmission?.enabled) {
        clients.push({ value: 'transmission', label: 'Transmission' });
      }
      if (settingsData.deluge?.enabled) {
        clients.push({ value: 'deluge', label: 'Deluge' });
      }
      if (settingsData.qbittorrent?.enabled) {
        clients.push({ value: 'qbittorrent', label: 'qBittorrent' });
      }
      if (settingsData.nzbget?.enabled) {
        clients.push({ value: 'nzbget', label: 'NZBGet' });
      }
    }

    return clients;
  }, [settings]);
}

// ============================================================================
// Quick Download Hook
// ============================================================================

interface UseQuickDownloadResult {
  download: (mangaId: number, volumeNumber: number) => void;
  isPending: boolean;
}

/**
 * Hook for quick download mutations with auto-search
 */
export function useQuickDownload(): UseQuickDownloadResult {
  const mutation = trpc.manga.quickDownloadWithSearch.useMutation({
    onSuccess: (data): void => {
      const typedData = data as QuickDownloadResponse;
      const firstResult = typedData.results.find(r => r.status === 'STARTED');
      notifications.show(mapSummaryToNotification(typedData.summary, {
        startedTitle: 'Volume Quick Download Started',
        ...(firstResult?.releaseTitle !== undefined ? { firstReleaseTitle: firstResult.releaseTitle } : {}),
        ...(firstResult?.indexer !== undefined ? { firstIndexer: firstResult.indexer } : {}),
      }));
    },
    onError: (error): void => {
      notify({ severity: 'ERROR', title: 'Error', message: error.message });
    }
  });

  const download = useCallback((mangaId: number, volumeNumber: number): void => {
    notifications.show({
      id: `quick-download-volume-${volumeNumber}`,
      title: 'Searching...',
      message: 'Auto-searching Prowlarr for best volume release...',
      loading: true,
      autoClose: false
    });

    void mutation.mutate({
      mangaId,
      volumeNumber,
      mode: 'VOLUME'
    }, {
      onSettled: (): void => {
        notifications.hide(`quick-download-volume-${volumeNumber}`);
      }
    });
  }, [mutation]);

  return {
    download,
    isPending: mutation.isPending
  };
}

// ============================================================================
// Prowlarr Search Hook
// ============================================================================

interface UseProwlarrSearchResult {
  data: SearchResult[] | undefined;
  isLoading: boolean;
  error: { message: string } | null;
}

/**
 * Hook for Prowlarr search queries
 */
export function useProwlarrSearch(
  query: string,
  mangaId: number | undefined,
  enabled: boolean
): UseProwlarrSearchResult {
  const searchQuery = trpc.manga.searchProwlarr.useQuery(
    {
      query,
      mangaId: mangaId ?? 0
    },
    {
      enabled: enabled && !!query && !!mangaId,
      refetchOnWindowFocus: false,
      refetchOnMount: false
    }
  );

  return {
    data: searchQuery.data as SearchResult[] | undefined,
    isLoading: searchQuery.isLoading,
    error: searchQuery.error ? { message: searchQuery.error.message } : null
  };
}

// ============================================================================
// Download from Prowlarr Hook
// ============================================================================

interface UseDownloadFromProwlarrResult {
  download: (result: SearchResult) => void;
  downloadingGuid: string | null;
}

/**
 * Hook for downloading from Prowlarr search results
 */
export function useDownloadFromProwlarr(
  mangaId: number | undefined,
  enabledClients: EnabledClient[]
): UseDownloadFromProwlarrResult {
  const [downloadingGuid, setDownloadingGuid] = useState<string | null>(null);

  const mutation = trpc.manga.downloadFromProwlarr.useMutation({
    onSuccess: (): void => {
      setDownloadingGuid(null);
      notify({ severity: 'SUCCESS', title: 'Download Started', message: 'Download queued successfully' });
    },
    onError: (error): void => {
      setDownloadingGuid(null);
      notify({ severity: 'ERROR', title: 'Download Failed', message: error.message });
    }
  });

  const download = useCallback((result: SearchResult): void => {
    if (!mangaId) {
      notify({ severity: 'ERROR', title: 'Download Failed', message: 'Manga ID not found' });
      return;
    }

    setDownloadingGuid(result.guid);

    const clientType = selectSmartClient(result.protocol ?? 'torrent', enabledClients);

    void mutation.mutate({
      mangaId,
      prowlarrId: result.guid,
      clientType,
      prowlarrResult: result
    });
  }, [mangaId, enabledClients, mutation]);

  return {
    download,
    downloadingGuid
  };
}
