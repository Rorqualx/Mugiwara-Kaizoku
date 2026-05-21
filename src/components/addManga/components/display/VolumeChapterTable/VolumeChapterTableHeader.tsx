/**
 * Header component for VolumeChapterTable
 * Displays statistics and provider information
 */

import React from 'react';

import { Group, Text, Badge } from '@mantine/core';

import { ProviderBadge } from '@/components/addManga/components/core/ProviderBadge';


interface VolumeChapterTableHeaderProps {
  stats: {
    totalVolumes: number;
    totalChapters: number;
    selectedVolumes: number;
    selectedChapters: number;
  };
  volumeProvider: string;
  chapterProvider: string;
  showProviderBadges: boolean;
  selectable: boolean;
}

export const VolumeChapterTableHeader = React.memo(function VolumeChapterTableHeader({
  stats,
  volumeProvider,
  chapterProvider,
  showProviderBadges,
  selectable,
}: VolumeChapterTableHeaderProps): React.ReactElement {
  return (
    <>
      {/* Header with stats */}
      <Group justify="space-between">
        <Group gap="xs">
          <Text fw={500}>Volume & Chapter Data</Text>
          <Badge variant="filled" color="blue">
            {stats.totalVolumes} {stats.totalVolumes === 1 ? 'volume' : 'volumes'}
          </Badge>
          <Badge variant="filled" color="green">
            {stats.totalChapters} {stats.totalChapters === 1 ? 'chapter' : 'chapters'}
          </Badge>
        </Group>

        {selectable && (stats.selectedVolumes > 0 || stats.selectedChapters > 0) && (
          <Group gap="xs">
            <Badge variant="outline" color="blue">
              {stats.selectedVolumes} {stats.selectedVolumes === 1 ? 'volume' : 'volumes'} selected
            </Badge>
            <Badge variant="outline" color="green">
              {stats.selectedChapters} {stats.selectedChapters === 1 ? 'chapter' : 'chapters'} selected
            </Badge>
          </Group>
        )}
      </Group>

      {/* Provider info */}
      {showProviderBadges && (
        <Group gap="xs">
          <Text size="sm" c="dimmed">Sources:</Text>
          <Group gap="xs">
            <ProviderBadge provider={volumeProvider} />
            <Text size="sm" c="dimmed">for volumes</Text>
          </Group>
          <Text size="sm" c="dimmed">•</Text>
          <Group gap="xs">
            <ProviderBadge provider={chapterProvider} />
            <Text size="sm" c="dimmed">for chapters</Text>
          </Group>
        </Group>
      )}
    </>
  );
});
