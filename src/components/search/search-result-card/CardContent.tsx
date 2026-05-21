/**
 * Card Content Component
 *
 * Displays alternative titles, description, genres, and status.
 */

'use client';

import * as React from 'react';

import { Text, Group, Badge } from '@mantine/core';

import type { SearchResult } from '@/types/search.types';

export interface CardContentProps {
  /** The search result to display content for */
  result: SearchResult;
}

/**
 * Renders alternative titles if available
 *
 * @param props - Component props
 * @returns React element or null
 */
function AlternativeTitles({ result }: CardContentProps): React.ReactNode {
  if (!result.alternativeTitles || result.alternativeTitles.length === 0) {
    return null;
  }

  const displayTitles = result.alternativeTitles.slice(0, 2).join(', ');
  const additionalCount = result.alternativeTitles.length > 2
    ? ` +${result.alternativeTitles.length - 2} more`
    : '';

  return (
    <Text size="xs" c="dimmed" lineClamp={1}>
      Also known as: {displayTitles}{additionalCount}
    </Text>
  );
}

/**
 * Renders description with fallback
 *
 * @param props - Component props
 * @returns React element
 */
function Description({ result }: CardContentProps): React.ReactNode {
  return (
    <Text size="sm" color="dimmed" lineClamp={3} mb="auto">
      {result.description ?? 'No description available'}
    </Text>
  );
}

/**
 * Formats genres array for display
 *
 * @param result - The search result
 * @returns Array of up to 3 genres
 */
function getDisplayGenres(result: SearchResult): string[] {
  return Array.isArray(result.genres) ? result.genres.slice(0, 3) : [];
}

/**
 * Renders genres and status badges
 *
 * @param props - Component props
 * @returns React element
 */
function GenresAndStatus({ result }: CardContentProps): React.ReactNode {
  const genres = getDisplayGenres(result);

  return (
    <Group justify="space-between" mt="md">
      <Group gap={5}>
        {genres.map((genre) => (
          <Badge key={genre} color="gray" variant="outline" size="xs">
            {genre}
          </Badge>
        ))}
        {result.status && (
          <Badge color="blue" variant="filled" size="xs">
            {result.status}
          </Badge>
        )}
      </Group>
    </Group>
  );
}

/**
 * Card content component displaying all content sections
 *
 * @param props - Component props
 * @returns React element
 */
export function CardContent({ result }: CardContentProps): React.ReactNode {
  return (
    <>
      <AlternativeTitles result={result} />
      <Description result={result} />
      <GenresAndStatus result={result} />
    </>
  );
}
