/**
 * Download Progress Cell Component
 *
 * Displays download progress with a visual progress bar and optional speed.
 *
 * @module components/jobs/history/DownloadProgressCell
 */
import React from 'react';

import { Group, Progress, Text } from '@mantine/core';

interface DownloadProgressCellProps {
  progress: number | null;
  status: string;
  speed?: number | undefined;
}

/**
 * Format bytes per second to human-readable speed string
 */
function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec >= 1024 * 1024) {
    return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
  }
  if (bytesPerSec >= 1024) {
    return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
  }
  return `${Math.round(bytesPerSec)} B/s`;
}

/**
 * Renders a progress cell for download jobs
 *
 * - Shows "100%" for completed jobs
 * - Shows "-" for failed/cancelled jobs
 * - Shows progress bar with percentage for in-progress jobs
 * - Optionally shows download speed
 */
export function DownloadProgressCell({
  progress,
  status,
  speed
}: DownloadProgressCellProps): React.ReactElement {
  // Completed jobs show 100%
  if (status === 'completed') {
    return (
      <Text size="sm" c="green" fw={500}>
        100%
      </Text>
    );
  }

  // Failed/cancelled jobs show "-"
  if (status === 'failed' || status === 'cancelled') {
    return (
      <Text size="sm" c="dimmed">
        -
      </Text>
    );
  }

  const pct = progress ?? 0;

  // Pending jobs with no progress
  if (pct === 0 && (status === 'pending' || status === 'retrying')) {
    return (
      <Text size="sm" c="dimmed">
        Queued
      </Text>
    );
  }

  return (
    <Group gap="xs" wrap="nowrap">
      <Progress
        value={pct}
        size="sm"
        w={80}
        color={pct > 0 ? 'blue' : 'gray'}
        styles={{
          root: { backgroundColor: 'var(--mantine-color-dark-5)' }
        }}
      />
      <Text size="xs" c="dimmed" style={{ minWidth: 32 }}>
        {pct}%
      </Text>
      {speed !== undefined && speed > 0 && (
        <Text size="xs" c="dimmed">
          ({formatSpeed(speed)})
        </Text>
      )}
    </Group>
  );
}
