/**
 * SearchStep Component - Step 0: Search and Select Sources
 */

import type { JSX } from 'react';
import { memo } from 'react';

import {
  Stack,
  Paper,
  Text,
  TextInput,
  Loader,
  ScrollArea,
  Badge,
  Group,
  Card,
  Image,
  Alert,
  Button
} from '@mantine/core';
import {
  IconSearch,
  IconAlertCircle,
  IconX,
  IconArrowRight,
  IconCheck
} from '@tabler/icons-react';

import { getProviderColor } from '../utils/provider-formatting';

import type { SearchResult } from '../types';

interface SearchStepProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  debouncedQuery: string;
  searchLoading: boolean;
  resultsByProvider: Record<string, SearchResult[]>;
  selectedSources: Record<string, SearchResult>;
  selectedSourcesCount: number;
  handleSelectResult: (result: SearchResult) => void;
  onNext: () => void;
  onClose: () => void;
}

export const SearchStep = memo<SearchStepProps>(function SearchStep({
  searchQuery,
  setSearchQuery,
  debouncedQuery,
  searchLoading,
  resultsByProvider,
  selectedSources,
  selectedSourcesCount,
  handleSelectResult,
  onNext,
  onClose
}: SearchStepProps): JSX.Element {
  return (
    <Stack gap="md">
      <Paper withBorder p="md" radius="md">
        <Stack gap="sm">
          <Text fw={500} size="sm">Search for Series Metadata</Text>
          <TextInput
            placeholder="Search by title..."
            leftSection={<IconSearch size={16} />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            rightSection={searchLoading ? <Loader size="xs" /> : null}
          />

          {/* Search Results by Provider */}
          {Object.keys(resultsByProvider).length > 0 && (
            <ScrollArea h={350}>
              <Stack gap="md">
                {Object.entries(resultsByProvider).map(([provider, results]) => (
                  <Stack key={provider} gap="xs">
                    <Group gap="xs">
                      <Badge variant="filled" color={getProviderColor(provider)}>
                        {provider.toUpperCase()}
                      </Badge>
                      <Text size="xs" c="dimmed">{results.length} results</Text>
                    </Group>
                    {results.slice(0, 5).map((result) => {
                      const providerKey = result.provider.toLowerCase();
                      const isSelected = selectedSources[providerKey]?.id === result.id;
                      return (
                        <Card
                          key={`${result.provider}-${result.id}`}
                          withBorder
                          p="xs"
                          radius="sm"
                          style={{
                            cursor: 'pointer',
                            borderColor: isSelected ? 'var(--mantine-color-blue-6)' : undefined,
                            backgroundColor: isSelected ? 'var(--mantine-color-blue-light)' : undefined
                          }}
                          onClick={() => handleSelectResult(result)}
                        >
                          <Group gap="sm" wrap="nowrap">
                            {result.coverImage && (
                              <Image src={result.coverImage} alt={result.title} w={40} h={60} radius="sm" fit="cover" />
                            )}
                            <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                              <Text size="sm" fw={500} truncate>{result.title}</Text>
                              <Group gap={4}>
                                {result.year && <Badge size="xs" variant="outline">{result.year}</Badge>}
                                {result.chapters && <Badge size="xs" variant="light">{result.chapters} ch</Badge>}
                                {result.volumes && <Badge size="xs" variant="light">{result.volumes} vol</Badge>}
                              </Group>
                            </Stack>
                            {isSelected && (
                              <IconCheck size={16} color="var(--mantine-color-blue-6)" />
                            )}
                          </Group>
                        </Card>
                      );
                    })}
                  </Stack>
                ))}
              </Stack>
            </ScrollArea>
          )}

          {debouncedQuery.length >= 3 && !searchLoading && Object.keys(resultsByProvider).length === 0 && (
            <Alert color="yellow" icon={<IconAlertCircle size={16} />}>
              No results found. Try a different search term.
            </Alert>
          )}
        </Stack>
      </Paper>

      {/* Step 0 Actions */}
      <Group justify="space-between">
        <Button variant="subtle" onClick={onClose} leftSection={<IconX size={16} />}>Cancel</Button>
        <Button rightSection={<IconArrowRight size={16} />} onClick={onNext} disabled={selectedSourcesCount === 0}>
          Next: Match Files ({selectedSourcesCount} source{selectedSourcesCount !== 1 ? 's' : ''})
        </Button>
      </Group>
    </Stack>
  );
});

SearchStep.displayName = 'SearchStep';
