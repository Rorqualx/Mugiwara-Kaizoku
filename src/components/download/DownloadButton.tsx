/**
 * Unified Download Button Component
 *
 * A dropdown button that provides consistent download actions across the app:
 * - Quick Download: Auto-search and download best match
 * - Search Downloads: Open search modal to browse and select
 * - Direct URL: Paste a download link
 *
 * Works for manga, volume, and chapter level downloads.
 *
 * @module DownloadButton
 */

import * as React from 'react';
import { useState, useMemo } from 'react';

import { Button, Menu, Text, Loader, Badge } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { ChapterStatus } from '@prisma/client';
import {
  IconDownload,
  IconChevronDown,
  IconPlayerPlay,
  IconSearch,
  IconLink,
  IconCheck,
  IconSettings,
  IconBook,
} from '@tabler/icons-react';

import { MangaDexDownloadOptions } from '@/components/manga/MangaDexDownloadOptions';
import { isSuccess } from '@/utils/async-result';
import { toNumberId } from '@/utils/id-converters';
import { notify } from '@/utils/notify';
import { mapSummaryToNotification } from '@/utils/quickDownload/notification-mapping';
import { trpc } from '@/utils/trpc-client/index';


import { DirectUrlModal } from './DirectUrlModal';

import type { Manga as MangaEntity } from '@prisma/client';
import type { Chapter as ChapterEntity } from '@prisma/client';

// Extended chapter type that includes mangadexId
type ChapterWithMangaDex = ChapterEntity & { mangadexId?: string | null };

/**
 * Download context - what level of content we're downloading
 */
export type DownloadContext =
  | { type: 'manga'; manga: MangaEntity }
  | { type: 'volume'; manga: MangaEntity; volumeNumber: number; chapters: ChapterEntity[] }
  | { type: 'chapter'; manga: MangaEntity; chapter: ChapterEntity };

/**
 * Props for the DownloadButton component
 */
export interface DownloadButtonProps {
  /** The download context (manga, volume, or chapter) */
  context: DownloadContext;
  /** Callback when search modal should open */
  onOpenSearch?: (() => void) | undefined;
  /** Callback when download completes successfully */
  onSuccess?: (() => void) | undefined;
  /** Button size variant */
  size?: 'xs' | 'sm' | 'md' | 'lg';
  /** Button variant */
  variant?: 'filled' | 'light' | 'outline' | 'subtle';
  /** Whether button is disabled */
  disabled?: boolean;
  /** Compact mode - only show icon */
  compact?: boolean;
}

/**
 * Settings data structure returned from API
 * Uses flat dotted keys from the config service (e.g., 'download.transmission.enabled')
 */
interface SettingsData {
  // Download client settings use dotted key format
  'download.transmission.enabled'?: boolean;
  'download.deluge.enabled'?: boolean;
  'download.nzbget.enabled'?: boolean;
  'download.qbittorrent.enabled'?: boolean;
  // Prowlarr uses flat keys
  prowlarrBaseURL?: string;
  prowlarrApiKey?: string;
  [key: string]: unknown;
}

/**
 * Unified Download Button Component
 *
 * Provides a consistent dropdown menu for all download operations.
 * Adapts behavior based on context (manga/volume/chapter).
 */
// eslint-disable-next-line complexity, max-lines-per-function -- Unified download component handling multiple download contexts (manga/volume/chapter) with various download methods and providers
export function DownloadButton({
  context,
  onOpenSearch,
  onSuccess,
  size = 'xs',
  variant = 'light',
  disabled = false,
  compact = false,
}: DownloadButtonProps): React.ReactElement | null {
  const [isQuickDownloading, setIsQuickDownloading] = useState(false);
  const [menuOpened, setMenuOpened] = useState(false);
  const [directUrlModalOpen, setDirectUrlModalOpen] = useState(false);
  const [mangadexModalOpen, setMangadexModalOpen] = useState(false);

  // Check if manga/chapter has MangaDex source
  const hasMangaDexSource = useMemo(() => {
    // Check manga source
    if (context.manga.source && context.manga.source.toLowerCase() === 'mangadex') return true;
    if (context.manga.searchProvider && context.manga.searchProvider.toLowerCase() === 'mangadex') return true;

    // Check providerMetadata for mangadexId
    const metadata = context.manga.providerMetadata as Record<string, unknown> | null;
    if (metadata?.['mangadexId']) return true;

    // For chapter context, check if chapter has mangadexId
    if (context.type === 'chapter') {
      const chapter = context.chapter as ChapterWithMangaDex;
      if (chapter.mangadexId) return true;
    }

    return false;
  }, [context]);

  // Get MangaDex chapter ID if available
  const mangadexChapterId = useMemo(() => {
    if (context.type === 'chapter') {
      const chapter = context.chapter as ChapterWithMangaDex;
      return chapter.mangadexId ?? null;
    }
    return null;
  }, [context]);

  // Get settings for download clients
  const { data: settings } = trpc.settings.get.useQuery({ key: 'all' });
  const queryClient = trpc.useUtils();

  // Quick download mutation
  const quickDownload = trpc.manga.quickDownloadWithSearch.useMutation({
    onSuccess: (result) => {
      const summary = (result as {
        summary?: { total: number; started: number; noResults: number; allBlocked: number };
      }).summary ?? { total: 0, started: 0, noResults: 0, allBlocked: 0 };
      notifications.show(mapSummaryToNotification(summary));
      void queryClient.manga.get.invalidate({ id: toNumberId(context.manga.id) });
      onSuccess?.();
    },
    onError: (error) => {
      notify({ severity: 'ERROR', title: 'Download Failed', message: error instanceof Error ? error.message : String(error) });
    },
    onSettled: () => {
      setIsQuickDownloading(false);
    },
  });

  // Get enabled download clients
  const enabledClients = useMemo(() => {
    if (!settings || !isSuccess(settings)) return [];

    const settingsData = settings.data as SettingsData;
    const clients: string[] = [];

    // Use bracket notation for dotted key access
    if (settingsData['download.transmission.enabled'] === true) clients.push('transmission');
    if (settingsData['download.deluge.enabled'] === true) clients.push('deluge');
    if (settingsData['download.nzbget.enabled'] === true) clients.push('nzbget');
    if (settingsData['download.qbittorrent.enabled'] === true) clients.push('qbittorrent');

    return clients;
  }, [settings]);

  // Check if Prowlarr is configured
  const isProwlarrConfigured = useMemo(() => {
    if (!settings || !isSuccess(settings)) return false;
    const settingsData = settings.data as SettingsData;
    return !!(settingsData.prowlarrBaseURL && settingsData.prowlarrApiKey);
  }, [settings]);

  const hasEnabledClients = enabledClients.length > 0;
  const canDownload = isProwlarrConfigured && hasEnabledClients;

  // Check if already downloaded (for chapter context)
  const isDownloaded =
    context.type === 'chapter' && context.chapter.downloadStatus === ChapterStatus.COMPLETED;

  const isDownloading =
    context.type === 'chapter' && context.chapter.downloadStatus === ChapterStatus.DOWNLOADING;

  // Handle quick download based on context
  const handleQuickDownload = (): void => {
    if (!canDownload) {
      notify({ severity: 'WARNING', title: 'Configuration Required', message: 'Please configure Prowlarr and a download client in Settings' });
      return;
    }

    setIsQuickDownloading(true);

    switch (context.type) {
      case 'manga':
        // Download all missing chapters
        void quickDownload.mutateAsync({
          mangaId: toNumberId(context.manga.id),
          mode: 'BULK',
          chapterIds: [], // Service will find missing chapters
        });
        break;

      case 'volume':
        // Download volume pack
        void quickDownload.mutateAsync({
          mangaId: toNumberId(context.manga.id),
          mode: 'VOLUME',
          volumeNumber: context.volumeNumber,
        });
        break;

      case 'chapter':
        // Download single chapter
        void quickDownload.mutateAsync({
          mangaId: toNumberId(context.manga.id),
          mode: 'SINGLE',
          chapterId: toNumberId(context.chapter.id),
        });
        break;

      default:
        // TypeScript ensures all cases are handled
        break;
    }
  };

  // Handle direct URL
  const handleDirectUrl = (): void => {
    setMenuOpened(false);
    setDirectUrlModalOpen(true);
  };

  // Get button label based on context
  const getButtonLabel = (): string => {
    if (compact) return '';
    switch (context.type) {
      case 'manga':
        return 'Download';
      case 'volume':
        return 'Download Volume';
      case 'chapter':
        return 'Download';
      default:
        return 'Download';
    }
  };

  // Get context description for menu
  const getContextDescription = (): string => {
    switch (context.type) {
      case 'manga':
        return 'all missing chapters';
      case 'volume':
        return `Volume ${context.volumeNumber}`;
      case 'chapter':
        // index is always available (non-nullable Int in schema)
        return `Chapter ${context.chapter.index}`;
      default:
        return 'content';
    }
  };

  // Render downloaded state.
  // In compact (table-action) mode the AVAILABLE status badge + Read button
  // already convey "downloaded", so we render nothing here to avoid Mantine's
  // disabled-style gray pill leaking through any variant we pick.
  if (isDownloaded) {
    if (compact) return null;
    return (
      <Button
        size={size}
        variant="subtle"
        color="green"
        leftSection={<IconCheck size={14} />}
        disabled
      >
        Downloaded
      </Button>
    );
  }

  // Render downloading state. Same reasoning as the downloaded branch:
  // in compact mode, show a bare spinner without a Button wrapper so the
  // disabled-pill style cannot apply.
  if (isDownloading) {
    if (compact) {
      return <Loader size="sm" color="blue" />;
    }
    return (
      <Button
        size={size}
        variant="subtle"
        leftSection={<Loader size={14} color="blue" />}
        disabled
      >
        Downloading...
      </Button>
    );
  }

  // Main download button with dropdown
  return (
    <>
    <Menu
      shadow="md"
      width={240}
      opened={menuOpened}
      onChange={setMenuOpened}
      position="bottom-end"
    >
      <Menu.Target>
        <Button
          size={size}
          variant={variant}
          color="blue"
          rightSection={compact ? undefined : <IconChevronDown size={14} />}
          leftSection={
            isQuickDownloading ? (
              <Loader size={14} color="blue" />
            ) : (
              <IconDownload size={14} />
            )
          }
          disabled={disabled || isQuickDownloading}
          loading={isQuickDownloading}
        >
          {getButtonLabel()}
        </Button>
      </Menu.Target>

      <Menu.Dropdown>
        <Menu.Label>
          Download {getContextDescription()}
        </Menu.Label>

        {/* Quick Download - Auto search and download */}
        <Menu.Item
          leftSection={<IconPlayerPlay size={16} />}
          onClick={handleQuickDownload}
          disabled={!canDownload}
          rightSection={
            !canDownload && (
              <Badge size="xs" color="yellow">
                Setup
              </Badge>
            )
          }
        >
          <div>
            <Text size="sm" fw={500}>
              Quick Download
            </Text>
            <Text size="xs" c="dimmed">
              Auto-search & download best match
            </Text>
          </div>
        </Menu.Item>

        {/* Search Downloads - Open search modal */}
        <Menu.Item
          leftSection={<IconSearch size={16} />}
          onClick={() => {
            setMenuOpened(false);
            onOpenSearch?.();
          }}
          disabled={!isProwlarrConfigured}
        >
          <div>
            <Text size="sm" fw={500}>
              Search Downloads
            </Text>
            <Text size="xs" c="dimmed">
              Browse & select from results
            </Text>
          </div>
        </Menu.Item>

        {/* MangaDex Download - Only for chapters with MangaDex source */}
        {hasMangaDexSource && context.type === 'chapter' && mangadexChapterId && (
          <Menu.Item
            leftSection={<IconBook size={16} />}
            onClick={() => {
              setMenuOpened(false);
              setMangadexModalOpen(true);
            }}
            color="orange"
          >
            <div>
              <Text size="sm" fw={500}>
                Download from MangaDex
              </Text>
              <Text size="xs" c="dimmed">
                Direct download (no torrent)
              </Text>
            </div>
          </Menu.Item>
        )}

        <Menu.Divider />

        {/* Direct URL */}
        <Menu.Item
          leftSection={<IconLink size={16} />}
          onClick={handleDirectUrl}
          disabled={!hasEnabledClients}
        >
          <div>
            <Text size="sm">Direct URL</Text>
            <Text size="xs" c="dimmed">
              Paste a download link
            </Text>
          </div>
        </Menu.Item>

        {/* Settings hint if not configured */}
        {!canDownload && (
          <>
            <Menu.Divider />
            <Menu.Item
              leftSection={<IconSettings size={16} />}
              c="yellow"
              onClick={() => {
                // Navigate to download clients settings
                window.location.href = '/settings/download-clients';
              }}
            >
              <Text size="xs">Configure download clients</Text>
            </Menu.Item>
          </>
        )}
      </Menu.Dropdown>
    </Menu>

    {/* Direct URL Modal */}
    <DirectUrlModal
      opened={directUrlModalOpen}
      onClose={() => setDirectUrlModalOpen(false)}
      context={context}
      onSuccess={onSuccess}
    />

    {/* MangaDex Download Modal - Only for chapters with MangaDex source */}
    {mangadexModalOpen && context.type === 'chapter' && mangadexChapterId && (
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 1000, background: 'var(--mantine-color-body)', padding: '1rem', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
        <MangaDexDownloadOptions
          mangaId={toNumberId(context.manga.id)}
          mangadexChapterId={mangadexChapterId}
          chapterNumber={context.chapter.index}
          onDownloadStarted={() => {
            setMangadexModalOpen(false);
            onSuccess?.();
          }}
        />
        <Button
          variant="subtle"
          size="xs"
          mt="sm"
          fullWidth
          onClick={() => setMangadexModalOpen(false)}
        >
          Cancel
        </Button>
      </div>
    )}
    {mangadexModalOpen && <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999 }} onClick={() => setMangadexModalOpen(false)} />}
  </>
  );
}

export default DownloadButton;
