// Custom Website Sources manga search component
// Following Mugiwara-Kaizoku patterns

// Temporarily comment out missing type import
// import type { ExtendedMangaSearchResult } from '../types/search.types';
import React, { useState } from 'react';

import {
  TextInput,
  Button,
  Grid,
  Card,
  Image,
  Text,
  Badge,
  Group,
  Stack,
  LoadingOverlay,
  Alert,
  Paper } from
'@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import { useRouter } from 'next/router';

// Temporarily comment out missing type import
// import type { MangaSearchResult } from '@/types/search.types';

// Note: tRPC procedures will be implemented in Phase 3
// For now, using placeholder queries that will be replaced

interface PlaceholderSearchResult {
  source: string;
  sourceId: string;
  title: string;
  coverUrl?: string;
  metadata?: {
    chapters?: number;
  };
}

export function NativeDownloadSearch(): React.ReactElement {
  const [query, setQuery] = useState('');
  const router = useRouter();

  // TODO: Replace with actual tRPC query in Phase 3
  // const searchQuery = trpc.nativeDownload.searchManga.useQuery(
  const searchQuery = {
    data: [] as PlaceholderSearchResult[],
    isError: false,
    error: null as Error | null,
    isFetching: false,
    refetch: () => Promise.resolve({ data: [] })
  };

  const handleSelectManga = (result: PlaceholderSearchResult): void => {
    if (result.sourceId) {
 void router.push(`/native-download/${result["source"]}/${result.sourceId}`);
    }
  };

  const handleSearch = (e: React.FormEvent): void => {
    e.preventDefault();
    if (query.length > 2) {
      void searchQuery.refetch();
    }
  };

  return (
    <Stack gap="md">
      <form onSubmit={handleSearch}>
        <Group>
          <TextInput
            placeholder="Search for manga..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            leftSection={<IconSearch size={16} />}
            style={{ flex: 1 }} />

          <Button
            type="submit"
            loading={searchQuery.isFetching}
            disabled={query.length <= 2}>

            Search
          </Button>
        </Group>
      </form>
      
      {searchQuery.isError &&
      <Alert color="red" title="Search failed">
          {searchQuery.error instanceof Error ? searchQuery.error.message : 'Unknown error'}
        </Alert>
      }
      
      {searchQuery.data.length === 0 &&
      <Alert color="blue">
          No results found for "{query}". Try a different search term.
        </Alert>
      }
      
      <Grid>
        {searchQuery.data.map((result) =>
        <Grid.Col key={`${result["source"]}-${result.sourceId}`} span={{ base: 12, sm: 6, md: 4, lg: 3 }}>
            <Card
            shadow="sm"
            padding="md"
            radius="md"
            withBorder
            style={{ cursor: 'pointer', height: '100%' }}
            onClick={() => handleSelectManga(result)}>

              <Card.Section pos="relative">
                {result.coverUrl ?
              <Image
                src={result.coverUrl}
                height={200}
                alt={result["title"]}
                fit="cover"
                fallbackSrc="/images/no-cover.png" /> :

              <Paper h={200} bg="gray.1" />
              }
                <LoadingOverlay visible={false} />
              </Card.Section>
              
              <Stack gap="xs" mt="md">
                <Text fw={500} lineClamp={2}>
                  {result["title"]}
                </Text>
                
                <Group justify="space-between" mt="auto">
                  <Badge color="blue" variant="light" size="sm">
                    {result["source"]}
                  </Badge>
                  {result["metadata"]?.chapters &&
                <Text size="xs" c="dimmed">
                      {result["metadata"]["chapters"]} chapters
                    </Text>
                }
                </Group>
              </Stack>
            </Card>
          </Grid.Col>
        )}
      </Grid>
    </Stack>);

}