/**
 * Download Feed Component
 *
 * Shows real-time notifications for download progress, job updates,
 * import progress, and search results as flat notification bubbles.
 * Each notification auto-dismisses after 10 seconds via the useDownloadFeed hook.
 */
import React from 'react';

import { Box, Text, Badge } from '@mantine/core';
import {
  IconDownload,
  IconPlayerPlay,
  IconFileDownload,
  IconAlertTriangle,
  IconSearch,
} from '@tabler/icons-react';

import { useDownloadFeed } from '@/hooks/useDownloadFeed';
import type { FeedMessage, FeedSeverity, FeedType } from '@/hooks/useDownloadFeed';

import classes from './EventsPanel.module.css';

// ============================================================================
// Helpers
// ============================================================================

function getFeedIcon(type: FeedType, severity: FeedSeverity): React.ReactElement {
  if (severity === 'error') return <IconAlertTriangle size={14} color="var(--mantine-color-red-6)" />;
  if (type === 'search') return <IconSearch size={14} color="var(--mantine-color-orange-6)" />;
  if (type === 'download') return <IconDownload size={14} color="var(--mantine-color-blue-6)" />;
  if (type === 'import') return <IconFileDownload size={14} color="var(--mantine-color-teal-6)" />;
  return <IconPlayerPlay size={14} color="var(--mantine-color-violet-6)" />;
}

function getSeverityColor(severity: FeedSeverity): string {
  const colorMap: Record<FeedSeverity, string> = {
    info: 'blue', success: 'green', warning: 'yellow', error: 'red',
  };
  return colorMap[severity];
}

function getTypeLabel(type: FeedType): string {
  const labelMap: Record<FeedType, string> = {
    download: 'Download', job: 'Job', import: 'Import', failure: 'Failed', search: 'Search',
  };
  return labelMap[type];
}

// ============================================================================
// Sub-components
// ============================================================================

function FeedItem({ message }: { message: FeedMessage }): React.ReactElement {
  return (
    <Box className={classes.event} style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
      {getFeedIcon(message.type, message.severity)}
      <Badge size="xs" color={getSeverityColor(message.severity)} variant="light" style={{ flexShrink: 0 }}>
        {getTypeLabel(message.type)}
      </Badge>
      <Text size="xs" style={{ flex: 1, wordBreak: 'break-word' }}>
        {message.summary}
      </Text>
      {message.progress !== undefined && message.severity === 'info' && (
        <Badge size="xs" color="blue" variant="outline" style={{ flexShrink: 0 }}>
          {Math.round(message.progress)}%
        </Badge>
      )}
    </Box>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function DownloadFeed(): React.ReactElement | null {
  const { messages, messageCount } = useDownloadFeed();

  if (messageCount === 0) return null;

  return (
    <>
      {messages.map((msg) => <FeedItem key={msg.id} message={msg} />)}
    </>
  );
}
