/**
 * Load More Chapters Component
 *
 * Provides pagination UI for manga with many chapters
 * Allows users to load additional chapters incrementally
 *
 * @module components/manga/LoadMoreChapters
 */

import React from 'react';

import { Card, Group, Button, Text, Progress, Stack, Badge, Alert } from '@mantine/core';
import { IconDownload, IconRefresh, IconAlertCircle } from '@tabler/icons-react';

export interface LoadMoreChaptersProps {
  /** Number of chapters currently loaded */
  loadedCount: number;
  /** Total number of chapters available */
  totalCount: number;
  /** Number of chapters remaining to load */
  remainingCount: number;
  /** Whether there are more chapters to load */
  hasMore: boolean;
  /** Percentage of chapters loaded (0-100) */
  loadedPercentage: number;
  /** Callback to load next batch of chapters */
  onLoadMore: () => void;
  /** Callback to load all remaining chapters */
  onLoadAll: () => void;
  /** Whether chapters are currently loading */
  isLoading?: boolean;
  /** Size of each batch to load (default: 200) */
  batchSize?: number;
}

/**
 * Pagination control for loading additional chapters
 */
export function LoadMoreChapters({
  loadedCount,
  totalCount,
  remainingCount,
  hasMore,
  loadedPercentage,
  onLoadMore,
  onLoadAll,
  isLoading = false,
  batchSize = 200
}: LoadMoreChaptersProps): React.ReactElement {
  if (!hasMore) {
    return (
      <Card withBorder p="md" bg="green.0">
        <Group justify="center">
          <Badge color="green" size="lg" variant="filled">
            ✓ All {totalCount} chapters loaded
          </Badge>
        </Group>
      </Card>
    );
  }

  const nextBatchSize = Math.min(batchSize, remainingCount);
  const isLargeRemaining = remainingCount > 500;

  return (
    <Card withBorder p="md">
      <Stack gap="md">
        {/* Progress indicator */}
        <div>
          <Group justify="space-between" mb="xs">
            <Text size="sm" fw={500}>
              Chapter Loading Progress
            </Text>
            <Text size="sm" c="dimmed">
              {loadedCount} / {totalCount} chapters
            </Text>
          </Group>
          <Progress value={loadedPercentage} size="lg" radius="md" />
        </div>

        {/* Warning for very large manga */}
        {isLargeRemaining && (
          <Alert
            icon={<IconAlertCircle size={16} />}
            color="yellow"
            variant="light"
            title="Large Manga Detected"
          >
            <Text size="sm">
              This manga has {totalCount} chapters. Loading all at once may impact performance.
              Consider loading in batches for better experience.
            </Text>
          </Alert>
        )}

        {/* Action buttons */}
        <Group justify="center" gap="md">
          <Button
            leftSection={<IconDownload size={18} />}
            onClick={onLoadMore}
            loading={isLoading}
            variant="filled"
            size="md"
          >
            Load Next {nextBatchSize} Chapters
          </Button>

          <Button
            leftSection={<IconRefresh size={18} />}
            onClick={onLoadAll}
            loading={isLoading}
            variant="light"
            color="blue"
            size="md"
          >
            Load All ({remainingCount} remaining)
          </Button>
        </Group>

        {/* Info text */}
        <Text size="xs" c="dimmed" ta="center">
          Tip: Use virtual scrolling for smooth performance with large chapter lists
        </Text>
      </Stack>
    </Card>
  );
}

/**
 * Compact version for mobile or sidebar
 */
export function LoadMoreChaptersCompact({
  totalCount,
  remainingCount,
  hasMore,
  onLoadMore,
  isLoading = false
}: Pick<LoadMoreChaptersProps, 'loadedCount' | 'totalCount' | 'remainingCount' | 'hasMore' | 'onLoadMore' | 'isLoading'>): React.ReactElement | null {
  if (!hasMore) {
    return null;
  }

  return (
    <Button
      fullWidth
      leftSection={<IconRefresh size={16} />}
      onClick={onLoadMore}
      loading={isLoading}
      variant="subtle"
      size="sm"
    >
      Load More ({remainingCount} of {totalCount} remaining)
    </Button>
  );
}

/**
 * Chapter count summary card
 */
export function ChapterCountSummary({
  loadedCount,
  totalCount,
  useVirtualScrolling
}: {
  loadedCount: number;
  totalCount: number;
  useVirtualScrolling: boolean;
}): React.ReactElement {
  return (
    <Card withBorder p="sm">
      <Group justify="space-between">
        <div>
          <Text size="xs" c="dimmed">Chapters Loaded</Text>
          <Text size="lg" fw={700}>
            {loadedCount}
            {loadedCount < totalCount && <Text span c="dimmed"> / {totalCount}</Text>}
          </Text>
        </div>

        {useVirtualScrolling && (
          <Badge color="blue" variant="light">
            Virtual Scrolling
          </Badge>
        )}

        {loadedCount >= totalCount && (
          <Badge color="green" variant="filled">
            Complete
          </Badge>
        )}
      </Group>
    </Card>
  );
}
