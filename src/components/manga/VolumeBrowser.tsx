/**
 * Volume Browser Component
 *
 * Displays enhanced volume data from provider metadata with expandable chapter lists.
 * Supports data from ComicVine, Fandom, AniList, and other providers.
 *
 * Features:
 * - Expandable volume cards with cover images
 * - Chapter lists within each volume
 * - Release dates, ISBNs, and page counts
 * - Theme and story arc badges
 * - Creator credits display
 *
 * @module VolumeBrowser
 */

import React, { useState, useMemo } from 'react';

import { Stack, Grid, Group, ActionIcon, Text } from '@mantine/core';
import { IconChevronDown } from '@tabler/icons-react';

import {
  VolumeBrowserHeader,
  VolumeBrowserMetadata,
  VolumeCard,
  VolumeBrowserSkeleton,
  VolumeBrowserEmpty
} from './volume-browser/components';

import type { VolumeBrowserProps } from './volume-browser/types';

// Re-export types for backwards compatibility
export type { ProviderVolumeMetadata, VolumeBrowserProps } from './volume-browser/types';

// ============================================================================
// Main Component
// ============================================================================

/**
 * Displays enhanced volume data from provider metadata
 */
export function VolumeBrowser({
  providerData,
  provider,
  isLoading = false,
  initialDisplayCount = 10,
  onChapterClick,
  onVolumeClick: _onVolumeClick
}: VolumeBrowserProps): React.ReactElement {
  const [expandedVolumes, setExpandedVolumes] = useState<Set<number>>(new Set());
  const [showAll, setShowAll] = useState(false);

  const volumes = useMemo(() => {
    return providerData?.volumeData ?? [];
  }, [providerData?.volumeData]);

  const displayedVolumes = useMemo(() => {
    if (showAll) return volumes;
    return volumes.slice(0, initialDisplayCount);
  }, [volumes, showAll, initialDisplayCount]);

  const toggleVolume = (volumeNumber: number): void => {
    setExpandedVolumes((prev) => {
      const next = new Set(prev);
      if (next.has(volumeNumber)) {
        next.delete(volumeNumber);
      } else {
        next.add(volumeNumber);
      }
      return next;
    });
  };

  // Loading state
  if (isLoading) {
    return <VolumeBrowserSkeleton />;
  }

  // Empty state
  if (volumes.length === 0) {
    return <VolumeBrowserEmpty />;
  }

  const hasMoreVolumes = volumes.length > initialDisplayCount;

  return (
    <Stack gap="md">
      {/* Header with stats */}
      <VolumeBrowserHeader
        totalVolumes={providerData?.totalVolumes ?? volumes.length}
        volumeCount={volumes.length}
        provider={provider}
        lastFetched={providerData?.lastFetched}
      />

      {/* Creator credits, themes, and story arcs */}
      <VolumeBrowserMetadata
        creators={providerData?.creators}
        themes={providerData?.themes}
        storyArcs={providerData?.storyArcs}
      />

      {/* Volume Grid */}
      <Grid gutter="md">
        {displayedVolumes.map((volume) => (
          <Grid.Col key={volume.number} span={{ base: 12, md: 6 }}>
            <VolumeCard
              volume={volume}
              isExpanded={expandedVolumes.has(volume.number)}
              onToggle={() => toggleVolume(volume.number)}
              onChapterClick={onChapterClick}
            />
          </Grid.Col>
        ))}
      </Grid>

      {/* Show More/Less */}
      {hasMoreVolumes && (
        <Group justify="center">
          <ActionIcon
            variant="subtle"
            size="lg"
            onClick={() => setShowAll(!showAll)}
            aria-label={showAll ? 'Show less' : 'Show more'}
          >
            <IconChevronDown
              size={24}
              style={{
                transform: showAll ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 200ms'
              }}
            />
          </ActionIcon>
          <Text size="sm" c="dimmed">
            {showAll
              ? 'Show less'
              : `Show ${volumes.length - initialDisplayCount} more volumes`}
          </Text>
        </Group>
      )}
    </Stack>
  );
}

export default VolumeBrowser;
