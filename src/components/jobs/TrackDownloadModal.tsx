/**
 * Track Download Modal
 *
 * Allows users to manually track an existing download from a connected
 * download client (Transmission/Deluge) by linking it to a manga.
 *
 * @module components/jobs/TrackDownloadModal
 */

import React, { useState } from 'react';

import {
  Modal, Stack, Select, Table, Text, Button, Group,
  Badge, Loader, Center, ScrollArea
} from '@mantine/core';
import { IconLink } from '@tabler/icons-react';

import { notify } from '@/utils/notify';
import { trpc } from '@/utils/trpc-client/index';

// ============================================================================
// Types
// ============================================================================

interface TrackDownloadModalProps {
  opened: boolean;
  onClose: () => void;
  onTracked: () => void;
}

interface ClientDownload {
  id: string;
  name: string;
  status: string;
  progress: number;
  clientType: string;
  savePath: string;
  size: number;
}

// ============================================================================
// Helpers
// ============================================================================

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function statusColor(status: string): string {
  if (status === 'COMPLETED' || status === 'SEEDING') return 'green';
  if (status === 'DOWNLOADING') return 'blue';
  if (status === 'PAUSED') return 'yellow';
  if (status === 'ERROR' || status === 'FAILED') return 'red';
  return 'gray';
}

function downloadKey(dl: ClientDownload): string {
  return `${dl.clientType}:${dl.id}`;
}

// ============================================================================
// Sub-components
// ============================================================================

function DownloadRow({
  dl, isSelected, onSelect
}: {
  dl: ClientDownload;
  isSelected: boolean;
  onSelect: () => void;
}): React.ReactElement {
  return (
    <tr onClick={onSelect}
      style={{
        cursor: 'pointer',
        backgroundColor: isSelected ? 'rgba(122, 162, 247, 0.15)' : undefined,
        outline: isSelected ? '1px solid #7aa2f7' : undefined,
      }}>
      <td style={{ maxWidth: 300 }}>
        <Text size="sm" truncate>{dl.name}</Text>
      </td>
      <td><Badge size="xs" variant="light">{dl.clientType}</Badge></td>
      <td>
        <Badge size="xs" color={statusColor(dl.status)}>
          {dl.status} {dl.progress < 100 ? `${Math.round(dl.progress)}%` : ''}
        </Badge>
      </td>
      <td><Text size="xs" c="dimmed">{formatBytes(dl.size)}</Text></td>
    </tr>
  );
}

function DownloadList({
  downloads, selectedKey, onSelect
}: {
  downloads: ClientDownload[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
}): React.ReactElement {
  return (
    <ScrollArea h={250}>
      <Table striped highlightOnHover>
        <thead>
          <tr><th>Name</th><th>Client</th><th>Status</th><th>Size</th></tr>
        </thead>
        <tbody>
          {downloads.map((dl) => (
            <DownloadRow key={downloadKey(dl)} dl={dl}
              isSelected={selectedKey === downloadKey(dl)}
              onSelect={() => onSelect(downloadKey(dl))} />
          ))}
        </tbody>
      </Table>
    </ScrollArea>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function TrackDownloadModal({
  opened, onClose, onTracked
}: TrackDownloadModalProps): React.ReactElement {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [selectedManga, setSelectedManga] = useState<string | null>(null);

  const { data: downloads, isLoading: loadingDownloads } =
    trpc.downloads.queue.listClientDownloads.useQuery(undefined, { enabled: opened });

  const { data: mangaList, isLoading: loadingManga } =
    trpc.manga.query.useQuery(undefined, { enabled: opened });

  const trackMutation = trpc.downloads.queue.trackExistingDownload.useMutation({
    onSuccess: () => {
      notify({ severity: 'SUCCESS', title: 'Download tracked', message: 'Job created for download monitoring' });
      onTracked();
      handleClose();
    },
    onError: (err) => {
      notify({ severity: 'ERROR', title: 'Failed to track', message: err.message });
    },
  });

  function handleClose(): void {
    setSelectedKey(null);
    setSelectedManga(null);
    onClose();
  }

  function handleTrack(): void {
    if (!selectedKey || !selectedManga || !downloads) return;
    const dl = downloads.find((d) => downloadKey(d) === selectedKey);
    if (!dl) return;

    trackMutation.mutate({
      downloadId: dl.id,
      clientType: dl.clientType,
      mangaId: Number(selectedManga),
      releaseName: dl.name,
      savePath: dl.savePath,
    });
  }

  const mangaOptions = (mangaList as Array<{ id: number; title: string }> | undefined)?.map((m) => ({
    value: String(m.id),
    label: m.title,
  })) ?? [];

  const hasSelection = selectedKey !== null;

  return (
    <Modal opened={opened} onClose={handleClose} title="Track Download from Client"
      size="lg" styles={{ title: { fontWeight: 700 } }}>
      <Stack gap="md">
        {loadingDownloads && (
          <Center py="xl"><Loader size="md" /><Text ml="sm" c="dimmed">Loading downloads...</Text></Center>
        )}

        {!loadingDownloads && !downloads?.length && (
          <Text c="dimmed" ta="center" py="xl">No downloads found in connected clients</Text>
        )}

        {!loadingDownloads && downloads && downloads.length > 0 && (
          <>
            <Text size="sm" c="dimmed">Select a download to track:</Text>
            <DownloadList downloads={downloads} selectedKey={selectedKey} onSelect={setSelectedKey} />
          </>
        )}

        {hasSelection && (
          <Select label="Link to manga"
            placeholder={loadingManga ? 'Loading manga...' : 'Select manga'}
            data={mangaOptions} value={selectedManga} onChange={setSelectedManga}
            searchable disabled={loadingManga} />
        )}

        <Group justify="flex-end">
          <Button variant="default" onClick={handleClose}>Cancel</Button>
          <Button leftSection={<IconLink size={16} />}
            onClick={handleTrack} loading={trackMutation.isPending}
            disabled={!selectedKey || !selectedManga}>
            Track Download
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
