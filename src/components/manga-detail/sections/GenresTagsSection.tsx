/**
 * Genres and Tags Section Component
 *
 * Displays genre and tag badges with hover effects.
 *
 * Extracted from: mangaDetail.tsx (lines 336-379)
 */

import React from 'react';

import { Badge, Box, Group, Title } from '@mantine/core';
import Link from 'next/link';

import type { MangaWithMetadataAndChapters } from '../types';

export interface GenresTagsSectionProps {
  manga: MangaWithMetadataAndChapters;
}

/**
 * Genres and tags section with badges
 */
export function GenresTagsSection({ manga }: GenresTagsSectionProps): React.ReactElement | null {
  // Don't render if no genres or tags
  if (manga.metadata.genres.length === 0 && manga.metadata.tags.length === 0) {
    return null;
  }

  return (
    <Box mt="lg">
      <Title order={4} mb="md">Genres & Tags</Title>
      <Group gap={8} wrap="wrap">
        {manga.metadata.genres.map((genre) => (
          <Link key={genre} href={`/browse/${encodeURIComponent(genre)}`} style={{ textDecoration: 'none' }}>
            <Badge
              variant="filled"
              color="blue"
              size="lg"
              radius="sm"
              style={{
                cursor: 'pointer',
                transition: 'all 150ms ease',
              }}
            >
              {genre}
            </Badge>
          </Link>
        ))}

        {manga.metadata.tags.map((tag) => (
          <Link key={tag} href={`/browse/tag/${encodeURIComponent(tag)}`} style={{ textDecoration: 'none' }}>
            <Badge
              variant="outline"
              color="indigo"
              size="lg"
              radius="sm"
              style={{ cursor: 'pointer', transition: 'all 150ms ease' }}
            >
              {tag}
            </Badge>
          </Link>
        ))}
      </Group>
    </Box>
  );
}
