/**
 * Quick Add Search Modal Component
 *
 * Multi-provider search modal for quickly adding annotation pages.
 */

import React, { useState, useCallback } from 'react';

import {
  Text,
  TextInput,
  Button,
  Group,
  Stack,
  Alert,
  Badge,
  Paper,
  Modal,
  ScrollArea,
  Checkbox,
  Image,
  Box,
  Loader,
} from '@mantine/core';
import {
  IconPlus,
  IconAlertCircle,
  IconCheck,
  IconSearch,
} from '@tabler/icons-react';

import type { SearchResult } from '@/types/search.types';
import { api } from '@/utils/api';

// ============================================================================
// Helper Functions
// ============================================================================

function getProviderColor(provider: string): string {
  const colors: Record<string, string> = {
    comicvine: 'red',
    fandom: 'orange',
    wikipedia: 'blue',
  };
  return colors[provider.toLowerCase()] ?? 'gray';
}

function getProviderUrl(result: SearchResult): string | null {
  // First check if result has url property directly
  if (result.url && typeof result.url === 'string') {
    return result.url;
  }
  // Construct URLs based on provider
  // FlareSolverr is used for JS-heavy pages (Fandom, ComicVine)
  const provider = result.provider.toLowerCase();
  switch (provider) {
    case 'wikipedia':
      return `https://en.wikipedia.org/wiki/${encodeURIComponent(result.title.replace(/ /g, '_'))}`;
    case 'fandom':
      // Fandom URLs should come from search result metadata
      // If not available, we can't construct them (need wiki subdomain)
      return null;
    case 'comicvine':
      // ComicVine volume URLs
      return `https://comicvine.gamespot.com/c/4050-${result.id}/`;
    default:
      return null;
  }
}

// ============================================================================
// SearchResultCard Component
// ============================================================================

interface SearchResultCardProps {
  result: SearchResult;
  isSelected: boolean;
  onToggle: () => void;
}

function SearchResultCard({ result, isSelected, onToggle }: SearchResultCardProps): React.ReactElement {
  const coverImage = result.coverImage;
  const year = result.year;
  const hasUrl = getProviderUrl(result) !== null;

  return (
    <Paper
      p="xs"
      withBorder
      style={{
        cursor: hasUrl ? 'pointer' : 'not-allowed',
        borderColor: isSelected ? 'var(--mantine-color-blue-6)' : undefined,
        backgroundColor: isSelected ? 'var(--mantine-color-blue-light)' : undefined,
        opacity: hasUrl ? 1 : 0.5,
      }}
      onClick={hasUrl ? onToggle : undefined}
    >
      <Group gap="sm" wrap="nowrap">
        <Checkbox checked={isSelected} onChange={onToggle} onClick={(e) => e.stopPropagation()} disabled={!hasUrl} />
        {coverImage && (
          <Image src={coverImage} alt={result.title} w={40} h={56} fit="cover" radius="sm" />
        )}
        <Box style={{ flex: 1, minWidth: 0 }}>
          <Text size="sm" fw={500} lineClamp={1}>{result.title}</Text>
          <Group gap="xs" mt={2}>
            <Badge size="xs" color={getProviderColor(result.provider)}>{result.provider}</Badge>
            {year !== undefined && <Text size="xs" c="dimmed">{year}</Text>}
            {!hasUrl && <Text size="xs" c="red">Not supported</Text>}
          </Group>
        </Box>
        {isSelected && <IconCheck size={16} color="var(--mantine-color-blue-6)" />}
      </Group>
    </Paper>
  );
}

// ============================================================================
// QuickAddSearchModal Component
// ============================================================================

export interface QuickAddSearchModalProps {
  opened: boolean;
  onClose: () => void;
  onPageAdded?: (() => void) | undefined;
  initialQuery?: string;
}

export function QuickAddSearchModal({ opened, onClose, onPageAdded, initialQuery = '' }: QuickAddSearchModalProps): React.ReactElement {
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [selectedResults, setSelectedResults] = useState<Map<string, SearchResult>>(new Map());
  const [addStatus, setAddStatus] = useState<{ adding: boolean; error?: string; success?: boolean }>({
    adding: false,
  });

  // Reset state when modal opens
  React.useEffect(() => {
    if (opened) {
      setSearchQuery(initialQuery);
      setSelectedResults(new Map());
      setAddStatus({ adding: false });
    }
  }, [opened, initialQuery]);

  // Multi-provider search
  const searchQuery$ = api.search.all.useQuery(
    { query: searchQuery, limit: 10 },
    { enabled: searchQuery.length >= 3 }
  );

  const addBulkMutation = api.annotation.addBulkFromDiscovery.useMutation({
    onSuccess: () => {
      setAddStatus({ adding: false, success: true });
      setSelectedResults(new Map());
      onPageAdded?.();
      setTimeout(() => {
        setAddStatus({ adding: false });
        onClose();
      }, 1500);
    },
    onError: (error) => {
      setAddStatus({ adding: false, error: error.message });
    },
  });

  const handleSearch = useCallback((): void => {
    // Query is controlled by the input, useQuery handles the search
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  }, [handleSearch]);

  const handleToggleResult = useCallback((result: SearchResult): void => {
    setSelectedResults((prev) => {
      const key = `${result.provider}-${result.id}`;
      const updated = new Map(prev);
      if (updated.has(key)) {
        updated.delete(key);
      } else {
        updated.set(key, result);
      }
      return updated;
    });
  }, []);

  const handleSelectAll = useCallback((): void => {
    const results = searchQuery$.data ?? [];
    const newSelected = new Map<string, SearchResult>();
    results.forEach((result: SearchResult) => {
      const url = getProviderUrl(result);
      if (url) {
        newSelected.set(`${result.provider}-${result.id}`, result);
      }
    });
    setSelectedResults(newSelected);
  }, [searchQuery$.data]);

  const handleClearAll = useCallback((): void => {
    setSelectedResults(new Map());
  }, []);

  const handleAddPages = useCallback((): void => {
    const urls = Array.from(selectedResults.values())
      .map((result) => {
        const url = getProviderUrl(result);
        return url ? { url, mangaTitle: result.title } : null;
      })
      .filter((item): item is { url: string; mangaTitle: string } => item !== null);

    if (urls.length === 0) return;

    setAddStatus({ adding: true });
    addBulkMutation.mutate({ urls });
  }, [selectedResults, addBulkMutation]);

  const results = React.useMemo(() => searchQuery$.data ?? [], [searchQuery$.data]);
  const isSearching = searchQuery$.isFetching;

  // Group results by provider
  const groupedResults = React.useMemo(() => {
    const groups = new Map<string, SearchResult[]>();
    results.forEach((result: SearchResult) => {
      const provider = result.provider.toUpperCase();
      const existing = groups.get(provider) ?? [];
      existing.push(result);
      groups.set(provider, existing);
    });
    return groups;
  }, [results]);

  const providerOrder = ['WIKIPEDIA', 'FANDOM', 'COMICVINE'];
  const sortedProviders = Array.from(groupedResults.keys()).sort((a, b) => {
    const aIdx = providerOrder.indexOf(a);
    const bIdx = providerOrder.indexOf(b);
    return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx);
  });

  return (
    <Modal opened={opened} onClose={onClose} title="Search & Add Pages" size="lg">
      <Stack gap="md">
        <Group gap="xs">
          <TextInput
            placeholder="Search manga across all providers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.currentTarget.value)}
            onKeyDown={handleKeyDown}
            leftSection={<IconSearch size={14} />}
            style={{ flex: 1 }}
          />
          {isSearching && <Loader size="sm" />}
        </Group>

        <Group gap="xs">
          <Badge color="red" size="sm" variant="filled">ComicVine</Badge>
          <Badge color="orange" size="sm" variant="outline">Fandom</Badge>
          <Badge color="blue" size="sm" variant="filled">Wikipedia</Badge>
          <Text size="xs" c="dimmed">(Fandom needs URL from search)</Text>
        </Group>

        <ScrollArea h={350}>
          <Stack gap="md">
            {sortedProviders.map((provider) => (
              <Box key={provider}>
                <Group gap="xs" mb="xs">
                  <Badge size="sm" color={getProviderColor(provider)}>{provider}</Badge>
                  <Text size="xs" c="dimmed">{groupedResults.get(provider)?.length ?? 0} results</Text>
                </Group>
                <Stack gap="xs">
                  {(groupedResults.get(provider) ?? []).map((result) => {
                    const key = `${result.provider}-${result.id}`;
                    const url = getProviderUrl(result);
                    return (
                      <SearchResultCard
                        key={key}
                        result={result}
                        isSelected={selectedResults.has(key) && url !== null}
                        onToggle={() => url && handleToggleResult(result)}
                      />
                    );
                  })}
                </Stack>
              </Box>
            ))}
            {results.length === 0 && !isSearching && searchQuery.length >= 3 && (
              <Text size="sm" c="dimmed" ta="center" py="xl">
                No results found. Try a different search term.
              </Text>
            )}
            {searchQuery.length < 3 && (
              <Text size="sm" c="dimmed" ta="center" py="xl">
                Enter at least 3 characters to search.
              </Text>
            )}
          </Stack>
        </ScrollArea>

        {addStatus.error && (
          <Alert color="red" icon={<IconAlertCircle size={14} />}>
            {addStatus.error}
          </Alert>
        )}

        {addStatus.success && (
          <Alert color="green" icon={<IconCheck size={14} />}>
            Pages added successfully!
          </Alert>
        )}

        <Group justify="space-between">
          <Group gap="xs">
            <Button size="xs" variant="light" onClick={handleSelectAll} disabled={results.length === 0}>
              Select All
            </Button>
            <Button size="xs" variant="light" color="gray" onClick={handleClearAll} disabled={selectedResults.size === 0}>
              Clear
            </Button>
          </Group>
          <Group gap="xs">
            <Button variant="subtle" onClick={onClose}>Cancel</Button>
            <Button
              leftSection={<IconPlus size={14} />}
              onClick={handleAddPages}
              disabled={selectedResults.size === 0 || addStatus.adding}
              loading={addStatus.adding}
            >
              Add {selectedResults.size} Page{selectedResults.size !== 1 ? 's' : ''}
            </Button>
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
}
