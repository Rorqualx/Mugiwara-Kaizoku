/**
 * SearchResultsGrid component for displaying manga search results
 *
 * Displays search results in a responsive grid with:
 * - Manga cover images
 * - Title and status badges
 * - Description preview
 * - View chapters button
 */
import React from 'react';

import { Card, Group, Image, Box, Text, Badge, Button, SimpleGrid } from '@mantine/core';
import { IconBook2 } from '@tabler/icons-react';

import type { MangaResult } from './types';

export interface SearchResultsGridProps {
  /** Array of manga search results */
  searchResults: MangaResult[];
  /** Callback when view chapters is clicked */
  onViewChapters: (manga: MangaResult) => void;
  /** Currently selected manga */
  selectedManga: MangaResult | null;
  /** Whether chapters are loading */
  isLoadingChapters: boolean;
}

/**
 * SearchResultsGrid component
 * Renders a grid of manga search result cards
 */
export function SearchResultsGrid({
  searchResults,
  onViewChapters,
  selectedManga,
  isLoadingChapters
}: SearchResultsGridProps): React.ReactElement {
  return (
    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
      {searchResults.map((manga, index) => (
        <Card key={index} withBorder padding="md">
          <Group wrap="nowrap" mb="md">
            <Image
              src={manga.coverUrl ?? '/cover-not-found.jpg'}
              height={100}
              width={70}
              alt={manga.title}
              fallbackSrc="/cover-not-found.jpg"
            />

            <Box>
              <Text fw={500}>{manga.title}</Text>
              {manga.status && (
                <Badge size="sm" mt="xs">
                  {manga.status}
                </Badge>
              )}
            </Box>
          </Group>

          {manga.description && (
            <Text size="sm" lineClamp={2} mb="md">
              {manga.description}
            </Text>
          )}

          <Button
            variant="light"
            leftSection={<IconBook2 size={16} />}
            onClick={() => onViewChapters(manga)}
            fullWidth
            loading={isLoadingChapters && selectedManga?.title === manga.title}
          >
            View Chapters
          </Button>
        </Card>
      ))}
    </SimpleGrid>
  );
}
