/**
 * SearchResultCard Component
 *
 * Displays a single manga search result card with cover image,
 * title, provider badge, and metadata.
 *
 * Extracted from: searchStep.tsx (renderStandardizedResults lines 1125-1189)
 */

import React from 'react';

import { Paper, Box, Text, Group, Badge, Loader } from '@mantine/core';

import type { ExtendedMangaSearchResult } from '@/types/search.types';

import { getProviderBadgeColor } from './helpers';
import { adaptToMangaSearchResult } from './result-adapter';

// ============================================================================
// Types
// ============================================================================

interface SearchResultCardProps {
  /** The search result to display */
  result: ExtendedMangaSearchResult;
  /** The selected provider for source fallback */
  selectedProvider: string;
  /** Whether this card is currently being selected */
  isSelecting: boolean;
  /** Callback when the card is clicked */
  onSelect: (result: ExtendedMangaSearchResult) => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

/** Extract genres from result with proper type checking */
function extractGenres(result: ExtendedMangaSearchResult): string[] {
  if (Array.isArray(result['genres'])) {
    return (result['genres'] as unknown[]).filter(
      (genre): genre is string => typeof genre === 'string' && genre.trim().length > 0
    );
  }
  if (result['metadata'] && typeof result['metadata'] === 'object') {
    const metadata = result['metadata'] as Record<string, unknown>;
    if (Array.isArray(metadata['genres'])) {
      return (metadata['genres'] as unknown[]).filter(
        (genre): genre is string => typeof genre === 'string' && genre.trim().length > 0
      );
    }
  }
  return [];
}

// ============================================================================
// Component
// ============================================================================

/** SearchResultCard displays a single manga search result */
export function SearchResultCard({
  result,
  selectedProvider,
  isSelecting,
  onSelect,
}: SearchResultCardProps): React.ReactElement {
  // Standardize the result format
  const resultSource = result['source'] ??
    ('provider' in result && typeof result.provider === 'string'
      ? result.provider
      : selectedProvider);
  const finalSource = resultSource.length > 0 ? resultSource : 'manual';
  const standardizedResult = adaptToMangaSearchResult(result, finalSource);

  // Extract data for display
  const genres = extractGenres(standardizedResult);
  const isNsfw: boolean = Boolean(
    standardizedResult['metadata'] &&
    typeof standardizedResult['metadata'] === 'object' &&
    'isNsfw' in standardizedResult['metadata'] &&
    standardizedResult['metadata'].isNsfw === true
  );
  const title = (standardizedResult['title'] as string | undefined) ?? 'Unknown Title';

  const cardStyle = {
    cursor: 'pointer',
    overflow: 'hidden',
    transition: 'transform 0.2s',
    height: '100%',
    display: 'flex',
    flexDirection: 'column' as const,
    position: 'relative' as const
  };

  const overlayStyle = {
    position: 'absolute' as const,
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10
  };

  const imgStyle = { height: '200px', width: '100%', objectFit: 'cover' as const };

  return (
    <Paper withBorder shadow="sm" radius="md" style={cardStyle} onClick={() => onSelect(standardizedResult)}>
      {isSelecting && (
        <div style={overlayStyle}>
          <Loader size="lg" color="white" />
        </div>
      )}

      <img
        src={standardizedResult.coverUrl ?? standardizedResult.cover ?? '/cover-not-found.jpg'}
        alt={title}
        style={imgStyle}
        onError={e => {
          const imgElement = e.currentTarget;
          if (imgElement.src !== '/cover-not-found.jpg') {
            imgElement.src = '/cover-not-found.jpg';
          }
        }}
      />

      <Box p="md" style={{ flexGrow: 1 }}>
        <Text fw="bold" lineClamp={2} mb="xs">{title}</Text>
        <Group>
          <Badge color={getProviderBadgeColor(standardizedResult['source'] ?? '')} variant="filled">
            {standardizedResult['source'] ?? 'Unknown'}
          </Badge>
          {isNsfw && <Badge color="red">NSFW</Badge>}
        </Group>
        {genres.length > 0 && (
          <Text size="sm" c="dimmed" mt="xs" lineClamp={1}>{genres.join(', ')}</Text>
        )}
      </Box>
    </Paper>
  );
}

export default SearchResultCard;
