/**
 * Bulk download modal for downloading multiple chapters
 *
 * Features:
 * - Smart method selection (Prowlarr)
 * - Format selection for downloads
 * - Download client selection for Prowlarr
 * - Chapter range display
 * - Progress tracking
 *
 * @module BulkDownloadModal
 */
import React, { useState, useEffect, useMemo } from 'react';

import { Modal, Stack, SegmentedControl, Select, Button, Alert, Paper, Text, Group, Badge, Center, Box, LoadingOverlay } from '@mantine/core';
import { DownloadMethod } from '@prisma/client';
import { IconCloud, IconDownload, IconInfoCircle } from '@tabler/icons-react';


import type { TransmissionConfig, DelugeConfig, NZBGetConfig } from '@/types/config.types';
import type { MangaWithRelations } from '@/types/search.types';
import { getChapterRanges } from '@/utils/formatters';
import { toNumberId } from '@/utils/id-converters';
import { notify } from '@/utils/notify';
import { trpc } from '@/utils/trpc-client/index';



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
 * Props for the BulkDownloadModal component
 */
interface BulkDownloadModalProps {
  opened: boolean;
  onClose: () => void;
  manga: MangaWithRelations;
  chapterIds: number[];
}

/**
 * Helper to get enabled download clients from settings
 */
function getEnabledClients(settings: SettingsData): Array<{
  value: string;
  label: string;
}> {
  const clients: Array<{value: string; label: string}> = [];

  if (settings.transmission?.enabled) {
    clients.push({
      value: 'transmission',
      label: 'Transmission'
    });
  }
  if (settings.deluge?.enabled) {
    clients.push({
      value: 'deluge',
      label: 'Deluge'
    });
  }
  if (settings.nzbget?.enabled) {
    clients.push({
      value: 'nzbget',
      label: 'NZBGet'
    });
  }
  if (settings.qbittorrent?.enabled) {
    clients.push({
      value: 'qbittorrent',
      label: 'qBittorrent'
    });
  }

  return clients;
}

/**
 * Bulk download modal component
 */
export function BulkDownloadModal({
  opened,
  onClose,
  manga,
  chapterIds
}: BulkDownloadModalProps): React.ReactElement {
  const [method, setMethod] = useState<DownloadMethod | undefined>();
  const [clientType, setClientType] = useState('transmission');

  // Fetch settings
  const {
    data: settings
  } = trpc.settings.get.useQuery({
    key: "all"
  });

  // Download mutation
  const downloadMutation = trpc.manga.bulkDownload.useMutation({
    onSuccess: _result => {
      notify({ severity: 'SUCCESS', title: 'Downloads Started', message: `Downloading ${chapterIds.length} chapters` });
      onClose();
    },
    onError: error => {
      notify({ severity: 'ERROR', title: 'Download Failed', message: (error instanceof Error ? error.message : String(error)) });
    }
  });

  // Extract complex expressions to avoid exhaustive-deps warnings
  const mangaSource = manga.source;
  const mangaChapters = manga.Chapter;

  // Auto-select method based on availability
  useEffect(() => {
    if (!method) {
      // Mangal is deprecated, check Prowlarr only
      // Check if Prowlarr is configured (has base URL and API key)
      if (settings) {
        const settingsData = settings as SettingsData;
        if (settingsData.prowlarrBaseURL && settingsData.prowlarrApiKey) {
          setMethod(DownloadMethod.PROWLARR); // Use PROWLARR for Prowlarr downloads
        }
      }
    }
  }, [mangaSource, settings, method]);

  // Get chapter objects
  const selectedChapters = useMemo(() => {
    return mangaChapters.filter(ch => chapterIds.includes(toNumberId(ch.id)));
  }, [mangaChapters, chapterIds]);

  // Get chapter ranges for display
  const chapterRanges = useMemo(() => {
    const chaptersWithNumericIds = mangaChapters.map(ch => ({
      id: toNumberId(ch.id),
      index: ch.index
    }));
    return getChapterRanges(chapterIds, chaptersWithNumericIds);
  }, [chapterIds, mangaChapters]);
  const enabledClients = useMemo(() => {
    if (settings) {
      return getEnabledClients(settings as SettingsData);
    }
    return [];
  }, [settings]);
  const handleDownload = (): void => {
    if (!method) return;
    void downloadMutation.mutateAsync({
      mangaId: toNumberId(manga.id),
      chapterIds,
      method: method as 'PROWLARR' | 'DIRECT_URL',
      clientType: method === DownloadMethod.PROWLARR ? clientType : undefined,
      format: undefined // Mangal deprecated - format selection removed
    });
  };
  return <Modal opened={opened} onClose={onClose} title={`Download ${chapterIds.length} Chapters`} size="md">

      <LoadingOverlay visible={downloadMutation.isPending} />
      
      <Stack>
        {/* Method Selection */}
        <SegmentedControl value={method ?? DownloadMethod.PROWLARR} onChange={value => setMethod(value as DownloadMethod)} data={[
      // Mangal option removed - deprecated
      {
        value: DownloadMethod.PROWLARR,
        label: <Center>
                  <IconCloud size={16} />
                  <Box ml={10}>Download Client</Box>
                </Center>,
        disabled: !settings || !(settings as SettingsData).prowlarrBaseURL || !(settings as SettingsData).prowlarrApiKey
      }]} />


        {/* Method-specific options */}
        {/* Mangal deprecated - format selection removed */}

        {method === DownloadMethod.TORRENT && <>
            <Select label="Download Client" value={clientType} onChange={value => setClientType(value ?? 'transmission')} data={enabledClients} disabled={enabledClients.length === 0} />

            
            {enabledClients.length === 0 && <Alert icon={<IconInfoCircle />} color="red">
                No download clients are configured. Please configure a download client in settings.
              </Alert>}
            
            {enabledClients.length > 0 && <Alert icon={<IconInfoCircle />} color="blue">
                Will search for packs containing these chapters via Prowlarr
              </Alert>}
          </>}
        
        {/* Chapter Summary */}
        <Paper p="md" withBorder>
          <Text size="sm" fw={500} mb="xs">
            Chapters to Download:
          </Text>
          <Group gap="xs">
            {chapterRanges.map(range => <Badge key={range} variant="light">
                {range}
              </Badge>)}
          </Group>
          {selectedChapters.length > 0 && <Text size="xs" c="dimmed" mt="xs">
              Total size: {selectedChapters.filter(ch => ch.size).reduce((sum, ch) => sum + ch.size, 0).toLocaleString()} bytes
            </Text>}
        </Paper>
        
        {/* Download Button */}
        <Button fullWidth leftSection={<IconDownload />} onClick={handleDownload} loading={downloadMutation.isPending} disabled={!method || method === DownloadMethod.PROWLARR && enabledClients.length === 0}>

          Start Download
        </Button>
      </Stack>
    </Modal>;
}