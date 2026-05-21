/**
 * Compact view for metadata display
 * @module components/manga/MangaMetadataViewer/components/CompactView
 */

import React from 'react';

import { Stack, Group, Badge, Image, Text } from '@mantine/core';

import type { ExtractedMetadata } from '../utils';

interface CompactViewProps {
  metadata: ExtractedMetadata;
}

export function CompactView({ metadata }: CompactViewProps): React.ReactElement {
  return (
    <Stack gap="xs">
      {metadata.cover && (
        <Image
          src={metadata.cover}
          alt={metadata.title}
          height={200}
          fit="contain"
        />
      )}

      <Group gap="xs">
        <Badge size="sm" variant="dot">
          {metadata.format}
        </Badge>
        {metadata.score && (
          <Badge size="sm" color="yellow">
            ★ {metadata.score}
          </Badge>
        )}
        {metadata.chapters && (
          <Badge size="sm" color="gray">
            {metadata.chapters} chapters
          </Badge>
        )}
      </Group>

      {metadata.description && (
        <Text size="sm" lineClamp={3}>
          {metadata.description}
        </Text>
      )}
    </Stack>
  );
}
