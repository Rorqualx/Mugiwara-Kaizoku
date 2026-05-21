/**
 * Hook for managing search state and debouncing
 */

import { useMemo, useState } from 'react';

import { useDebouncedValue } from '@mantine/hooks';

import { trpc } from '@/utils/trpc-client';

import type { SearchResult } from '../types';

export function useSearchResults(opened: boolean): {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  debouncedQuery: string;
  searchResults: SearchResult[];
  searchLoading: boolean;
  resultsByProvider: Record<string, SearchResult[]>;
} {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery] = useDebouncedValue(searchQuery, 500);

  // Multi-provider search
  const { data: searchResults, isLoading: searchLoading } = trpc.search.all.useQuery(
    { query: debouncedQuery, limit: 30 },
    { enabled: debouncedQuery.length >= 3 && opened, refetchOnWindowFocus: false }
  );

  // Transform search results
  const formattedResults: SearchResult[] = useMemo(() => {
    if (!searchResults || !Array.isArray(searchResults)) return [];
    return searchResults.map((r: unknown) => {
      const result = r as {
        id: string | number;
        title: string;
        coverImage?: string;
        cover?: string;
        year?: number;
        chapters?: number;
        volumes?: number;
        status?: string;
        provider?: string;
        source?: string;
        alternativeTitles?: string[];
        description?: string;
        anilistId?: number;
      };
      return {
        id: result.anilistId ?? result.id,
        title: result.title,
        coverImage: result.coverImage ?? result.cover,
        year: result.year,
        chapters: result.chapters,
        volumes: result.volumes,
        status: result.status,
        provider: result.provider ?? result.source ?? 'unknown',
        alternativeTitles: result.alternativeTitles,
        description: result.description
      } as SearchResult;
    });
  }, [searchResults]);

  // Group results by provider
  const resultsByProvider = useMemo(() => {
    const grouped: Record<string, SearchResult[]> = {};
    formattedResults.forEach(result => {
      const provider = result.provider.toLowerCase();
      grouped[provider] ??= [];
      grouped[provider].push(result);
    });
    return grouped;
  }, [formattedResults]);

  return {
    searchQuery,
    setSearchQuery,
    debouncedQuery,
    searchResults: formattedResults,
    searchLoading,
    resultsByProvider
  };
}
