/**
 * AniList search results grid — extracted from `AddMangaModal` to keep that
 * file under the 500-line ESLint limit. Handles loading skeleton, populated
 * grid, empty state, error state, and pre-search hint.
 */
import React from 'react';

import { Badge, Group, Paper, SimpleGrid, Skeleton, Stack, Text } from '@mantine/core';

import { MangaCover } from '@/components/manga/MangaCover';

import type { AniListSearchResult } from './anilist-helpers';

interface AniListResultCardProps {
  result: AniListSearchResult;
  onSelect: (result: AniListSearchResult) => void;
}

function getDisplayTitle(result: AniListSearchResult): string {
  return result.title.english ?? result.title.romaji ?? result.title.native ?? 'Unknown';
}

function AniListResultCard({ result, onSelect }: AniListResultCardProps): React.ReactElement {
  const title = getDisplayTitle(result);
  const cover = result.coverImage.large ?? result.coverImage.medium;

  return (
    <Paper
      shadow="sm"
      radius="md"
      withBorder
      style={{ cursor: 'pointer', overflow: 'hidden', transition: 'transform 150ms ease, box-shadow 150ms ease' }}
      onMouseEnter={(e) => { Object.assign(e.currentTarget.style, { transform: 'translateY(-2px)', boxShadow: 'var(--mantine-shadow-md)' }); }}
      onMouseLeave={(e) => { Object.assign(e.currentTarget.style, { transform: '', boxShadow: '' }); }}
      onClick={() => onSelect(result)}
    >
      <MangaCover src={cover ?? ''} alt={title} h={200} seed={result.id} fallbackSrc="https://placehold.co/200x280?text=No+Cover" />
      <Stack gap={4} p="xs">
        <Text size="sm" fw={600} lineClamp={2} lh={1.3}>{title}</Text>
        {result.genres.length > 0 && (
          <Group gap={4} wrap="wrap">
            {result.genres.slice(0, 2).map((g) => (
              <Badge key={g} size="xs" variant="light">{g}</Badge>
            ))}
          </Group>
        )}
        <Group gap="xs">
          {result.averageScore !== null && (
            <Text size="xs" c="dimmed">{result.averageScore}%</Text>
          )}
          {result.status && (
            <Badge size="xs" variant="outline" color={result.status === 'RELEASING' ? 'green' : 'gray'}>
              {result.status}
            </Badge>
          )}
        </Group>
      </Stack>
    </Paper>
  );
}

export interface AniListResultsGridProps {
  isSearching: boolean;
  results: AniListSearchResult[];
  hasSearched: boolean;
  debouncedQuery: string;
  isError: boolean;
  onSelect: (result: AniListSearchResult) => void;
}

export function AniListResultsGrid({
  isSearching,
  results,
  hasSearched,
  debouncedQuery,
  isError,
  onSelect,
}: AniListResultsGridProps): React.ReactElement {
  if (isSearching) {
    return (
      <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <Paper key={i} shadow="sm" radius="md" withBorder style={{ overflow: 'hidden' }}>
            <Skeleton h={200} radius={0} />
            <Stack gap={4} p="xs">
              <Skeleton h={14} w="80%" />
              <Skeleton h={10} w="50%" />
            </Stack>
          </Paper>
        ))}
      </SimpleGrid>
    );
  }
  if (results.length > 0) {
    return (
      <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }}>
        {results.map((result) => (
          <AniListResultCard key={result.id} result={result} onSelect={onSelect} />
        ))}
      </SimpleGrid>
    );
  }
  if (hasSearched && debouncedQuery.length >= 2) {
    return <Stack align="center" py="xl"><Text c="dimmed">No results found for &ldquo;{debouncedQuery}&rdquo;</Text></Stack>;
  }
  if (isError) {
    return <Stack align="center" py="xl"><Text c="red" size="sm">Search failed. Please try again.</Text></Stack>;
  }
  return <Stack align="center" py="xl"><Text c="dimmed" size="sm">Type at least 2 characters to search</Text></Stack>;
}
