import React, { useState, useEffect, useMemo } from 'react';

import { Modal, Stack, SegmentedControl, Select, Button, Alert, TextInput, Group, Text, Badge, Center, Box } from '@mantine/core';
import { IconDownload, IconInfoCircle, IconCloud, IconLink, IconSearch, IconBook } from '@tabler/icons-react';

import { DownloadMethod } from '@/types/search.types';
import { toNumberId } from '@/utils/id-converters';
import { notify } from '@/utils/notify';
import { trpc } from '@/utils/trpc-client/index';

import { MangaDexDownloadOptions } from './MangaDexDownloadOptions';

import type { Manga as MangaEntity } from '@prisma/client';
import type { Chapter as ChapterEntity } from '@prisma/client';

/**
 * Settings data structure returned from API
 */
interface SettingsData {
  transmissionEnabled?: boolean;
  delugeEnabled?: boolean;
  nzbgetEnabled?: boolean;
  prowlarrBaseURL?: string;
  prowlarrApiKey?: string;
  [key: string]: unknown;
}
interface DownloadOptionsModalProps {
  opened: boolean;
  onClose: () => void;
  manga: MangaEntity;
  chapters: ChapterEntity[];
}
// Extended download method to include MangaDex
type ExtendedDownloadMethod = DownloadMethod | 'MANGADEX';

// eslint-disable-next-line complexity -- Modal component handling multiple download methods (Prowlarr, GetComics, Direct URL, MangaDex) with different configuration UIs
export function DownloadOptionsModal({
  opened,
  onClose,
  manga,
  chapters
}: DownloadOptionsModalProps): React.ReactElement {
  const [method, setMethod] = useState<ExtendedDownloadMethod>(DownloadMethod.PROWLARR);
  const [clientType, setClientType] = useState('transmission');
  const [directUrl, setDirectUrl] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const {
    data: settings
  } = trpc.settings.get.useQuery({
    key: "all"
  });
  const queryClient = trpc.useUtils();

  // Check if manga has MangaDex ID from providerMetadata
  const mangadexId = useMemo(() => {
    const metadata = manga.providerMetadata as Record<string, unknown> | null;
    if (metadata?.['mangadexId']) {
      return metadata['mangadexId'] as string;
    }
    // Also check if source is mangadex and has sourceId
    if (manga.searchProvider === 'mangadex' && manga.sourceId) {
      return manga.sourceId;
    }
    return null;
  }, [manga]);

  // Download mutations
  const prowlarrDownload = trpc.manga.downloadFromProwlarr.useMutation({
    onSuccess: () => {
      notify({ severity: 'INFO', title: 'Search Started', message: 'Searching for downloads via Prowlarr' });
      void queryClient.manga.get.invalidate({
        id: toNumberId(manga["id"])
      });
      onClose();
    },
    onError: error => {
      notify({ severity: 'ERROR', title: 'Download Failed', message: (error instanceof Error ? error.message : String(error)) });
    }
  });
  const directDownload = trpc.manga.downloadFromUrl.useMutation({
    onSuccess: () => {
      notify({ severity: 'SUCCESS', title: 'Download Started', message: 'Direct download initiated' });
      void queryClient.manga.get.invalidate({
        id: toNumberId(manga["id"])
      });
      onClose();
    },
    onError: error => {
      notify({ severity: 'ERROR', title: 'Download Failed', message: (error instanceof Error ? error.message : String(error)) });
    }
  });

  // Get enabled download clients
  const enabledClients = React.useMemo(() => {
    if (!settings) return [];

    const settingsData = settings as SettingsData;
    const clients: Array<{ value: string; label: string }> = [];

    if (settingsData.transmissionEnabled) {
      clients.push({
        value: 'transmission',
        label: 'Transmission'
      });
    }
    if (settingsData.delugeEnabled) {
      clients.push({
        value: 'deluge',
        label: 'Deluge'
      });
    }
    if (settingsData.nzbgetEnabled) {
      clients.push({
        value: 'nzbget',
        label: 'NZBGet'
      });
    }
    return clients;
  }, [settings]);

  // Auto-select first available client
  useEffect(() => {
    const firstClient = enabledClients[0];
    if (enabledClients.length > 0 && firstClient !== undefined && !enabledClients.find(c => c.value === clientType)) {
      setClientType(firstClient.value);
    }
  }, [enabledClients, clientType]);
  const handleDownload = (): void => {
    if (method === DownloadMethod.PROWLARR) {
      setIsSearching(true);

      // Search and download via Prowlarr
      void prowlarrDownload.mutateAsync({
        mangaId: toNumberId(manga["id"]),
        clientType,
        prowlarrId: '' // TODO: This should be obtained from a Prowlarr search
      });
    } else if (method === DownloadMethod.DIRECT_URL && directUrl) {
      // Direct URL download
      void directDownload.mutateAsync({
        mangaId: toNumberId(manga["id"]),
        chapterIds: chapters.map(ch => toNumberId(ch["id"])),
        url: directUrl,
        clientType
      });
    }
  };
  // Check if Prowlarr is configured (has base URL and API key) instead of just the enabled flag
  const isProwlarrConfigured = Boolean(settings) &&
    !!(settings as SettingsData).prowlarrBaseURL &&
    !!(settings as SettingsData).prowlarrApiKey;
  const hasEnabledClients = enabledClients.length > 0;

  // Build method options dynamically
  const methodOptions = useMemo(() => {
    const options: Array<{ value: string; label: React.ReactNode; disabled: boolean }> = [
      {
        value: DownloadMethod.PROWLARR,
        label: <Center>
                  <IconCloud size={16} />
                  <Box ml={10}>Search Downloads</Box>
                </Center>,
        disabled: !isProwlarrConfigured || !hasEnabledClients
      },
      {
        value: DownloadMethod.DIRECT_URL,
        label: <Center>
                  <IconLink size={16} />
                  <Box ml={10}>Direct URL</Box>
                </Center>,
        disabled: !hasEnabledClients
      }
    ];

    // Add MangaDex option if manga has MangaDex ID
    if (mangadexId) {
      options.unshift({
        value: 'MANGADEX',
        label: <Center>
                  <IconBook size={16} />
                  <Box ml={10}>MangaDex</Box>
                </Center>,
        disabled: false
      });
    }

    return options;
  }, [isProwlarrConfigured, hasEnabledClients, mangadexId]);

  // Auto-select MangaDex if available and preferred
  useEffect(() => {
    if (mangadexId && method === DownloadMethod.PROWLARR) {
      setMethod('MANGADEX');
    }
  }, [mangadexId, method]);

  return <Modal opened={opened} onClose={onClose} title={`Download Options - ${chapters.length} Chapter${chapters.length > 1 ? 's' : ''}`} size="md">

      <Stack>
        {/* Method Selection */}
        <SegmentedControl value={method} onChange={value => setMethod(value as ExtendedDownloadMethod)} data={methodOptions} />

        
        {/* Method-specific options */}
        {method === DownloadMethod.PROWLARR && <>
            <Select label="Download Client" value={clientType} onChange={value => value && setClientType(value)} data={enabledClients} disabled={enabledClients.length === 0} />

            
            <Alert icon={<IconInfoCircle />} color="blue">
              Will search Prowlarr for torrents/NZBs containing these chapters and send to your download client
            </Alert>
            
            {!isProwlarrConfigured && <Alert icon={<IconInfoCircle />} color="yellow">
                Prowlarr is not configured. Please configure Base URL and API Key in Settings → Indexers.
              </Alert>}
          </>}
        
        {method === DownloadMethod.DIRECT_URL && <>
            <TextInput label="Download URL" placeholder="https://example.com/manga-download.torrent" value={directUrl} onChange={e => setDirectUrl(e.target.value)} rightSection={<IconLink size={16} />} />


            <Select label="Download Client" value={clientType} onChange={value => value && setClientType(value)} data={enabledClients} disabled={enabledClients.length === 0} />


            <Alert icon={<IconInfoCircle />} color="blue">
              Paste a direct download link (torrent, NZB, or magnet) to send to your download client
            </Alert>
          </>}

        {/* MangaDex Download Options */}
        {method === 'MANGADEX' && mangadexId && chapters.length === 1 && chapters[0]?.mangadexId && (
          <MangaDexDownloadOptions
            mangaId={toNumberId(manga["id"])}
            mangadexChapterId={chapters[0].mangadexId}
            chapterNumber={chapters[0].chapterNumber ?? chapters[0].index}
            onDownloadStarted={onClose}
          />
        )}

        {method === 'MANGADEX' && mangadexId && (chapters.length !== 1 || !chapters[0]?.mangadexId) && (
          <Alert icon={<IconInfoCircle />} color="yellow">
            {chapters.length > 1
              ? 'MangaDex download currently supports one chapter at a time. Please select a single chapter.'
              : 'This chapter does not have a MangaDex ID. It may need to be searched on MangaDex first.'}
          </Alert>
        )}

        {!hasEnabledClients && method !== 'MANGADEX' && <Alert icon={<IconInfoCircle />} color="red">
            No download clients are enabled. Please configure at least one in settings.
          </Alert>}
        
        {/* Chapter Summary */}
        <Group gap="xs">
          <Text size="sm" fw={500}>Chapters:</Text>
          {chapters.map(ch => <Badge key={ch["id"]} variant="light">
              {ch.index}
            </Badge>)}
        </Group>
        
        {/* Download Button - hidden for MangaDex since it has its own button */}
        {method !== 'MANGADEX' && (
          <Button fullWidth leftSection={isSearching ? <IconSearch size={16} /> : <IconDownload size={16} />} onClick={handleDownload} loading={prowlarrDownload.isPending || directDownload.isPending} disabled={!hasEnabledClients || method === DownloadMethod.PROWLARR && !isProwlarrConfigured || method === DownloadMethod.DIRECT_URL && !directUrl}>
            {isSearching ? 'Searching...' : 'Start Download'}
          </Button>
        )}
      </Stack>
    </Modal>;
}