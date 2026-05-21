import React from 'react';

import { Alert, Box, Loader, Paper, Group, Text, Stack } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';

import { SearchResults } from '@/components/search/SearchResults';
import type { ExtendedMangaSearchResult, SearchResult } from '@/types/search.types';
import { isSuccess } from '@/utils/async-result';

import { checkIsLoading, detectProviderUrl, safeString } from './searchStep/helpers';
import { sortResultsByRelevance } from './searchStep/search-hooks';
import { SearchInput } from './searchStep/SearchInput';
import { SearchResultsDisplay } from './searchStep/SearchResultsDisplay';
import { useSearchStepState } from './searchStep/useSearchStepState';

import type { SearchStepProps } from './searchStep/types';

/**
 * SearchStep component for searching and selecting manga
 *
 * This component provides a search interface for finding manga across multiple providers.
 * It handles the search process, displays results, and allows selection of a manga
 * to proceed to the next step in the workflow.
 */
export function SearchStep({ form, onSelect, onQuickAdd, selectedLibraryId: _selectedLibraryId, onUrlDetected }: SearchStepProps): React.ReactNode {
  const {
    query,
    errors,
    searchState,
    selectedProvider,
    showSearchHelp,
    parsedQuery,
    selectingMangaId,
    enabledSources,
    filteredResults,
    hookIsLoading,
    lastSearchedQuery,
    handleQueryChange,
    handleProviderChange,
    handleSearchClick,
    handleForceRefresh,
    handleErrorClose,
    handleMangaSelect,
    handleQuickAdd,
    setShowSearchHelp,
    setFormQuery
  } = useSearchStepState({ form, onSelect, onQuickAdd });

  return (
    <Box display="flex" style={{ flexDirection: 'column', gap: 'var(--mantine-spacing-md)' }}>
      <Text size="sm" fw={500} c="#dddddd">Search for a manga</Text>

      <SearchInput
        query={query}
        parsedQuery={parsedQuery}
        selectedProvider={selectedProvider}
        enabledSources={enabledSources}
        searchState={searchState}
        showSearchHelp={showSearchHelp}
        lastSearchedQuery={lastSearchedQuery}
        onQueryChange={handleQueryChange}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && query && query.length >= 3 && !checkIsLoading(searchState)) {
            // Check if query is a URL from a supported provider
            const detectedProvider = detectProviderUrl(query);
            if (detectedProvider && onUrlDetected) {
              // URL detected - trigger URL parsing instead of search
              void onUrlDetected(query, detectedProvider);
            } else {
              // Regular text search
              handleForceRefresh();
            }
          }
        }}
        onProviderChange={handleProviderChange}
        onSearchClick={handleSearchClick}
        onToggleSearchHelp={setShowSearchHelp}
        setFormQuery={setFormQuery}
      />

      <input type="hidden" {...form.getInputProps("mangaTitle")} />
      <input type="hidden" {...form.getInputProps("mangaId")} />

      {Object.keys(errors).length > 0 && (
        <Alert color="red" mt="md" withCloseButton radius="md" icon={<IconAlertCircle size={16} />} title="Search Errors" onClose={() => { void handleErrorClose(); }}>
          <Stack gap="xs">
            {Object.entries(errors).map(([provider, error]) => (
              <Group key={provider} gap="xs" align="flex-start">
                <Text size="sm" fw={500} c="red">{provider}</Text>
                <Text size="sm" style={{ flex: 1 }}>{safeString(error)}</Text>
              </Group>
            ))}
            <Text size="sm" fs="italic" mt="xs">Try again with a different search term or try another provider.</Text>
          </Stack>
        </Alert>
      )}

      <Paper p="md" withBorder style={{ borderColor: '#444444', backgroundColor: '#333333' }} radius="md">
        {query ? (
          hookIsLoading ? (
            <Box py="xl" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', gap: '1rem' }}>
              <Loader size="lg" color="blue" />
              <Text c="dimmed" fs="italic" size="lg">Searching across providers...</Text>
            </Box>
          ) : (
            <>
              <SearchResultsDisplay
                searchState={searchState}
                query={query}
                filteredResults={filteredResults as ExtendedMangaSearchResult[]}
                selectedProvider={selectedProvider}
                selectingMangaId={selectingMangaId}
                onSelect={(r) => { void handleMangaSelect(r); }}
                onErrorClose={handleErrorClose}
                onRetry={handleForceRefresh}
              />
              {(!isSuccess(searchState) || searchState.data.length === 0) && selectedProvider !== 'anilist' && selectedProvider !== '' && (
                <SearchResults
                  results={sortResultsByRelevance(
                    filteredResults.map(r => {
                      let publisherValue: string | undefined;
                      if (typeof r.publisher === 'object') {
                        const pub = r.publisher as Record<string, unknown>;
                        publisherValue = typeof pub['name'] === 'string' ? pub['name'] : undefined;
                      } else if (typeof r.publisher === 'string') {
                        publisherValue = r.publisher;
                      }
                      return { ...r, publisher: publisherValue } as ExtendedMangaSearchResult;
                    }),
                    query
                  ).map(r => {
                    const converted: SearchResult = {
                      ...r,
                      id: String(r.id),
                      type: 'manga',
                      startDate: typeof r.startDate === 'string' || r.startDate === null ? r.startDate : undefined,
                      endDate: typeof r.endDate === 'string' || r.endDate === null ? r.endDate : undefined
                    };
                    return converted;
                  })}
                  onSelect={manga => { void handleMangaSelect(manga as unknown as ExtendedMangaSearchResult); }}
                  isLoading={hookIsLoading}
                  error={Object.keys(errors).length > 0 ? "Some providers returned errors" : null}
                  enrichingId={null}
                  showProvider={true}
                  {...(onQuickAdd && { onQuickAdd: (manga) => { void handleQuickAdd(manga as unknown as ExtendedMangaSearchResult); } })}
                  isQuickAddEnabled={Boolean(onQuickAdd)}
                />
              )}
            </>
          )
        ) : (
          <Stack align="center" py="xl" gap="md">
            <Text c="dimmed" ta="center" size="lg" fs="italic">Enter a manga title to search</Text>
            <Text c="dimmed" size="sm" ta="center">Try searching for titles like &quot;One Piece&quot;, &quot;Naruto&quot;, or &quot;My Hero Academia&quot;</Text>
          </Stack>
        )}
      </Paper>
    </Box>
  );
}

export const SearchStepStandardized = SearchStep;
export default SearchStep;
