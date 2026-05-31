/**
 * ContentSection Component
 *
 * Displays description, genres, and tags for the manga.
 * Handles both collapsed (with line clamp) and expanded views.
 *
 * Extracted from: MangaBannerSection.tsx (lines 697-762)
 *
 * @module components/manga/MangaBannerSection/ContentSection
 */

import React from 'react';

import { Box, Text, Group, Badge } from '@mantine/core';

import { stripHtmlTags } from '@/components/manga/mangaDetailUtils';

import { ClassificationChipRow } from './ClassificationChipRow';
import { TagChipRow } from './TagChipRow';

import type { MangaMetadata, MangaWithRelations } from './types';

// Temporary: parseHtmlContent is just stripHtmlTags for now
const parseHtmlContent = stripHtmlTags;

/**
 * Props for ContentSection component
 */
interface ContentSectionProps {
  /** The manga data to display */
  manga: MangaWithRelations;
  /** Extracted metadata from the manga */
  extractedMetadata: MangaMetadata | null;
  /** Whether details section is expanded */
  isDetailsExpanded: boolean;
}

/**
 * ContentSection Component
 *
 * Renders the main description, genres, and tags sections
 * of the manga detail page.
 *
 * @param props - Component props
 * @returns The content section with description, genres, and tags
 */
export function ContentSection({
  manga,
  extractedMetadata,
  isDetailsExpanded,
}: ContentSectionProps): React.ReactElement {
  // Extract description from metadata or manga summary
  const description =
    typeof extractedMetadata?.description === 'string'
      ? extractedMetadata.description
      : (manga.Metadata?.summary ?? '');

  // Extract genres array from metadata
  const genres = extractedMetadata?.genres;
  const hasGenres = genres && Array.isArray(genres) && genres.length > 0;


  return (
    <>
      {/* Main Description */}
      {description && (
        <Box mb="lg" style={{ maxWidth: '100%' }}>
          <Text size="sm" fw={600} c="gray.3" mb="xs">
            Description:
          </Text>
          {isDetailsExpanded ? (
            <Box c="gray.3">{parseHtmlContent(description)}</Box>
          ) : (
            <Text c="gray.3" size="md" lineClamp={3}>
              {stripHtmlTags(description)}
            </Text>
          )}
        </Box>
      )}

      {/* Phase 4 v2-A: contentRating / demographic / publishers chip row */}
      <ClassificationChipRow manga={manga} />

      {/* Phase 4 v2-A: themes + tags chip row (always visible, with +X expander) */}
      <TagChipRow manga={manga} />

      {/* Expandable Details Section */}
      {isDetailsExpanded && hasGenres && (
        <Box mb="lg">
          <Text size="sm" fw={600} c="gray.3" mb="xs">
            Genres:
          </Text>
          <Group gap="xs">
            {genres.map((genre: unknown, index: number) => (
              <a key={index} href={`/browse/${encodeURIComponent(String(genre))}`} style={{ textDecoration: 'none' }}>
                <Badge size="sm" variant="light" color="blue" style={{ cursor: 'pointer' }}>
                  {String(genre)}
                </Badge>
              </a>
            ))}
          </Group>
        </Box>
      )}
    </>
  );
}

