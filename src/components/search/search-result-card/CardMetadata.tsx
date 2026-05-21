/**
 * Card Metadata Component
 *
 * Displays metadata like author, volumes, chapters, score, and popularity.
 */

'use client';

import * as React from 'react';

import { Text, Group, Badge } from '@mantine/core';

import type { SearchResult, AniListSearchResult } from '@/types/search.types';

/**
 * Type guard for AniList search results
 *
 * @param result - The search result to check
 * @returns True if result is an AniList result
 */
function isAniListResult(result: SearchResult): result is AniListSearchResult {
  return 'anilistId' in result && typeof result.anilistId === 'number';
}

export interface CardMetadataProps {
  /** The search result to display metadata for */
  result: SearchResult;
}

/**
 * Renders author information if available
 *
 * @param props - Component props
 * @returns React element or null
 */
function AuthorInfo({ result }: CardMetadataProps): React.ReactNode {
  if (!result.author) {
    return null;
  }

  return (
    <Text size="sm" c="dimmed">
      By {result.author}
    </Text>
  );
}

/**
 * Renders volume and chapter count badges
 *
 * @param props - Component props
 * @returns React element or null
 */
function VolumeChapterInfo({ result }: CardMetadataProps): React.ReactNode {
  const hasVolumeInfo = result.volumes !== undefined;
  const hasChapterInfo = result.chapters !== undefined || result.totalChapters !== undefined;

  if (!hasVolumeInfo && !hasChapterInfo) {
    return null;
  }

  return (
    <Group gap="xs">
      {hasVolumeInfo && (
        <Badge color="teal" variant="light" size="sm">
          {result.volumes} Volumes
        </Badge>
      )}
      {hasChapterInfo && (
        <Badge color="cyan" variant="light" size="sm">
          {result.chapters ?? result.totalChapters} Chapters
        </Badge>
      )}
    </Group>
  );
}

/**
 * Renders score and popularity for AniList results
 *
 * @param props - Component props
 * @returns React element or null
 */
function AniListScoreInfo({ result }: CardMetadataProps): React.ReactNode {
  const isAniList = result.provider.toLowerCase().includes('anilist') && isAniListResult(result);

  if (!isAniList || (!result.score && !result.popularity)) {
    return null;
  }

  return (
    <Group gap="xs">
      {result.score && (
        <Badge color="yellow" variant="light" size="sm" leftSection="⭐">
          {(result.score / 10).toFixed(1)}/10
        </Badge>
      )}
      {result.popularity && (
        <Badge color="pink" variant="light" size="sm" leftSection="🔥">
          {result.popularity.toLocaleString()} users
        </Badge>
      )}
    </Group>
  );
}

/**
 * Card metadata component displaying all metadata sections
 *
 * @param props - Component props
 * @returns React element
 */
export function CardMetadata({ result }: CardMetadataProps): React.ReactNode {
  return (
    <>
      <AuthorInfo result={result} />
      <VolumeChapterInfo result={result} />
      <AniListScoreInfo result={result} />
    </>
  );
}
