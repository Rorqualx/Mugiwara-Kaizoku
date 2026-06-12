/**
 * Chapter Detail Modal - Custom Hooks
 *
 * Data fetching and state management hooks for the
 * chapter detail modal component.
 *
 * Extracted from: ChapterDetailModal.tsx (lines 137-261)
 */

import { useMemo, useState } from 'react';

import { notify } from '@/utils/notify';
import { selectSmartClient } from '@/utils/smartClientSelector';
import { trpc } from '@/utils/trpc-client/index';

import type { SettingsData, SearchResult } from './types';

// ============================================================================
// Hook Parameter & Result Types
// ============================================================================

interface UseChapterModalDataParams {
  opened: boolean;
  activeTab: string | null;
  searchQuery: string;
  mangaId: number;
  chapterId: number | undefined;
}

interface UseChapterModalDataResult {
  // Settings
  enabledClients: Array<{ value: string; label: string }>;

  // Search
  searchProwlarrQuery: ReturnType<typeof trpc.manga.searchProwlarr.useQuery>;

  // Download
  downloadingGuid: string | null;
  setDownloadingGuid: (guid: string | null) => void;
  handleDownload: (result: SearchResult) => void;

  // History
  downloadHistory: unknown[];
  mangaDownloadHistory: unknown[];
  downloadHistoryQuery: ReturnType<typeof trpc.manga.getChapterDownloadHistory.useQuery>;
  mangaDownloadHistoryQuery: ReturnType<typeof trpc.manga.getMangaDownloadHistory.useQuery>;
}

// ============================================================================
// Custom Hooks
// ============================================================================

/**
 * Hook to manage all data fetching and mutations for the chapter detail modal.
 *
 * Encapsulates:
 * - Settings query for enabled clients
 * - Prowlarr search query
 * - Download mutation
 * - Download history queries
 */
export function useChapterModalData({
  opened,
  activeTab,
  searchQuery,
  mangaId,
  chapterId
}: UseChapterModalDataParams): UseChapterModalDataResult {
  const [downloadingGuid, setDownloadingGuid] = useState<string | null>(null);

  // Get settings for enabled clients
  const { data: settings } = trpc.settings.get.useQuery({ key: "all" });

  // Get enabled clients
  const enabledClients = useMemo((): Array<{ value: string; label: string }> => {
    const clients: Array<{ value: string; label: string }> = [];

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

  // Prowlarr search query - enable when on search tab with valid query
  const searchProwlarrQuery = trpc.manga.searchProwlarr.useQuery(
    {
      query: searchQuery,
      mangaId
    },
    {
      // Auto-enable when modal is open, on search tab, and we have a valid query
      enabled: opened && activeTab === 'search' && !!searchQuery && !!mangaId,
      refetchOnWindowFocus: false,
      refetchOnMount: false
    }
  );

  // Download from Prowlarr mutation
  const downloadMutation = trpc.manga.downloadFromProwlarr.useMutation({
    onSuccess: () => {
      setDownloadingGuid(null); // Clear loading state
      notify({ severity: 'SUCCESS', title: 'Download Started', message: 'Download queued successfully' });
    },
    onError: (error) => {
      setDownloadingGuid(null); // Clear loading state
      notify({ severity: 'ERROR', title: 'Download Failed', message: error.message });
    }
  });

  // Handle download function
  const handleDownload = (result: SearchResult): void => {
    if (!mangaId) {
      notify({ severity: 'ERROR', title: 'Download Failed', message: 'Manga ID not found' });
      return;
    }

    // Set this result as downloading
    setDownloadingGuid(result.guid);

    // Smart client selection with load balancing
    const clientType = selectSmartClient(result.protocol ?? 'torrent', enabledClients);

    const mutationInput = {
      mangaId,
      prowlarrId: result.guid,
      clientType,
      prowlarrResult: result // Pass full result to backend
    };

    downloadMutation.mutate(mutationInput);
  };

  // Download history query
  const downloadHistoryQuery = trpc.manga.getChapterDownloadHistory.useQuery(
    { chapterId: chapterId ?? 0 },
    {
      enabled: opened && !!chapterId,
      refetchOnWindowFocus: false,
      refetchOnMount: false
    }
  );

  const downloadHistory = downloadHistoryQuery.data ?? [];

  // Manga-level download history query (for pack/volume downloads)
  const mangaDownloadHistoryQuery = trpc.manga.getMangaDownloadHistory.useQuery(
    { mangaId },
    {
      enabled: opened && !!mangaId,
      refetchOnWindowFocus: false,
      refetchOnMount: false
    }
  );

  const mangaDownloadHistory = mangaDownloadHistoryQuery.data ?? [];

  return {
    enabledClients,
    searchProwlarrQuery,
    downloadingGuid,
    setDownloadingGuid,
    handleDownload,
    downloadHistory,
    mangaDownloadHistory,
    downloadHistoryQuery,
    mangaDownloadHistoryQuery
  };
}
