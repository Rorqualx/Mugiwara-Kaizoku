/**
 * Chapter Detail Modal - History Tab
 *
 * Displays download history timelines for chapter-specific
 * and manga-level (volume/pack) downloads.
 *
 * Extracted from: ChapterDetailModal.tsx (lines 726-850)
 */

import React from 'react';

import {
  Stack,
  Group,
  Text,
  Alert,
  Loader,
  Center,
  Paper,
  Badge,
  Divider,
  Timeline
} from '@mantine/core';
import {
  IconClock,
  IconCheck,
  IconAlertCircle,
  IconInfoCircle
} from '@tabler/icons-react';

import { formatDateTime } from './utils';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Download history entry for chapter downloads
 */
export interface ChapterDownloadHistoryEntry {
  timestamp: Date;
  status: string;
  source: string;
  size?: string;
  duration?: string;
  error?: string;
}

/**
 * Download history entry for manga pack/volume downloads
 */
export interface MangaDownloadHistoryEntry {
  timestamp: Date;
  status: string;
  source: string;
  mode: string;
  releaseTitle: string;
  size?: string;
  duration?: string;
  error?: string;
}

/**
 * Props for the HistoryTab component
 */
export interface HistoryTabProps {
  /** Whether chapter download history is loading */
  isChapterHistoryLoading: boolean;
  /** Whether manga download history is loading */
  isMangaHistoryLoading: boolean;
  /** Error from chapter download history query */
  chapterHistoryError: { message: string } | null;
  /** Error from manga download history query */
  mangaHistoryError: { message: string } | null;
  /** Chapter-specific download history entries */
  downloadHistory: ChapterDownloadHistoryEntry[];
  /** Manga-level (pack/volume) download history entries */
  mangaDownloadHistory: MangaDownloadHistoryEntry[];
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Map status string to display status
 */
function mapStatus(status: string): 'completed' | 'failed' | 'started' {
  const lowerStatus = status.toLowerCase();
  if (lowerStatus === 'completed' || lowerStatus === 'success') return 'completed';
  if (lowerStatus === 'failed' || lowerStatus === 'error') return 'failed';
  return 'started';
}

// ============================================================================
// Component
// ============================================================================

/**
 * History Tab Component
 *
 * Displays download history for both chapter-specific downloads
 * and manga-level pack/volume downloads in a timeline format.
 */
export function HistoryTab({
  isChapterHistoryLoading,
  isMangaHistoryLoading,
  chapterHistoryError,
  mangaHistoryError,
  downloadHistory,
  mangaDownloadHistory
}: HistoryTabProps): JSX.Element {
  const isLoading = isChapterHistoryLoading || isMangaHistoryLoading;
  const error = chapterHistoryError ?? mangaHistoryError;

  return (
    <Stack gap="md">
      {/* Loading State */}
      {isLoading && (
        <Center p="xl">
          <Loader size="lg" />
        </Center>
      )}

      {/* Error State */}
      {error && (
        <Alert color="red" icon={<IconAlertCircle size={16} />}>
          <Text size="sm">
            Error loading download history: {chapterHistoryError?.message ?? mangaHistoryError?.message}
          </Text>
        </Alert>
      )}

      {/* Chapter Downloads Section */}
      {!isChapterHistoryLoading && !chapterHistoryError && downloadHistory.length > 0 && (
        <>
          <Divider label="Chapter Downloads" labelPosition="center" />
          <Timeline active={-1} bulletSize={24} lineWidth={2}>
            {downloadHistory.map((entry, index) => {
              const displayStatus = mapStatus(entry.status);
              return (
                <Timeline.Item
                  key={`chapter-${index}`}
                  bullet={
                    displayStatus === 'completed' ? <IconCheck size={16} /> :
                    displayStatus === 'failed' ? <IconAlertCircle size={16} /> :
                    <IconClock size={16} />
                  }
                  color={displayStatus === 'completed' ? 'green' : displayStatus === 'failed' ? 'red' : 'blue'}
                  title={
                    <Group gap="xs">
                      <Text size="sm" fw={500}>
                        {displayStatus === 'completed' ? 'Downloaded Successfully' :
                         displayStatus === 'failed' ? 'Download Failed' : 'Download Started'}
                      </Text>
                      <Badge size="sm" variant="light" color={displayStatus === 'completed' ? 'green' : 'red'}>
                        {entry.source}
                      </Badge>
                    </Group>
                  }
                >
                  <Stack gap={4}>
                    <Text size="xs" c="dimmed">{formatDateTime(entry.timestamp)}</Text>
                    {entry.size && <Text size="xs">Size: {entry.size}</Text>}
                    {entry.duration && <Text size="xs">Duration: {entry.duration}</Text>}
                    {entry.error && (
                      <Alert color="red" variant="light" icon={<IconAlertCircle size={16} />} mt="xs">
                        <Text size="xs">{entry.error}</Text>
                      </Alert>
                    )}
                  </Stack>
                </Timeline.Item>
              );
            })}
          </Timeline>
        </>
      )}

      {/* Manga Pack Downloads Section */}
      {!isMangaHistoryLoading && !mangaHistoryError && mangaDownloadHistory.length > 0 && (
        <>
          <Divider label="Volume/Pack Downloads" labelPosition="center" />
          <Alert icon={<IconInfoCircle size={16} />} color="blue" variant="light">
            <Text size="xs">
              These are volume packs or bulk downloads that may contain this chapter
            </Text>
          </Alert>
          <Timeline active={-1} bulletSize={24} lineWidth={2}>
            {mangaDownloadHistory.map((entry, index) => {
              const displayStatus = mapStatus(entry.status);
              return (
                <Timeline.Item
                  key={`manga-${index}`}
                  bullet={
                    displayStatus === 'completed' ? <IconCheck size={16} /> :
                    displayStatus === 'failed' ? <IconAlertCircle size={16} /> :
                    <IconClock size={16} />
                  }
                  color={displayStatus === 'completed' ? 'green' : displayStatus === 'failed' ? 'red' : 'blue'}
                  title={
                    <Group gap="xs">
                      <Text size="sm" fw={500}>
                        {displayStatus === 'completed' ? 'Downloaded Successfully' :
                         displayStatus === 'failed' ? 'Download Failed' : 'Download Started'}
                      </Text>
                      <Badge size="sm" variant="light" color="grape">
                        {entry.mode}
                      </Badge>
                      <Badge size="sm" variant="light" color={displayStatus === 'completed' ? 'green' : 'red'}>
                        {entry.source}
                      </Badge>
                    </Group>
                  }
                >
                  <Stack gap={4}>
                    <Text size="xs" fw={500} c="dimmed">{entry.releaseTitle}</Text>
                    <Text size="xs" c="dimmed">{formatDateTime(entry.timestamp)}</Text>
                    {entry.size && <Text size="xs">Size: {entry.size}</Text>}
                    {entry.duration && <Text size="xs">Duration: {entry.duration}</Text>}
                    {entry.error && (
                      <Alert color="red" variant="light" icon={<IconAlertCircle size={16} />} mt="xs">
                        <Text size="xs">{entry.error}</Text>
                      </Alert>
                    )}
                  </Stack>
                </Timeline.Item>
              );
            })}
          </Timeline>
        </>
      )}

      {/* Empty State */}
      {!isLoading && !error && downloadHistory.length === 0 && mangaDownloadHistory.length === 0 && (
        <Paper p="xl" withBorder style={{ textAlign: 'center' }}>
          <IconClock size={48} color="var(--mantine-color-dimmed)" />
          <Text size="lg" c="dimmed" mt="md">
            No download history available
          </Text>
          <Text size="sm" c="dimmed" mt="xs">
            Download attempts will be tracked here
          </Text>
        </Paper>
      )}
    </Stack>
  );
}
