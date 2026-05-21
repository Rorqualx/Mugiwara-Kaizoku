/**
 * Manual file/folder → manga binding modal, opened from the job-detail
 * page. The user provides a server-side path (text input — browsers
 * can't see server filesystems) and submits. The server reuses the
 * pack-import flow end-to-end via `jobs.importPathToVolume`.
 *
 * Path is validated inline via `jobs.probePath` with a debounced query
 * so the Submit button stays disabled until the path exists.
 */
import React, { useState } from 'react';

import { Modal, Stack, TextInput, Group, Button, Text, Code, Alert } from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import { IconAlertCircle, IconCheck, IconFile, IconX } from '@tabler/icons-react';

import { trpc } from '@/utils/trpc-client';

interface ImportFromPathModalProps {
  opened: boolean;
  onClose: () => void;
  mangaId: number;
  jobId: string;
  volumeId: number | null;
  volumeLabel: string;
  onImported: () => void;
}

function bytesLabel(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function ImportFromPathModal({
  opened, onClose, mangaId, jobId, volumeId, volumeLabel, onImported,
}: ImportFromPathModalProps): React.ReactElement {
  const [sourcePath, setSourcePath] = useState('');

  // Inline existence probe — only fires when the input has settled at
  // ≥3 chars. The query is cheap (single fs.stat).
  const probe = trpc.jobs.probePath.useQuery(
    { path: sourcePath },
    { enabled: sourcePath.trim().length >= 3, refetchOnWindowFocus: false },
  );

  const importMutation = trpc.jobs.importPathToVolume.useMutation({
    onSuccess: (data) => {
      showNotification({
        title: 'Import succeeded',
        message: `Bound ${data.chaptersCreated} chapter row(s)${data.errors.length > 0 ? ` (with ${data.errors.length} warning(s))` : ''}`,
        color: 'green',
        icon: <IconCheck size={16} />,
      });
      setSourcePath('');
      onImported();
      onClose();
    },
    onError: (err) => {
      showNotification({
        title: 'Import failed',
        message: err.message,
        color: 'red',
        icon: <IconX size={16} />,
      });
    },
  });

  const pathValid = probe.data?.exists === true;
  const canSubmit = pathValid && !importMutation.isPending;

  const handleSubmit = (): void => {
    if (!canSubmit) return;
    importMutation.mutate({
      mangaId,
      sourcePath: sourcePath.trim(),
      jobId,
      ...(volumeId !== null ? { volumeId } : {}),
    });
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={<Text fw={600}>Manual import — {volumeLabel}</Text>}
      size="lg"
      centered
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Bind a server-side file or folder to chapters from this job. The
          pack-import pipeline will extract archives, group by volume, and
          link files to chapter rows (and auto-convert non-CBZ if needed).
        </Text>

        <TextInput
          label="Source path (on the server)"
          description="Absolute path to a .cbz/.cbr/.zip/.rar/.7z or a folder of chapter files"
          placeholder="/data/completed/My Series Vol 1.cbz"
          value={sourcePath}
          onChange={(e) => setSourcePath(e.currentTarget.value)}
          autoFocus
          spellCheck={false}
        />

        {sourcePath.trim().length >= 3 && (
          <Alert
            icon={pathValid ? <IconFile size={16} /> : <IconAlertCircle size={16} />}
            color={pathValid ? 'green' : 'orange'}
            variant="light"
          >
            {probe.isLoading
              ? 'Checking path...'
              : pathValid
              ? (
                <Group gap="xs">
                  <Text size="sm">
                    {probe.data?.isDirectory ? 'Directory found' : 'File found'}
                  </Text>
                  {probe.data?.isFile && probe.data.sizeBytes > 0 && (
                    <Code>{bytesLabel(probe.data.sizeBytes)}</Code>
                  )}
                </Group>
              )
              : 'Path not found or unreadable from the server'}
          </Alert>
        )}

        <Group justify="flex-end" mt="sm">
          <Button variant="default" onClick={onClose} disabled={importMutation.isPending}>
            Cancel
          </Button>
          <Button
            color="blue"
            onClick={handleSubmit}
            loading={importMutation.isPending}
            disabled={!canSubmit}
          >
            Import
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
