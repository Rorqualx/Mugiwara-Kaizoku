/**
 * MetadataPreviewCompact Component
 *
 * Renders a compact view of manga metadata with cover,
 * title, basic badges, and truncated description.
 */

import React, { memo } from 'react';

import {
  Paper,
  Stack,
  Group,
  Text,
  Badge,
  Image
} from '@mantine/core';

import { ProviderBadge } from '../core/ProviderBadge';

import { getStatusColor, getFormatColor } from './metadata-preview-utils';
import { MetadataQualityBadge } from './MetadataConfidenceDisplay';

interface MetadataPreviewCompactProps {
  /** Manga metadata to display */
  metadata: {
    title: string;
    description?: string;
    cover?: string;
    coverLarge?: string;
    status?: string;
    format?: string;
  };
  /** Source provider information */
  sourceProvider?: string | undefined;
  /** Overall confidence score */
  confidence?: number | undefined;
  /** Whether to show the cover image */
  showCover?: boolean;
  /** Whether to show provider badges */
  showProviders?: boolean;
}

/**
 * Compact metadata preview for use in cards or limited space
 *
 * @returns JSX.Element
 */
export const MetadataPreviewCompact = memo(function MetadataPreviewCompact({
  metadata,
  sourceProvider,
  confidence,
  showCover = true,
  showProviders = true
}: MetadataPreviewCompactProps): JSX.Element {
  const coverImage = metadata.coverLarge ?? metadata.cover;

  return (
    <Paper p="sm" withBorder>
      <Group gap="sm" align="flex-start">
        {showCover && coverImage && (
          <Image
            src={coverImage}
            alt={metadata.title}
            width={60}
            height={90}
            fit="cover"
            radius="sm"
            fallbackSrc="/placeholder-cover.jpg"
          />
        )}
        <Stack gap="xs" style={{ flex: 1 }}>
          <Group gap="xs" justify="space-between">
            <Text fw={500} size="sm" lineClamp={1}>
              {metadata.title}
            </Text>
            {confidence !== undefined && (
              <MetadataQualityBadge confidence={confidence} size="xs" />
            )}
          </Group>
          <Group gap="xs">
            {metadata.status && (
              <Badge size="xs" color={getStatusColor(metadata.status)}>
                {metadata.status}
              </Badge>
            )}
            {metadata.format && (
              <Badge size="xs" variant="light" color={getFormatColor(metadata.format)}>
                {metadata.format}
              </Badge>
            )}
            {sourceProvider && showProviders && (
              <ProviderBadge provider={sourceProvider} size="xs" variant="light" />
            )}
          </Group>
          {metadata.description && (
            <Text size="xs" c="dimmed" lineClamp={2}>
              {metadata.description}
            </Text>
          )}
        </Stack>
      </Group>
    </Paper>
  );
});
