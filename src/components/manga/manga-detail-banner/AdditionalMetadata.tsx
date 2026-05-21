/**
 * AdditionalMetadata Component
 *
 * Displays additional metadata fields including genres, authors, and total file size.
 *
 * Extracted from: MangaDetailBanner.tsx (lines 405-468)
 *
 * @module components/manga/manga-detail-banner/AdditionalMetadata
 */

import * as React from 'react';

import { Badge, Box, Group, Text } from '@mantine/core';

import { formatFileSize, getFirstProvenance } from '@/components/manga/mangaDetailUtils';
import { LabeledField } from '@/components/metadata/LabeledField';
import { ProviderBadge } from '@/components/metadata/ProviderBadge';
import { ProviderStrengthIndicator } from '@/components/metadata/ProviderStrengthIndicator';
import { getMetadataStringArray } from '@/utils/entityMetadataUtils';

import type { AdditionalMetadataProps } from './types';

/**
 * AdditionalMetadata Component
 *
 * Renders genres, authors, and file size information.
 */
export function AdditionalMetadata({
  manga,
  totalSize
}: AdditionalMetadataProps): React.ReactElement {
  const genres = getMetadataStringArray(manga, 'genres');
  const authors = getMetadataStringArray(manga, 'authors');

  return (
    <Group gap="lg" mb="md" align="flex-start">
      {genres.length > 0 && (
        <Box>
          <Group gap="xs" mb="xs">
            <Text fw={500} c="white">
              Genres
            </Text>
            {getFirstProvenance(manga, 'genres') && (
              <>
                <ProviderBadge providerId={getFirstProvenance(manga, 'genres') ?? ''} size="xs" />
                <ProviderStrengthIndicator
                  providerId={getFirstProvenance(manga, 'genres') ?? ''}
                  fieldName="genres"
                  mode="minimal"
                  size="xs"
                />
              </>
            )}
          </Group>
          <Group gap="xs">
            {genres.map((genre, index) => (
              <a key={index} href={`/browse/${encodeURIComponent(genre)}`} style={{ textDecoration: 'none' }}>
                <Badge color="gray" style={{ cursor: 'pointer' }}>
                  {genre}
                </Badge>
              </a>
            ))}
          </Group>
        </Box>
      )}

      {authors.length > 0 && (
        <LabeledField
          label="Authors"
          value={authors.join(', ')}
          providerId={getFirstProvenance(manga, 'authors') ?? ''}
          labelProps={{ c: 'white' }}
          valueProps={{ c: 'gray.3' }}
          showStrength
          fieldName="authors"
        />
      )}

      {totalSize > 0 && (
        <LabeledField
          label="Total Size"
          value={formatFileSize(totalSize)}
          labelProps={{ c: 'white' }}
          valueProps={{ c: 'gray.3' }}
        />
      )}
    </Group>
  );
}
