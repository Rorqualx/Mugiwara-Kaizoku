/**
 * DetectMatchStage Progress Components
 *
 * Progress bars and activity feed for the detect+match stage.
 *
 * @module components/library/import-pipeline/stages/DetectMatchStage/ProgressComponents
 */

import type { JSX } from 'react';

import { Stack, Group, Text, Paper, Progress, Badge } from '@mantine/core';
import { IconLoader2 } from '@tabler/icons-react';

import type { DetectMatchProgress, MatchedMangaItem } from '@/components/library/import-pipeline/types';

// ============================================================================
// Dual Progress Bar
// ============================================================================

interface DualProgressProps {
  progress: DetectMatchProgress;
  isActive: boolean;
}

// eslint-disable-next-line complexity -- Dual progress display with scan/match state tracking and conditional rendering
export function DualProgress({ progress, isActive }: DualProgressProps): JSX.Element {
  const scanPct = progress.scanTotal > 0 ? Math.round((progress.scanCurrent / progress.scanTotal) * 100) : 0;
  const matchPct = progress.matchTotal > 0 ? Math.round((progress.matchCurrent / progress.matchTotal) * 100) : 0;

  const getScanStatusText = (): string => {
    if (progress.isScanComplete) return `Complete - ${progress.scanCurrent} items found`;
    if (progress.scanTotal === 0 && isActive) return progress.scanStatus || 'Scanning...';
    return `${progress.scanCurrent} / ${progress.scanTotal} files`;
  };

  const getMatchStatusText = (): string => {
    if (progress.isMatchComplete) return `Complete - ${progress.matchCurrent} matched`;
    if (progress.matchTotal === 0) {
      if (isActive && !progress.isScanComplete) return 'Waiting for scan...';
      return 'No items to match';
    }
    return `${progress.matchCurrent} / ${progress.matchTotal} matched`;
  };

  const isScanSpinning = isActive && !progress.isScanComplete;
  const isMatchSpinning = isActive && !progress.isMatchComplete && (progress.matchQueue > 0 || progress.matchTotal > 0);

  return (
    <Paper p="md" withBorder>
      <Stack gap="md">
        {/* Scan Progress */}
        <div>
          <Group justify="space-between" mb="xs">
            <Group gap="xs">
              {isScanSpinning && (
                <IconLoader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
              )}
              <Text size="sm" fw={500}>Scan Progress</Text>
              {progress.scanStatus && isActive && !progress.isScanComplete && (
                <Text size="xs" c="dimmed">({progress.scanStatus})</Text>
              )}
            </Group>
            <Text size="sm" c="dimmed">{getScanStatusText()}</Text>
          </Group>
          <Progress
            value={progress.isScanComplete ? 100 : (isScanSpinning && scanPct === 0 ? 5 : scanPct)}
            animated={isScanSpinning}
            size="md"
            color={progress.isScanComplete ? 'green' : 'blue'}
          />
        </div>

        {/* Match Progress */}
        <div>
          <Group justify="space-between" mb="xs">
            <Group gap="xs">
              {isMatchSpinning && (
                <IconLoader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
              )}
              <Text size="sm" fw={500}>Match Progress</Text>
            </Group>
            <Group gap="sm">
              {progress.matchQueue > 0 && (
                <Badge size="sm" variant="light" color="blue">Queued: {progress.matchQueue}</Badge>
              )}
              {progress.matchCurrent > 0 && !progress.isMatchComplete && (
                <Badge size="sm" variant="light" color="green">Done: {progress.matchCurrent}</Badge>
              )}
              <Text size="sm" c="dimmed">{getMatchStatusText()}</Text>
            </Group>
          </Group>
          <Progress
            value={progress.isMatchComplete ? 100 : matchPct}
            animated={isMatchSpinning}
            size="md"
            color={progress.isMatchComplete ? 'green' : 'violet'}
          />
        </div>
      </Stack>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </Paper>
  );
}

// ============================================================================
// Live Activity Feed
// ============================================================================

interface LiveActivityFeedProps {
  items: MatchedMangaItem[];
  isActive: boolean;
}

export function LiveActivityFeed({ items, isActive }: LiveActivityFeedProps): JSX.Element | null {
  const recentItems = [...items]
    .sort((a, b) => b.lastUpdated - a.lastUpdated)
    .slice(0, 5);

  if (recentItems.length === 0 && !isActive) return null;

  const getStatusIcon = (item: MatchedMangaItem): JSX.Element => {
    if (item.isSearching) {
      return <IconLoader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />;
    }
    if (item.status === 'matched' || item.status === 'manual') {
      return <Badge size="xs" color="green" variant="filled" circle>✓</Badge>;
    }
    if (item.status === 'low_confidence') {
      return <Badge size="xs" color="yellow" variant="filled" circle>?</Badge>;
    }
    if (item.status === 'no_match') {
      return <Badge size="xs" color="red" variant="filled" circle>✗</Badge>;
    }
    return <Badge size="xs" color="gray" variant="light" circle>○</Badge>;
  };

  return (
    <Paper p="sm" withBorder bg="var(--mantine-color-dark-7)">
      <Text size="xs" fw={500} c="dimmed" mb="xs">Recent Activity</Text>
      <Stack gap={4}>
        {recentItems.length === 0 && isActive && (
          <Text size="xs" c="dimmed">Waiting for items...</Text>
        )}
        {recentItems.map((item) => (
          <Group key={item.id} gap="xs" wrap="nowrap">
            {getStatusIcon(item)}
            <Text size="xs" lineClamp={1} style={{ flex: 1 }}>
              {item.parsedTitle}
            </Text>
            {item.selectedMatch && (
              <Text size="xs" c="dimmed" lineClamp={1}>
                → {item.selectedMatch.title}
              </Text>
            )}
            {item.isSearching && (
              <Text size="xs" c="blue">matching...</Text>
            )}
          </Group>
        ))}
      </Stack>
    </Paper>
  );
}
