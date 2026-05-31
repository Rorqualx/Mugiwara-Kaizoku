/**
 * Phase 4 v2-A: chip row for Metadata.contentRating, publicationDemographic,
 * and publishers[]. Pulled out of ContentSection so its conditionals don't
 * push the parent over the complexity cap.
 */

import React from 'react';

import { Badge, Box, Group } from '@mantine/core';

import type { MangaWithRelations } from './types';

interface ClassificationChipRowProps {
  manga: MangaWithRelations;
}

export function ClassificationChipRow({ manga }: ClassificationChipRowProps): React.ReactElement | null {
  const contentRating = manga.Metadata?.contentRating ?? null;
  const demographic = manga.Metadata?.publicationDemographic ?? null;
  const publishers = manga.Metadata?.publishers ?? [];
  const hasPublishers = Array.isArray(publishers) && publishers.length > 0;

  if (contentRating === null && demographic === null && !hasPublishers) return null;

  return (
    <Box mb="lg">
      <Group gap="xs">
        {contentRating !== null && (
          <Badge size="md" variant="light" color={contentRatingColor(contentRating)}>
            {capitalize(contentRating)}
          </Badge>
        )}
        {demographic !== null && (
          <Badge size="md" variant="light" color={demographicColor(demographic)}>
            {capitalize(demographic)}
          </Badge>
        )}
        {hasPublishers && (publishers as string[]).slice(0, 4).map((p, idx) => (
          <a
            key={`pub-${idx}`}
            href={`/browse/publisher/${encodeURIComponent(p)}`}
            style={{ textDecoration: 'none' }}
          >
            <Badge size="md" variant="light" color="gray" style={{ cursor: 'pointer' }}>
              {p}
            </Badge>
          </a>
        ))}
      </Group>
    </Box>
  );
}

const CONTENT_RATING_COLORS: Record<string, string> = {
  safe: 'green',
  suggestive: 'yellow',
  erotica: 'orange',
  pornographic: 'red',
};

function contentRatingColor(rating: string): string {
  return CONTENT_RATING_COLORS[rating.toLowerCase()] ?? 'gray';
}

const DEMOGRAPHIC_COLORS: Record<string, string> = {
  shounen: 'blue',
  shoujo: 'pink',
  seinen: 'indigo',
  josei: 'violet',
};

function demographicColor(demographic: string): string {
  return DEMOGRAPHIC_COLORS[demographic.toLowerCase()] ?? 'gray';
}

function capitalize(s: string): string {
  if (!s) return '';
  return `${s.charAt(0).toUpperCase()}${s.slice(1)}`;
}
