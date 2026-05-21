/**
 * Pack search modal for finding and downloading manga packs via Prowlarr
 *
 * Features:
 * - Search for manga packs through Prowlarr indexers
 * - Sortable table view with resizable columns
 * - Display pack information (size, seeders, chapters included)
 * - Highlight packs containing missing chapters
 * - Click column headers to sort results
 * - One-click download to selected client
 *
 * @module PackSearchModal
 * @version 2.0 - Redesigned with DataTable
 */
import React, { useState, useMemo, useCallback } from 'react';

import { Modal, Stack, TextInput, Select, Box, ActionIcon, LoadingOverlay, Alert, Group, Text } from '@mantine/core';
import { ChapterStatus } from '@prisma/client';
import { IconSearch, IconInfoCircle } from '@tabler/icons-react';
import { DataTable } from 'mantine-datatable';

import type { TransmissionConfig, DelugeConfig, NZBGetConfig } from '@/types/config.types';
import type { MangaWithRelations } from '@/types/search.types';
import { isSuccess } from '@/utils/async-result';
import { toNumberId } from '@/utils/id-converters';
import { notify } from '@/utils/notify';
import { trpc } from '@/utils/trpc-client/index';


import { createPackSearchColumns, type PackResultWithMetadata } from './pack-search-columns';

/**
 * Settings data structure returned from API
 */
interface SettingsData {
  transmission?: TransmissionConfig;
  deluge?: DelugeConfig;
  nzbget?: NZBGetConfig;
  qbittorrent?: { enabled: boolean; host?: string; port?: number; username?: string; password?: string };
  prowlarrBaseURL?: string;
  prowlarrApiKey?: string;
  [key: string]: unknown;
}

/**
 * Backend search result from manga.searchProwlarr
 */
interface BackendSearchResult {
  id: string;
  title: string;
  indexer: string;
  size?: number;
  seeders?: number;
  leechers?: number;
  Chapter?: number[];
  publishDate?: string;
  relevanceScore?: number;
  infoUrl?: string;
  languages?: string[];
  audioLanguage?: string;
  isMultiLanguage?: boolean;
  isOfficial?: boolean;
  quality?: string;
  format?: string;
  publisher?: string;
}

// Sort status type from mantine-datatable
type SortStatus<T> = {
  columnAccessor: keyof T | string;
  direction: 'asc' | 'desc';
};
/**
 * Props for PackSearchModal
 */
interface PackSearchModalProps {
  opened: boolean;
  onClose: () => void;
  manga: MangaWithRelations;
}

/**
 * Pack search modal component
 */
export function PackSearchModal({
  opened,
  onClose,
  manga
}: PackSearchModalProps): React.ReactElement {
  // Alert when modal is opened
  React.useEffect(() => {
    if (opened) {
      alert('🔍 PACK SEARCH MODAL IS OPEN! You should see search results below.');
    }
  }, [opened]);

  const [query, setQuery] = useState(manga.title);
  const [selectedClient, setSelectedClient] = useState('transmission');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [sortStatus, setSortStatus] = useState<SortStatus<PackResultWithMetadata>>({
    columnAccessor: 'relevanceScore',
    direction: 'desc'
  });

  // Get settings
  const {
    data: settings
  } = trpc.settings.get.useQuery({
    key: "all"
  });

  // Search query
  const searchQuery = trpc.manga.searchProwlarr.useQuery({
    query,
    mangaId: toNumberId(manga.id)
  }, {
    enabled: opened && query.length > 2
  });

  // Download mutation
  const downloadMutation = trpc.manga.downloadFromProwlarr.useMutation({
    onSuccess: () => {
      notify({ severity: 'SUCCESS', title: 'Download Started', message: 'Pack has been sent to download client' });
      setDownloadingId(null);
      onClose();
    },
    onError: error => {
      notify({ severity: 'ERROR', title: 'Download Failed', message: (error instanceof Error ? error.message : String(error)) });
      setDownloadingId(null);
    }
  });

  // Get enabled clients
  const enabledClients = useMemo(() => {
    const clients: Array<{ value: string; label: string }> = [];

    if (settings && isSuccess(settings)) {
      const settingsData = settings.data as SettingsData;

      if (settingsData.transmission?.enabled) {
        clients.push({
          value: 'transmission',
          label: 'Transmission'
        });
      }
      if (settingsData.deluge?.enabled) {
        clients.push({
          value: 'deluge',
          label: 'Deluge'
        });
      }
      if (settingsData.nzbget?.enabled) {
        clients.push({
          value: 'nzbget',
          label: 'NZBGet'
        });
      }
      if (settingsData.qbittorrent?.enabled) {
        clients.push({
          value: 'qbittorrent',
          label: 'qBittorrent'
        });
      }
    }

    return clients;
  }, [settings]);

  // Calculate missing chapters for coverage calculation
  const missingChapters = useMemo(() => {
    return manga.Chapter.filter(ch => ch.downloadStatus !== ChapterStatus.COMPLETED).map(ch => ch.index);
  }, [manga]);

  // Enrich search results with metadata (coverage, etc.)
  const enrichedResults = useMemo((): PackResultWithMetadata[] => {
    if (!searchQuery.data) return [];

    return (searchQuery.data as unknown as BackendSearchResult[]).map((result) => {
      const resultChapters = result.Chapter ?? [];
      const includedMissing = resultChapters.filter((ch) => missingChapters.includes(ch));
      const coveragePercent = missingChapters.length === 0 ? 0 : Math.round(includedMissing.length / missingChapters.length * 100);

      return {
        id: result.id,
        title: result.title,
        indexer: result.indexer,
        size: result.size ?? 0,
        seeders: result.seeders ?? 0,
        leechers: result.leechers ?? 0,
        chapters: resultChapters,
        ...(result.publishDate !== undefined ? { publishDate: result.publishDate } : {}),
        coveragePercent,
        includedMissing,
        relevanceScore: result.relevanceScore ?? 0,
        ...(result.infoUrl !== undefined ? { infoUrl: result.infoUrl } : {}),

        // Include parsed metadata from backend (conditionally)
        ...(result.languages !== undefined ? { languages: result.languages } : {}),
        ...(result.audioLanguage !== undefined ? { audioLanguage: result.audioLanguage } : {}),
        ...(result.isMultiLanguage !== undefined ? { isMultiLanguage: result.isMultiLanguage } : {}),
        ...(result.isOfficial !== undefined ? { isOfficial: result.isOfficial } : {}),
        ...(result.quality !== undefined ? { quality: result.quality } : {}),
        ...(result.format !== undefined ? { format: result.format } : {}),
        ...(result.publisher !== undefined ? { publisher: result.publisher } : {})
      };
    });
  }, [searchQuery.data, missingChapters]);

  // Sort results based on sort status
  const sortedResults = useMemo(() => {
    const sorted = [...enrichedResults];

    sorted.sort((a, b) => {
      const accessor = sortStatus.columnAccessor as keyof PackResultWithMetadata;
      const aValue = a[accessor];
      const bValue = b[accessor];

      // Handle different data types
      let comparison = 0;
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        comparison = aValue - bValue;
      } else if (typeof aValue === 'string' && typeof bValue === 'string') {
        comparison = aValue.localeCompare(bValue);
      } else if (aValue === undefined) {
        comparison = 1;
      } else if (bValue === undefined) {
        comparison = -1;
      }

      return sortStatus.direction === 'desc' ? -comparison : comparison;
    });

    return sorted;
  }, [enrichedResults, sortStatus]);

  const handleSearch = (): void => {
    void searchQuery.refetch();
  };

  // Download handler with proper memoization
  const handleDownload = useCallback((record: PackResultWithMetadata): void => {
    setDownloadingId(record.id);

    // Find the full result from searchQuery.data
    const fullResult = (searchQuery.data as unknown as BackendSearchResult[] | undefined)?.find((r) => r.id === record.id);

    if (!fullResult) {
      notify({ severity: 'ERROR', title: 'Download Failed', message: 'Could not find pack data. Please try searching again.' });
      setDownloadingId(null);
      return;
    }

    const mutationInput = {
      mangaId: toNumberId(manga.id),
      prowlarrId: record.id,
      clientType: selectedClient,
      prowlarrResult: fullResult
    };

    void downloadMutation.mutate(mutationInput);
  }, [searchQuery.data, manga.id, selectedClient, downloadMutation]);

  // Define table columns with sorting configuration
  const columns = useMemo(() => {
    return createPackSearchColumns({ downloadingId, handleDownload });
  }, [downloadingId, handleDownload]);

  return <Modal
    opened={opened}
    onClose={onClose}
    title="Search Download Packs"
    size="calc(90vw)"
    styles={{
      body: { height: 'calc(100vh - 200px)' },
      content: { maxWidth: '1400px' }
    }}
  >

      <Stack>
        {/* Search Controls */}
        <Group>
          <TextInput style={{
          flex: 1
        }} label="Search Query" placeholder="Enter manga title or keywords" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => {
          if (e.key === 'Enter') {
            handleSearch();
          }
        }} rightSection={<ActionIcon onClick={handleSearch} loading={searchQuery.isLoading} disabled={query.length < 3}>

                <IconSearch size={16} />
              </ActionIcon>} />

          
          <Select label="Download Client" value={selectedClient} onChange={value => setSelectedClient(value ?? 'transmission')} data={enabledClients} disabled={enabledClients.length === 0} style={{
          width: 200
        }} />

        </Group>

        {(!settings || !isSuccess(settings) || !(settings.data as SettingsData).prowlarrBaseURL || !(settings.data as SettingsData).prowlarrApiKey) && <Alert icon={<IconInfoCircle />} color="red">
            Prowlarr is not configured. Please configure Prowlarr Base URL and API Key in Settings → Indexers.
          </Alert>}

        {settings && isSuccess(settings) && (settings.data as SettingsData).prowlarrBaseURL && (settings.data as SettingsData).prowlarrApiKey && enabledClients.length === 0 && <Alert icon={<IconInfoCircle />} color="orange">
            No download clients are configured. Please configure a download client to download packs.
          </Alert>}

        {/* Results Table */}
        <Box style={{ position: 'relative', height: 'calc(100vh - 350px)', minHeight: '400px' }}>
          <LoadingOverlay visible={searchQuery.isLoading} />

          {sortedResults.length === 0 && !searchQuery.isLoading ? (
            <Text c="dimmed" ta="center" py="xl">
              No results found. Try a different search query.
            </Text>
          ) : (
            <DataTable
              columns={columns}
              records={sortedResults}
              sortStatus={sortStatus}
              onSortStatusChange={setSortStatus}
              highlightOnHover
              striped
              minHeight={200}
              idAccessor="id"
              styles={{
                table: {
                  backgroundColor: 'var(--mantine-color-dark-7)'
                },
                header: {
                  backgroundColor: 'var(--mantine-color-dark-6)',
                  fontWeight: 600
                }
              }}
            />
          )}
        </Box>
        
        {searchQuery.error && <Alert icon={<IconInfoCircle />} color="red">
            Search failed: {searchQuery.error instanceof Error ? searchQuery.error.message : String(searchQuery.error)}
          </Alert>}
      </Stack>
    </Modal>;
}