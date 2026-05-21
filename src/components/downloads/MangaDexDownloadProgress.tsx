/**
 * MangaDex Download Progress Component
 *
 * Displays real-time download progress for MangaDex chapter downloads.
 * Uses WebSocket events for live updates.
 *
 * @module components/downloads/MangaDexDownloadProgress
 */

import React, { useEffect, useState } from 'react';

import {
  Badge,
  Card,
  Group,
  Progress,
  Stack,
  Text,
  ThemeIcon
} from '@mantine/core';
import {
  IconCheck,
  IconDownload,
  IconFile,
  IconPhoto,
  IconX
} from '@tabler/icons-react';

interface DownloadProgressData {
  taskId: string;
  mangaId: number | string;
  chapterId?: number | string;
  progress: number;
  status: 'queued' | 'downloading' | 'completed' | 'failed' | 'paused';
  filename?: string;
}

interface MangaDexDownloadProgressProps {
  downloadId: string;
  mangaTitle?: string;
  chapterNumber?: number;
  initialStatus?: 'queued' | 'downloading' | 'completed' | 'failed';
  onComplete?: () => void;
}

export function MangaDexDownloadProgress({
  downloadId,
  mangaTitle,
  chapterNumber,
  initialStatus = 'queued',
  onComplete
}: MangaDexDownloadProgressProps): React.ReactElement {
  const [status, setStatus] = useState<DownloadProgressData['status']>(initialStatus);
  const [progress, setProgress] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [phase, setPhase] = useState<'downloading' | 'bundling'>('downloading');

  // Listen for WebSocket events
  useEffect(() => {
    // This would connect to the realtime event system
    // For now, we'll use a placeholder implementation
    const handleProgressUpdate = (event: CustomEvent<DownloadProgressData>): void => {
      const data = event.detail;
      if (data.taskId === downloadId || data.chapterId === downloadId) {
        setProgress(data.progress);
        setStatus(data.status);

        // Parse filename for page info (e.g., "Chapter 1 - Page 5/20")
        if (data.filename) {
          const match = data.filename.match(/Page (\d+)\/(\d+)/);
          if (match?.[1] && match[2]) {
            setCurrentPage(parseInt(match[1], 10));
            setTotalPages(parseInt(match[2], 10));
          }
          // Detect bundling phase
          if (data.filename.toLowerCase().includes('bundling')) {
            setPhase('bundling');
          }
        }

        if (data.status === 'completed') {
          onComplete?.();
        }
      }
    };

    // Subscribe to download progress events
    window.addEventListener('download:progress', handleProgressUpdate as EventListener);

    return () => {
      window.removeEventListener('download:progress', handleProgressUpdate as EventListener);
    };
  }, [downloadId, onComplete]);

  const getStatusColor = (): string => {
    switch (status) {
      case 'completed': return 'green';
      case 'failed': return 'red';
      case 'paused': return 'yellow';
      case 'downloading': return 'blue';
      default: return 'gray';
    }
  };

  const getStatusIcon = (): React.ReactElement => {
    switch (status) {
      case 'completed': return <IconCheck size={14} />;
      case 'failed': return <IconX size={14} />;
      case 'downloading':
        return phase === 'bundling' ? <IconFile size={14} /> : <IconDownload size={14} />;
      default: return <IconPhoto size={14} />;
    }
  };

  const getStatusText = (): string => {
    switch (status) {
      case 'queued': return 'Queued';
      case 'downloading':
        if (phase === 'bundling') {
          return 'Creating CBZ...';
        }
        if (totalPages > 0) {
          return `Downloading page ${currentPage} of ${totalPages}`;
        }
        return 'Downloading...';
      case 'completed': return 'Complete';
      case 'failed': return 'Failed';
      case 'paused': return 'Paused';
      default: return status;
    }
  };

  return (
    <Card withBorder p="sm">
      <Stack gap="xs">
        <Group justify="space-between">
          <Group gap="xs">
            <ThemeIcon
              variant="light"
              color={getStatusColor()}
              size="sm"
            >
              {getStatusIcon()}
            </ThemeIcon>
            <Stack gap={0}>
              <Text size="sm" fw={500} lineClamp={1}>
                {mangaTitle ?? 'MangaDex Download'}
              </Text>
              {chapterNumber !== undefined && (
                <Text size="xs" c="dimmed">
                  Chapter {chapterNumber}
                </Text>
              )}
            </Stack>
          </Group>

          <Badge color={getStatusColor()} variant="light" size="sm">
            {getStatusText()}
          </Badge>
        </Group>

        {status === 'downloading' && (
          <Stack gap={4}>
            <Progress
              value={progress}
              size="sm"
              color={getStatusColor()}
              animated={phase === 'downloading'}
            />
            <Group justify="space-between">
              <Text size="xs" c="dimmed">
                {phase === 'bundling' ? 'Bundling pages into CBZ' : `${progress}%`}
              </Text>
              {totalPages > 0 && phase === 'downloading' && (
                <Text size="xs" c="dimmed">
                  {currentPage}/{totalPages} pages
                </Text>
              )}
            </Group>
          </Stack>
        )}

        {status === 'completed' && (
          <Text size="xs" c="green">
            Download complete - CBZ file created
          </Text>
        )}

        {status === 'failed' && (
          <Text size="xs" c="red">
            Download failed. Please try again.
          </Text>
        )}
      </Stack>
    </Card>
  );
}

/**
 * Hook to subscribe to MangaDex download progress events
 */
export function useMangaDexDownloadProgress(downloadId: string): {
  progress: number;
  status: DownloadProgressData['status'];
  currentPage: number;
  totalPages: number;
} {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<DownloadProgressData['status']>('queued');
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  useEffect(() => {
    const handleProgressUpdate = (event: CustomEvent<DownloadProgressData>): void => {
      const data = event.detail;
      if (data.taskId === downloadId || data.chapterId === downloadId) {
        setProgress(data.progress);
        setStatus(data.status);

        if (data.filename) {
          const match = data.filename.match(/Page (\d+)\/(\d+)/);
          if (match?.[1] && match[2]) {
            setCurrentPage(parseInt(match[1], 10));
            setTotalPages(parseInt(match[2], 10));
          }
        }
      }
    };

    window.addEventListener('download:progress', handleProgressUpdate as EventListener);

    return () => {
      window.removeEventListener('download:progress', handleProgressUpdate as EventListener);
    };
  }, [downloadId]);

  return { progress, status, currentPage, totalPages };
}
