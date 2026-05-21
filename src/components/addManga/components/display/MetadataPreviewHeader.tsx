/**
 * MetadataPreviewHeader Component
 *
 * Renders the header section of metadata preview including
 * cover image, title, alternative titles, status badges, and description.
 */

import React, { memo } from 'react';

import {
  Group,
  Stack,
  Text,
  Badge,
  Image,
  Box,
  Tooltip,
  ActionIcon
} from '@mantine/core';
import { IconPhoto } from '@tabler/icons-react';

import { ProviderBadge } from '../core/ProviderBadge';

import { getStatusColor, getFormatColor } from './metadata-preview-utils';
import { MetadataQualityBadge } from './MetadataConfidenceDisplay';

interface MetadataPreviewHeaderProps {
  /** Manga metadata to display */
  metadata: {
    title: string;
    alternativeTitles?: string[];
    description?: string;
    cover?: string;
    coverLarge?: string;
    bannerImage?: string;
    status?: string;
    format?: string;
  };
  /** Overall confidence score */
  confidence?: number | undefined;
  /** Whether to show the cover image */
  showCover?: boolean;
  /** Whether to show extended metadata */
  showExtended?: boolean;
  /** Whether to show provider badges */
  showProviders?: boolean;
  /** Source provider information */
  sourceProvider?: string | undefined;
  /** Whether to show full details or truncated */
  showDetails: boolean;
}

/**
 * Header section for metadata preview with cover and title information
 *
 * @returns JSX.Element
 */
export const MetadataPreviewHeader = memo(function MetadataPreviewHeader({
  metadata,
  confidence,
  showCover = true,
  showExtended = true,
  showProviders = true,
  sourceProvider,
  showDetails
}: MetadataPreviewHeaderProps): JSX.Element {
  const coverImage = metadata.coverLarge ?? metadata.cover;

  return (
    <Group gap="md" align="flex-start">
      {showCover && coverImage && (
        <Box>
          <Image
            src={coverImage}
            alt={metadata.title}
            width={120}
            height={180}
            fit="cover"
            radius="md"
            fallbackSrc="/placeholder-cover.jpg"
          />
          {metadata.bannerImage && showExtended && (
            <Tooltip label="View banner image">
              <ActionIcon
                variant="light"
                size="sm"
                mt="xs"
                style={{ width: '100%' }}
              >
                <IconPhoto size={14} />
              </ActionIcon>
            </Tooltip>
          )}
        </Box>
      )}

      <Stack gap="xs" style={{ flex: 1 }}>
        <Group gap="xs" justify="space-between">
          <Text fw={600} size="lg">
            {metadata.title}
          </Text>
          {confidence !== undefined && (
            <MetadataQualityBadge confidence={confidence} />
          )}
        </Group>

        {metadata.alternativeTitles &&
          metadata.alternativeTitles.length > 0 &&
          showExtended && (
            <Text size="sm" c="dimmed">
              Also known as: {metadata.alternativeTitles.slice(0, 2).join(', ')}
            </Text>
          )}

        <Group gap="xs">
          {metadata.status && (
            <Badge color={getStatusColor(metadata.status)}>
              {metadata.status}
            </Badge>
          )}
          {metadata.format && (
            <Badge variant="light" color={getFormatColor(metadata.format)}>
              {metadata.format}
            </Badge>
          )}
          {sourceProvider && showProviders && (
            <ProviderBadge provider={sourceProvider} size="sm" />
          )}
        </Group>

        {metadata.description && (
          <Text size="sm" c="dimmed" {...(!showDetails && { lineClamp: 3 })}>
            {metadata.description}
          </Text>
        )}
      </Stack>
    </Group>
  );
});
