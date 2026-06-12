/**
 * Unified Search Modal Component
 *
 * A single search modal that adapts to context (manga, volume, or chapter).
 * Features:
 * - Context-aware search query prefill
 * - Sortable DataTable with search results
 * - Coverage % calculation for each result
 * - Quality/format indicators
 * - One-click download to selected client
 *
 * @module UnifiedSearchModal
 */

import * as React from 'react';
import { useState, useMemo, useCallback, useEffect } from 'react';

import {
  Modal,
  Stack,
  TextInput,
  Select,
  Box,
  ActionIcon,
  LoadingOverlay,
  Alert,
  Group,
  Text,
} from '@mantine/core';
import { ChapterStatus } from '@prisma/client';
import { IconSearch, IconInfoCircle } from '@tabler/icons-react';
import { DataTable } from 'mantine-datatable';

import { toNumberId } from '@/utils/id-converters';
import { notify } from '@/utils/notify';
import { trpc } from '@/utils/trpc-client/index';


import {
  getInitialQuery,
  getModalTitle,
  getMissingChapters,
  type SortStatus,
  type SettingsData,
  type BackendSearchResult,
  type EnrichedSearchResult,
  type UnifiedSearchModalProps,
} from './search-modal-types';
import { useSearchResultsColumns } from './SearchResultsColumns';

export type { UnifiedSearchModalProps };

/**
 * Unified Search Modal Component
 */
export function UnifiedSearchModal({
  opened,
  onClose,
  context,
  onSuccess,
}: UnifiedSearchModalProps): React.ReactElement {
  const [query, setQuery] = useState(() => getInitialQuery(context));
  const [selectedClient, setSelectedClient] = useState('transmission');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [sortStatus, setSortStatus] = useState<SortStatus<EnrichedSearchResult>>({
    columnAccessor: 'relevanceScore',
    direction: 'desc',
  });

  // Reset query when context changes
  useEffect(() => {
    if (opened) {
      setQuery(getInitialQuery(context));
    }
  }, [opened, context]);

  // Get settings
  const { data: settings } = trpc.settings.get.useQuery({ key: 'all' });
  const queryClient = trpc.useUtils();

  // Search query
  const searchQuery = trpc.manga.searchProwlarr.useQuery(
    {
      query,
      mangaId: toNumberId(context.manga.id),
    },
    {
      enabled: opened && query.length > 2,
    }
  );

  // Download mutation
  const downloadMutation = trpc.manga.downloadFromProwlarr.useMutation({
    onSuccess: () => {
      notify({ severity: 'SUCCESS', title: 'Download Started', message: 'Download has been sent to client' });
      setDownloadingId(null);
      void queryClient.manga.get.invalidate({ id: toNumberId(context.manga.id) });
      onSuccess?.();
      onClose();
    },
    onError: (error) => {
      notify({ severity: 'ERROR', title: 'Download Failed', message: error instanceof Error ? error.message : String(error) });
      setDownloadingId(null);
    },
  });

  // Get enabled clients
  const enabledClients = useMemo(() => {
    const clients: Array<{ value: string; label: string }> = [];

    if (settings) {
      const settingsData = settings as SettingsData;

      if (settingsData.transmission?.enabled) {
        clients.push({ value: 'transmission', label: 'Transmission' });
      }
      if (settingsData.deluge?.enabled) {
        clients.push({ value: 'deluge', label: 'Deluge' });
      }
      if (settingsData.nzbget?.enabled) {
        clients.push({ value: 'nzbget', label: 'NZBGet' });
      }
      if (settingsData.qbittorrent?.enabled) {
        clients.push({ value: 'qbittorrent', label: 'qBittorrent' });
      }
    }

    return clients;
  }, [settings]);

  // Check configuration
  const isProwlarrConfigured = useMemo(() => {
    if (!settings) return false;
    const settingsData = settings as SettingsData;
    return !!(settingsData.prowlarrBaseURL && settingsData.prowlarrApiKey);
  }, [settings]);

  // Calculate missing chapters
  const missingChapters = useMemo(
    () => getMissingChapters(context, ChapterStatus.COMPLETED),
    [context]
  );

  // Enrich search results with metadata
  const enrichedResults = useMemo((): EnrichedSearchResult[] => {
    if (!searchQuery.data) return [];

    return (searchQuery.data as unknown as BackendSearchResult[]).map((result) => {
      const resultChapters = result.Chapter ?? [];
      const includedMissing = resultChapters.filter((ch) => missingChapters.includes(ch));
      const coveragePercent =
        missingChapters.length === 0
          ? 0
          : Math.round((includedMissing.length / missingChapters.length) * 100);

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
        ...(result.languages !== undefined ? { languages: result.languages } : {}),
        ...(result.audioLanguage !== undefined ? { audioLanguage: result.audioLanguage } : {}),
        ...(result.isMultiLanguage !== undefined ? { isMultiLanguage: result.isMultiLanguage } : {}),
        ...(result.isOfficial !== undefined ? { isOfficial: result.isOfficial } : {}),
        ...(result.quality !== undefined ? { quality: result.quality } : {}),
        ...(result.format !== undefined ? { format: result.format } : {}),
        ...(result.publisher !== undefined ? { publisher: result.publisher } : {}),
      };
    });
  }, [searchQuery.data, missingChapters]);

  // Sort results
  const sortedResults = useMemo(() => {
    const sorted = [...enrichedResults];

    sorted.sort((a, b) => {
      const accessor = sortStatus.columnAccessor as keyof EnrichedSearchResult;
      const aValue = a[accessor];
      const bValue = b[accessor];

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

  // Handle search
  const handleSearch = (): void => {
    void searchQuery.refetch();
  };

  // Handle download
  const handleDownload = useCallback(
    (record: EnrichedSearchResult): void => {
      setDownloadingId(record.id);

      const fullResult = (searchQuery.data as unknown as BackendSearchResult[] | undefined)?.find(
        (r) => r.id === record.id
      );

      if (!fullResult) {
        notify({ severity: 'ERROR', title: 'Download Failed', message: 'Could not find result data. Please try searching again.' });
        setDownloadingId(null);
        return;
      }

      // Add chapterId if we're in chapter context
      const chapterId = context.type === 'chapter' ? toNumberId(context.chapter.id) : undefined;

      void downloadMutation.mutate({
        mangaId: toNumberId(context.manga.id),
        prowlarrId: record.id,
        clientType: selectedClient,
        prowlarrResult: fullResult,
        ...(chapterId !== undefined ? { chapterId } : {}),
      });
    },
    [searchQuery.data, context, selectedClient, downloadMutation]
  );

  // Table columns
  const columns = useSearchResultsColumns({
    downloadingId,
    onDownload: handleDownload,
    canDownload: enabledClients.length > 0,
  });

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={getModalTitle(context)}
      size="calc(90vw)"
      styles={{
        body: { height: 'calc(100vh - 200px)' },
        content: { maxWidth: '1400px' },
      }}
    >
      <Stack>
        {/* Search Controls */}
        <Group>
          <TextInput
            style={{ flex: 1 }}
            placeholder="Search for downloads..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSearch();
            }}
            rightSection={
              <ActionIcon
                onClick={handleSearch}
                loading={searchQuery.isLoading}
                disabled={query.length < 3}
              >
                <IconSearch size={16} />
              </ActionIcon>
            }
          />

          <Select
            value={selectedClient}
            onChange={(value) => setSelectedClient(value ?? 'transmission')}
            data={enabledClients}
            disabled={enabledClients.length === 0}
            style={{ width: 180 }}
            placeholder="Select client"
          />
        </Group>

        {/* Configuration Alerts */}
        {!isProwlarrConfigured && (
          <Alert icon={<IconInfoCircle />} color="red">
            Prowlarr is not configured. Please configure it in Settings → Indexers.
          </Alert>
        )}

        {isProwlarrConfigured && enabledClients.length === 0 && (
          <Alert icon={<IconInfoCircle />} color="orange">
            No download clients are configured. Please configure one in Settings.
          </Alert>
        )}

        {/* Results Table */}
        <Box style={{ position: 'relative', height: 'calc(100vh - 350px)', minHeight: '400px' }}>
          <LoadingOverlay visible={searchQuery.isLoading} />

          {sortedResults.length === 0 && !searchQuery.isLoading ? (
            <Text c="dimmed" ta="center" py="xl">
              {query.length < 3
                ? 'Enter at least 3 characters to search'
                : 'No results found. Try a different search query.'}
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
                table: { backgroundColor: 'var(--mantine-color-dark-7)' },
                header: { backgroundColor: 'var(--mantine-color-dark-6)', fontWeight: 600 },
              }}
            />
          )}
        </Box>

        {/* Error Alert */}
        {searchQuery.error && (
          <Alert icon={<IconInfoCircle />} color="red">
            Search failed:{' '}
            {searchQuery.error instanceof Error
              ? searchQuery.error.message
              : String(searchQuery.error)}
          </Alert>
        )}
      </Stack>
    </Modal>
  );
}

export default UnifiedSearchModal;
