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

  // Extract tags array from metadata
  const tags = extractedMetadata?.tags;
  const hasTags = tags && Array.isArray(tags) && tags.length > 0;

  // Extract themes array from metadata
  const themes = extractedMetadata?.['themes'];
  const hasThemes = themes && Array.isArray(themes) && themes.length > 0;

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

      {/* Expandable Details Section */}
      {isDetailsExpanded && (
        <>
          {/* Genres */}
          {hasGenres && (
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

          {/* Tags */}
          {hasTags && (
            <Box mb="lg">
              <Text size="sm" fw={600} c="gray.3" mb="xs">
                Tags:
              </Text>
              <Group gap="xs">
                {tags.map((tag: unknown, index: number) => (
                  <a key={index} href={`/browse/tag/${encodeURIComponent(String(tag))}`} style={{ textDecoration: 'none' }}>
                    <Badge size="sm" variant="light" color="violet" style={{ cursor: 'pointer' }}>
                      {String(tag)}
                    </Badge>
                  </a>
                ))}
              </Group>
            </Box>
          )}

          {/* Themes */}
          {hasThemes && (
            <Box mb="lg">
              <Text size="sm" fw={600} c="gray.3" mb="xs">
                Themes:
              </Text>
              <Group gap="xs">
                {themes.map((theme: unknown, index: number) => (
                  <Badge key={index} size="sm" variant="light" color="orange">
                    {String(theme)}
                  </Badge>
                ))}
              </Group>
            </Box>
          )}
        </>
      )}
    </>
  );
}
