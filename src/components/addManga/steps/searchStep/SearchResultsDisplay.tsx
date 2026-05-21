/**
 * SearchResultsDisplay Component
 *
 * Displays search results using the AsyncResult pattern.
 * Handles idle, loading, error, and success states.
 *
 * Extracted from: searchStep.tsx
 */

import React from 'react';

import { Alert, Box, Button, Flex, Loader, Stack, Text, Grid } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';

import type { ExtendedMangaSearchResult } from '@/types/search.types';
import { handleAsyncResult } from '@/utils/async-result';
import type { AsyncResult } from '@/utils/async-result';

import { safeString } from './helpers';
import { sortResultsByRelevance } from './search-hooks';
import { SearchResultCard } from './SearchResultCard';


interface SearchResultsDisplayProps {
  searchState: AsyncResult<ExtendedMangaSearchResult[], Error>;
  query: string;
  filteredResults: ExtendedMangaSearchResult[];
  selectedProvider: string;
  selectingMangaId: string | null;
  onSelect: (result: ExtendedMangaSearchResult) => void;
  onErrorClose: () => void;
  onRetry: () => void;
}

export function SearchResultsDisplay({
  searchState,
  query,
  filteredResults,
  selectedProvider,
  selectingMangaId,
  onSelect,
  onErrorClose,
  onRetry,
}: SearchResultsDisplayProps): React.ReactElement | null {
  const result = handleAsyncResult(searchState, {
    onIdle: () => {
      if (query.length < 3) {
        return (
          <Stack align="center" py="xl" gap="md">
            <Text c="dimmed" ta="center" size="lg" fs="italic">Enter a manga title to search</Text>
            <Text c="dimmed" size="sm" ta="center">Try searching for titles like &quot;One Piece&quot;, &quot;Naruto&quot;, or &quot;My Hero Academia&quot;</Text>
          </Stack>
        );
      } else if (filteredResults.length > 0) {
        return <></>;
      }
      return (
        <Box py="xl" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: '1rem' }}>
          <Text c="dimmed" fs="italic" size="lg">Ready to search...</Text>
        </Box>
      );
    },
    onLoading: () => (
      <Flex justify="center" align="center" my="xl">
        <Loader size="md" />
        <Text ml="xs">Searching...</Text>
      </Flex>
    ),
    onError: (error: Error) => (
      <Alert icon={<IconAlertCircle size="1rem" />} title="Search Error" color="red" variant="filled" mt="md" withCloseButton onClose={onErrorClose}>
        <Text fw={500} mb="xs">Failed to search:</Text>
        <Text size="sm">{error instanceof Error ? error.message : safeString(error)}</Text>
        <Button variant="white" color="red" size="xs" mt="xs" onClick={onRetry}>Retry</Button>
      </Alert>
    ),
    onSuccess: (results: ExtendedMangaSearchResult[]) => {
      if (results.length === 0) {
        if (filteredResults.length > 0) {
          return <></>;
        }
        return <Alert title="No Results" color="blue" mt="md">No manga found matching your query. Try a different search term or provider.</Alert>;
      }

      const sortedResults = sortResultsByRelevance(results, query);

      return (
        <Grid gutter="md" mt="md">
          {sortedResults.map((resultItem: ExtendedMangaSearchResult) => {
            const resultSource = (resultItem.source ?? ('provider' in resultItem && typeof resultItem.provider === 'string' ? resultItem.provider : selectedProvider)) || 'manual';
            const uniqueKey = `${resultSource}-${resultItem.sourceId ?? `id-${Math.random().toString(36).substring(2, 9)}`}`;
            return (
              <Grid.Col span={{ base: 12, sm: 6, md: 4, lg: 3 }} key={uniqueKey}>
                <SearchResultCard
                  result={resultItem}
                  selectedProvider={selectedProvider}
                  isSelecting={selectingMangaId === String(resultItem.id)}
                  onSelect={onSelect}
                />
              </Grid.Col>
            );
          })}
        </Grid>
      );
    }
  });
  return result ?? null;
}

export default SearchResultsDisplay;
