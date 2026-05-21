/**
 * MangaDex Download Options Component
 *
 * Provides download options for chapters from MangaDex including
 * quality selection and download preview.
 *
 * @module components/manga/MangaDexDownloadOptions
 */

import React, { useState } from 'react';

import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Loader,
  SegmentedControl,
  Stack,
  Text,
  Title
} from '@mantine/core';
import {
  IconAlertCircle,
  IconDownload,
  IconFile,
  IconPhoto
} from '@tabler/icons-react';
import prettyBytes from 'pretty-bytes';

import { notify } from '@/utils/notify';
import { trpc } from '@/utils/trpc-client';

interface MangaDexDownloadOptionsProps {
  mangaId: number;
  mangadexChapterId: string;
  chapterNumber?: number;
  onDownloadStarted?: () => void;
}

type Quality = 'full' | 'dataSaver';

export function MangaDexDownloadOptions({
  mangaId,
  mangadexChapterId,
  chapterNumber,
  onDownloadStarted
}: MangaDexDownloadOptionsProps): React.ReactElement {
  const [quality, setQuality] = useState<Quality>('full');

  // Fetch download info (page count, estimated size)
  const { data: downloadInfo, isLoading: loadingInfo, error } = trpc.nativeDownload.getDownloadInfo.useQuery({
    chapterId: mangadexChapterId
  });

  // Start download mutation
  const startDownload = trpc.nativeDownload.startDownload.useMutation({
    onSuccess: (result) => {
      notify({ severity: 'SUCCESS', title: 'Download Queued', message: result.message });
      onDownloadStarted?.();
    },
    onError: (err) => {
      notify({ severity: 'ERROR', title: 'Download Failed', message: err.message });
    }
  });

  const handleDownload = (): void => {
    startDownload.mutate({
      mangaId,
      mangadexChapterId,
      chapterNumber,
      quality
    });
  };

  if (loadingInfo) {
    return (
      <Card withBorder p="md">
        <Stack align="center">
          <Loader size="sm" />
          <Text size="sm" c="dimmed">Loading chapter info...</Text>
        </Stack>
      </Card>
    );
  }

  if (error) {
    return (
      <Card withBorder p="md">
        <Alert icon={<IconAlertCircle size={16} />} color="red" title="Error">
          Failed to load chapter info: {error.message}
        </Alert>
      </Card>
    );
  }

  const estimatedSize = quality === 'dataSaver'
    ? downloadInfo?.estimatedSize.dataSaver
    : downloadInfo?.estimatedSize.full;

  return (
    <Card withBorder>
      <Stack gap="md">
        <Group justify="space-between">
          <Title order={5}>MangaDex Download</Title>
          {chapterNumber !== undefined && (
            <Badge variant="light">Chapter {chapterNumber}</Badge>
          )}
        </Group>

        {/* Chapter info */}
        <Group gap="lg">
          <Group gap="xs">
            <IconPhoto size={16} style={{ color: 'var(--mantine-color-dimmed)' }} />
            <Text size="sm" c="dimmed">
              {downloadInfo?.pageCount ?? 0} pages
            </Text>
          </Group>

          <Group gap="xs">
            <IconFile size={16} style={{ color: 'var(--mantine-color-dimmed)' }} />
            <Text size="sm" c="dimmed">
              ~{prettyBytes(estimatedSize ?? 0)}
            </Text>
          </Group>
        </Group>

        {/* Quality selection */}
        <Stack gap="xs">
          <Text size="sm" fw={500}>Quality</Text>
          <SegmentedControl
            value={quality}
            onChange={(value) => setQuality(value as Quality)}
            data={[
              {
                value: 'full',
                label: (
                  <Stack gap={0} align="center">
                    <Text size="sm">Full Quality</Text>
                    <Text size="xs" c="dimmed">
                      ~{prettyBytes(downloadInfo?.estimatedSize.full ?? 0)}
                    </Text>
                  </Stack>
                )
              },
              {
                value: 'dataSaver',
                label: (
                  <Stack gap={0} align="center">
                    <Text size="sm">Data Saver</Text>
                    <Text size="xs" c="dimmed">
                      ~{prettyBytes(downloadInfo?.estimatedSize.dataSaver ?? 0)}
                    </Text>
                  </Stack>
                ),
                disabled: !downloadInfo?.hasDataSaver
              }
            ]}
          />
        </Stack>

        {/* Quality info */}
        <Alert
          icon={<IconAlertCircle size={16} />}
          color={quality === 'dataSaver' ? 'yellow' : 'blue'}
          variant="light"
        >
          {quality === 'dataSaver' ? (
            <>
              Data Saver mode downloads compressed images. File sizes are smaller
              but image quality may be reduced.
            </>
          ) : (
            <>
              Full quality downloads original resolution images. File sizes are larger
              but you get the best quality.
            </>
          )}
        </Alert>

        {/* Download button */}
        <Button
          fullWidth
          leftSection={<IconDownload size={16} />}
          onClick={handleDownload}
          loading={startDownload.isPending}
        >
          Download as CBZ
        </Button>
      </Stack>
    </Card>
  );
}
