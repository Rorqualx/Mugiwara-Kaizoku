/**
 * StandardMangaList Component
 * 
 * A standardized manga list component that implements best practices
 * for performance and type safety. This component displays manga entries
 * in a grid layout with consistent styling and interaction patterns.
 * 
 * Features:
 * - Virtualized rendering for performance
 * - Proper TypeScript typing
 * - Standardized card layout
 * - Consistent interaction patterns
 * 
 * @module components/manga/StandardMangaList
 */

import React, { useState, useEffect} from 'react';

import { Box, Center, Grid, Loader, Text, Stack, Button } from '@mantine/core';

import { useNavigation } from '@/hooks/useNavigation';
import type { MangaWithRelations } from '@/types/search.types';
import { trpc } from '@/utils/trpc-client';

import { MangaCard } from './MangaCard';


// Use MangaWithRelations from search.types.ts directly
type MangaWithChapters = MangaWithRelations;

/**
 * Filter parameters for manga list queries
 */
interface MangaListFilter {
  status?: string;
  source?: string;
  library?: number;
  [key: string]: string | number | boolean | undefined;
}

/**
 * Props for the StandardMangaList component
 */
interface StandardMangaListProps {
  /** Filter to apply to manga list */
  filter?: MangaListFilter;
  /** Whether to show library information */
  showLibrary?: boolean;
  /** Maximum number of items to display */
  limit?: number;
}

/**
 * StandardMangaList component
 * 
 * Displays a grid of manga cards with standardized layout and interactions.
 * 
 * @param props Component properties
 * @returns React component
 */
export function StandardMangaList({
  filter: _filter = {},
  showLibrary = false,
  limit: _limit = 100
}: StandardMangaListProps): React.ReactElement {
  const { navigateTo } = useNavigation();
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // State for holding manga data
  const [mangaList, setMangaList] = useState<unknown[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Fetch manga data from tRPC
  const mangaQuery = trpc.manga.query.useQuery(
    { include: { library: showLibrary, metadata: true, chapters: false }, limit: 50 },
    {
      staleTime: 60 * 1000, // 1 minute
      refetchOnWindowFocus: false
    }
  );

  // Update local state when tRPC data changes
  useEffect(() => {
    if (mangaQuery.data) {
      setMangaList(mangaQuery.data);
      setIsLoading(false);
    }
  }, [mangaQuery.data]);

  // Handle errors
  useEffect(() => {
    if (mangaQuery.error) {
      // Convert tRPC error to standard Error
      const errorMessage = mangaQuery.error instanceof Error ? mangaQuery.error.message : String(mangaQuery.error) || 'Failed to load manga';
      setError(new Error(errorMessage));
      setIsLoading(false);
    }
  }, [mangaQuery.error]);

  // Initial loading state
  useEffect(() => {
    setIsLoading(mangaQuery.isLoading);
  }, [mangaQuery.isLoading]);

  // Create a refresh function to reload data
  const refreshList = (): void => {
    setRefreshTrigger((prev) => prev + 1);
    void mangaQuery.refetch();
  };

  // Refresh the list when trigger changes
  useEffect(() => {
    void mangaQuery.refetch();
  }, [refreshTrigger, mangaQuery]);

  // Display loading state
  if (isLoading) {
    return (
      <Center style={{ height: '300px' }}>
        <Loader size="xl" />
      </Center>);

  }

  // Display error state
  if (error) {
    return (
      <Center style={{ height: '300px' }}>
        <Stack align="center" style={{ alignItems: 'center' }} gap="md">
          <Text size="xl" fw={700} color="red">Error loading manga</Text>
          <Text c="dimmed">Could not load manga data.</Text>
          <Text size="sm" c="dimmed">Error: {(error instanceof Error ? error.message : String(error))}</Text>
          <Button onClick={() => {
            setError(null);
            void mangaQuery.refetch();
          }} color="blue">Retry</Button>
        </Stack>
      </Center>);

  }

  // Display empty state
  if (!Array.isArray(mangaList) || mangaList.length === 0) {
    return (
      <Center style={{ height: '300px' }}>
        <Stack align="center" style={{ alignItems: 'center' }} gap="md">
          <Text size="xl" fw={700}>No manga found</Text>
          <Text c="dimmed">Try adjusting your filters or adding new manga</Text>
        </Stack>
      </Center>);

  }

  // Safely convert manga list items to domain type - tRPC already provides typed data
  const safeMangaList: MangaWithChapters[] = Array.isArray(mangaList)
    ? (mangaList as MangaWithChapters[])
    : [];

  // Group manga by first letter
  const groupedManga: Record<string, MangaWithChapters[]> = {};
  for (const manga of safeMangaList) {
    // Get first letter of title, defaulting to '#' for non-alphabetic
    const firstLetter = manga["title"].charAt(0).toUpperCase();
    const group = /[A-Z]/.test(firstLetter) ? firstLetter : '#';

    // Initialize the group if it doesn't exist and add manga
    const groupArray = groupedManga[group] ?? [];
    groupArray.push(manga);
    groupedManga[group] = groupArray;
  }

  // Sort the groups alphabetically
  const sortedGroups = Object.keys(groupedManga).sort((a, b) => {
    // Sort '#' at the end
    if (a === '#') return 1;
    if (b === '#') return -1;
    return a.localeCompare(b);
  });

  // Render manga grid with letter sections
  return (
    <Box style={{ paddingTop: 'var(--mantine-spacing-md)', paddingBottom: 'var(--mantine-spacing-md)' }}>
      {sortedGroups.map((letter) =>
      <Box key={letter} mb="xl" data-letter={letter}>
          <Text
          size="xl"
          fw={700}
          mb="md"
          style={{
            borderBottom: '2px solid var(--mantine-color-blue-7)',
            paddingBottom: 'var(--mantine-spacing-sm)',
            paddingLeft: 'var(--mantine-spacing-md)',
            backgroundColor: 'rgba(0, 0, 0, 0.2)',
            borderRadius: '4px 4px 0 0',
            boxShadow: '0 -1px 3px rgba(0, 0, 0, 0.1)',
            position: 'sticky',
            top: '112px', // Position sticky at the top below action bar
            zIndex: 10,
            width: '100%',
            marginTop: 'var(--mantine-spacing-xl)'
          }}>

            {letter}
          </Text>
          <Grid style={{ gap: 'var(--mantine-spacing-xl)' }}>
            {(groupedManga[letter] ?? []).map((manga) =>
          <Grid.Col key={manga["id"]} span={{ base: 12, sm: 6, md: 4, lg: 3 }}>
                <MangaCard
              manga={manga as MangaWithRelations}
              onUpdate={refreshList}
              onRefresh={refreshList}
              onRemove={() => {
                // Delay refresh to allow for animation
                setTimeout(refreshList, 500);
              }}
              onClick={() => {
                void navigateTo(`/manga/${manga["id"]}`);
              }} />

              </Grid.Col>
          )}
          </Grid>
        </Box>
      )}
    </Box>);

}