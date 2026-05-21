/**
 * ContentSummarySection Component
 *
 * Displays a summary of content counts including provider, volumes,
 * chapters, cover images, and external links.
 */

import React from 'react';

import {
  Paper,
  Stack,
  Title,
  Group,
  Text,
  Badge,
} from '@mantine/core';

import type { MediaGallery, VolumeData } from '../types';

interface ContentSummarySectionProps {
  provider: string;
  volumesData: VolumeData;
  selectedChapters: unknown[] | undefined;
  mediaGallery: MediaGallery;
  selectedBanner: string | undefined;
  selectedGalleryImages: string[];
  externalLinks: string[];
  metadataVersion: number;
}

export const ContentSummarySection: React.FC<ContentSummarySectionProps> = React.memo(({
  provider,
  volumesData,
  selectedChapters,
  mediaGallery,
  selectedBanner,
  selectedGalleryImages,
  externalLinks,
  metadataVersion,
}) => {
  return (
    <Paper p="md" key={`summary-${metadataVersion}`}>
      <Title order={5} mb="md">Content Summary</Title>
      <Stack gap="xs">
        <Group justify="space-between">
          <Text size="sm">Provider</Text>
          <Badge>{provider}</Badge>
        </Group>
        <Group justify="space-between">
          <Text size="sm">Volumes</Text>
          <Badge color="blue">{volumesData.totalVolumes ?? 0}</Badge>
        </Group>
        <Group justify="space-between">
          <Text size="sm">Chapters</Text>
          <Badge color="cyan">{selectedChapters?.length ?? 0}</Badge>
        </Group>
        <Group justify="space-between">
          <Text size="sm">Cover Images</Text>
          <Badge color="green">{mediaGallery.covers.length}</Badge>
        </Group>
        {selectedBanner && (
          <Group justify="space-between">
            <Text size="sm">Banner Image</Text>
            <Badge color="indigo">Selected</Badge>
          </Group>
        )}
        <Group justify="space-between">
          <Text size="sm">Gallery Images</Text>
          <Badge color="violet">{selectedGalleryImages.length}</Badge>
        </Group>
        {externalLinks.filter(l => l).length > 0 && (
          <Group justify="space-between">
            <Text size="sm">External Links</Text>
            <Badge color="orange">{externalLinks.filter(l => l).length}</Badge>
          </Group>
        )}
      </Stack>
    </Paper>
  );
});

ContentSummarySection.displayName = 'ContentSummarySection';
