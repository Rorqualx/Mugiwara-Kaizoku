/**
 * MangaActionBar component for manga detail pages
 *
 * This component provides a manga-specific action bar with chapter management,
 * monitoring options, metadata refresh, and download controls.
 */

import React, { useState } from 'react';

import { Group, ActionIcon, Box, Menu, Button, Tooltip, Badge, Text, Modal, Stack, Progress } from '@mantine/core';
import {
  IconSettings,
  IconTrash,
  IconCheck,
  IconX,
  IconDatabase,
  IconArrowLeft,
  IconClock,
  IconFolderSearch,
  IconRefresh,
  IconReload
} from '@tabler/icons-react';

import {
  useMetadataRefreshProgress,
  type MetadataRefreshProgress,
} from '@/hooks/manga/useMetadataRefreshProgress';
import { useBreakpoint } from '@/hooks/mobile';
import { useNavigation } from '@/hooks/useNavigation';
import { logger } from '@/utils/logger';
import { notify } from '@/utils/notify';
import { trpc } from '@/utils/trpc-client/index';

interface MangaActionBarProps {
  mangaId: number;
  mangaTitle: string;
  onRefresh: () => void;
  refreshing: boolean;
  totalChapters: number;
  downloadedChapters: number;
  readChapters: number;
  libraryId?: number;
  libraryName?: string;
}

/**
 * Inline progress indicator for metadata refresh.
 *
 * Sized to fit the longest phase label without truncation
 * ("Reconciling chapters from all sources..." — ~44 chars). Bumped from
 * size="xs" + c="dimmed" to size="sm" + --theme-text so the live status reads
 * clearly on the dark action-bar background.
 */
function MetadataRefreshIndicator({ progress }: {
  progress: MetadataRefreshProgress;
}): React.ReactElement {
  const color = progress.isError ? 'red' : progress.isComplete ? 'green' : 'blue';

  return (
    <Group gap="sm" style={{ minWidth: 420, maxWidth: 560, flexShrink: 0 }}>
      <Progress
        value={progress.percent}
        size="md"
        radius="xl"
        color={color}
        animated={!progress.isComplete && !progress.isError}
        style={{ flex: 1, minWidth: 120 }}
      />
      <Text
        size="sm"
        style={{
          color: 'var(--theme-text, var(--mantine-color-text))',
          whiteSpace: 'pre',
          flexShrink: 0,
        }}
      >
        {progress.message}
      </Text>
    </Group>
  );
}

export function MangaActionBar({
  mangaId,
  mangaTitle,
  onRefresh,
  refreshing: _refreshing,
  totalChapters,
  downloadedChapters,
  readChapters,
  libraryId: _libraryId,
  libraryName: _libraryName
}: MangaActionBarProps): React.ReactElement {
  const { navigateTo } = useNavigation();
  const { isMobile } = useBreakpoint();
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [markAllReadModalOpen, setMarkAllReadModalOpen] = useState(false);
  const [isRefreshingPage, setIsRefreshingPage] = useState(false);

  // Get tRPC utils for cache invalidation
  const utils = trpc.useUtils();

  // Mutations
  const deleteMutation = trpc.manga.remove.useMutation({
    onSuccess: () => {
      // Show notification immediately
      notify({ severity: 'ERROR', title: 'Manga Deleted', message: `${mangaTitle} has been removed from your library` });

      // Navigate immediately to the library section. Use the index (not a
      // specific /library/:id) because a shared/linked title's Manga.libraryId
      // is the original owner's library, which the current user may not own.
      logger.info('[MangaActionBar] Delete success - navigating to library');
      void navigateTo('/library');

      // Fire-and-forget cache invalidation (happens in background)
      void utils.manga.query.invalidate();
      void utils.library.query.invalidate();
    },
    onError: (error) => {
      notify({ severity: 'ERROR', title: 'Delete Failed', message: (error instanceof Error ? error.message : String(error)) });
    }
  });

  const refreshMetadataMutation = trpc.manga.refreshMetaData.useMutation({
    onSuccess: async () => {
      // Invalidate manga cache to force refetch with new chapter data
      logger.info('[MangaActionBar] Invalidating cache after metadata refresh');
      await utils.manga.get.invalidate({ id: mangaId });
      await utils.manga.detail.invalidate({ id: mangaId });

      notify({ severity: 'SUCCESS', title: 'Metadata Refreshed', message: `Updated metadata for ${mangaTitle}` });
      onRefresh();
    },
    onError: (error) => {
      notify({ severity: 'ERROR', title: 'Refresh Failed', message: (error instanceof Error ? error.message : String(error)) });
    }
  });

  // Metadata refresh progress tracking via WebSocket
  const refreshProgress = useMetadataRefreshProgress(mangaId, refreshMetadataMutation.isPending);

  const checkForNewChaptersMutation = trpc.manga.checkForNewChapters.useMutation({
    onSuccess: async () => {
      // Invalidate manga cache to force refetch with new chapter data
      logger.info('[MangaActionBar] Invalidating cache after chapter check');
      await utils.manga.get.invalidate({ id: mangaId });
      await utils.manga.detail.invalidate({ id: mangaId });

      notify({ severity: 'INFO', title: 'Chapter Check Started', message: `Checking for new chapters for ${mangaTitle}` });
      onRefresh();
    },
    onError: (error) => {
      notify({ severity: 'ERROR', title: 'Check Failed', message: (error instanceof Error ? error.message : String(error)) });
    }
  });

  const resetFailedDownloadsMutation = trpc.manga.resetFailedDownloads.useMutation({
    onSuccess: async (data) => {
      if (data.clearedCount === 0) {
        notify({ severity: 'INFO', title: 'Nothing to Reset', message: 'No failed chapters for this manga' });
        return;
      }
      await Promise.all([
        utils.manga.get.invalidate({ id: mangaId }),
        utils.manga.detail.invalidate({ id: mangaId }),
      ]);
      notify({ severity: 'SUCCESS', title: 'Failed Downloads Reset', message: data.message });
      onRefresh();
    },
    onError: (error) => {
      notify({ severity: 'ERROR', title: 'Reset Failed', message: error instanceof Error ? error.message : String(error) });
    },
  });

  const scanLibraryMutation = trpc.manga.scanLibraryFolder.useMutation({
    onSuccess: async (data) => {
      notify({ severity: 'SUCCESS', title: 'Library Scan Complete', message: `Found ${data.newChaptersCreated} new files, linked ${data.existingLinked} existing chapters` });
      // Invalidate all manga-related caches so volumes/chapters refresh
      await Promise.all([
        utils.manga.get.invalidate({ id: mangaId }),
        utils.manga.detail.invalidate({ id: mangaId }),
        utils.reader.verifyChapterFiles.invalidate(),
        utils.reader.getMangaProgress.invalidate({ mangaId }),
      ]);
      onRefresh();
    },
    onError: (error) => {
      notify({ severity: 'ERROR', title: 'Scan Failed', message: error instanceof Error ? error.message : String(error) });
    },
  });

  const handleDelete = (): void => {
    deleteMutation.mutate({ id: mangaId });
    setDeleteModalOpen(false);
  };

  const handleCheckForNewChapters = (): void => {
    checkForNewChaptersMutation.mutate({ id: mangaId });
  };


  const markAllReadMutation = trpc.chapter.markAllAsRead.useMutation({
    onSuccess: () => {
      notify({ severity: 'SUCCESS', title: 'Marked as Read', message: `All chapters marked as read for ${mangaTitle}` });
      onRefresh();
    },
    onError: (error) => {
      notify({ severity: 'ERROR', title: 'Failed to Mark as Read', message: (error instanceof Error ? error.message : String(error)) });
    }
  });

  const markAllUnreadMutation = trpc.chapter.markAllAsUnread.useMutation({
    onSuccess: () => {
      notify({ severity: 'SUCCESS', title: 'Marked as Unread', message: `All chapters marked as unread for ${mangaTitle}` });
      onRefresh();
    },
    onError: (error) => {
      notify({ severity: 'ERROR', title: 'Failed to Mark as Unread', message: (error instanceof Error ? error.message : String(error)) });
    }
  });

  const handleMarkAllRead = (): void => {
    markAllReadMutation.mutate({ mangaId });
    setMarkAllReadModalOpen(false);
  };

  /**
   * Force-resync the manga page with the database. No backend mutation —
   * just invalidates every tRPC query that drives this page so DB-side
   * changes (cleanup scripts, file reorganizes, manual edits) flow into
   * the UI without a full browser reload.
   */
  const handleRefreshPage = async (): Promise<void> => {
    if (isRefreshingPage) return;
    setIsRefreshingPage(true);
    try {
      await Promise.all([
        utils.manga.get.invalidate({ id: mangaId }),
        utils.manga.detail.invalidate({ id: mangaId }),
        utils.manga.query.invalidate(),
        utils.reader.verifyChapterFiles.invalidate(),
        utils.reader.getMangaProgress.invalidate({ mangaId }),
      ]);
      onRefresh();
      notify({ severity: 'SUCCESS', title: 'Page Refreshed', message: `Reloaded ${mangaTitle} from the database` });
    } catch (err: unknown) {
      notify({ severity: 'ERROR', title: 'Refresh Failed', message: err instanceof Error ? err.message : String(err) });
    } finally {
      setIsRefreshingPage(false);
    }
  };

  return (
    <>
      <Box
        style={{
          position: 'fixed',
          top: '56px',
          left: isMobile ? '0' : '210px',
          right: '0',
          height: '56px',
          backgroundColor: 'var(--mantine-color-dark-7)',
          borderBottom: '1px solid var(--mantine-color-dark-5)',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px'
        }}
      >
        <Group justify="space-between" style={{ width: '100%' }}>
          {/* Left side - Navigation and title */}
          <Group gap="md">
            <Tooltip label="Back to Library">
              <ActionIcon
                variant="subtle"
                size="lg"
                onClick={() => { void navigateTo('/library'); }}
              >
                <IconArrowLeft size={20} />
              </ActionIcon>
            </Tooltip>

            <Text size="lg" fw={600}>{mangaTitle}</Text>

            {/* Status badges */}
            <Group gap="xs">
              <Badge color="green" variant="light" size="sm">
                {downloadedChapters} downloaded
              </Badge>
              <Badge color="cyan" variant="light" size="sm">
                {readChapters} read
              </Badge>
            </Group>
          </Group>

          {/* Right side - Actions */}
          <Group gap="xs">
            {/* Metadata refresh progress indicator */}
            {refreshProgress.isRefreshing && (
              <MetadataRefreshIndicator progress={refreshProgress} />
            )}

            {/* More actions menu */}
            <Menu shadow="md" width={200}>
              <Menu.Target>
                <ActionIcon variant="subtle" size="lg">
                  <IconSettings size={20} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>Manga Actions</Menu.Label>
                <Menu.Item
                  leftSection={<IconReload size={16} />}
                  disabled={isRefreshingPage}
                  onClick={() => { void handleRefreshPage(); }}
                >
                  Refresh Page
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconClock size={16} />}
                  onClick={() => { if (!checkForNewChaptersMutation.isPending) void handleCheckForNewChapters(); }}
                >
                  Check for New Chapters
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconDatabase size={16} />}
                  onClick={() => { if (!refreshMetadataMutation.isPending) refreshMetadataMutation.mutate({ id: mangaId, forceRefresh: true }); }}
                >
                  Re-identify Metadata
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconRefresh size={16} />}
                  onClick={() => { if (!resetFailedDownloadsMutation.isPending) resetFailedDownloadsMutation.mutate({ id: mangaId }); }}
                >
                  Reset Failed Downloads
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconFolderSearch size={16} />}
                  onClick={() => { if (!scanLibraryMutation.isPending) scanLibraryMutation.mutate({ mangaId }); }}
                >
                  Scan Library Folder
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item
                  leftSection={<IconCheck size={16} />}
                  onClick={() => setMarkAllReadModalOpen(true)}
                >
                  Mark All as Read
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconX size={16} />}
                  onClick={() => { if (!markAllUnreadMutation.isPending) markAllUnreadMutation.mutate({ mangaId }); }}
                >
                  Mark All as Unread
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item
                  color="red"
                  leftSection={<IconTrash size={16} />}
                  onClick={() => setDeleteModalOpen(true)}
                >
                  Delete Manga
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </Box>

      {/* Delete confirmation modal */}
      <Modal
        opened={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete Manga"
        centered
      >
        <Stack>
          <Text>Are you sure you want to delete &quot;{mangaTitle}&quot; from your library?</Text>
          <Text size="sm" c="dimmed">This action cannot be undone. All downloaded chapters will also be removed.</Text>
          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={() => setDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button color="red" onClick={() => { void handleDelete(); }} loading={deleteMutation.isPending}>
              Delete
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Mark all read modal */}
      <Modal
        opened={markAllReadModalOpen}
        onClose={() => setMarkAllReadModalOpen(false)}
        title="Mark All as Read"
        centered
      >
        <Stack>
          <Text>Mark all {totalChapters} chapters as read for &quot;{mangaTitle}&quot;?</Text>
          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={() => setMarkAllReadModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => { void handleMarkAllRead(); }}>
              Mark All Read
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}