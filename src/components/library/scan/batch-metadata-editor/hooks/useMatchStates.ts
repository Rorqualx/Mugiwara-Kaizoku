/**
 * Batch Metadata Editor - Match States Hook
 *
 * Manages state for batch metadata matching including:
 * - Match state for each manga
 * - Search/filter functionality
 * - Expanded/collapsed state
 * - Save operation state
 *
 * Extracted from: BatchMetadataEditor.tsx (lines 32-168)
 */

import { useState, useEffect, useMemo, useCallback } from 'react';

import type { ProviderMatch } from '@/types/domain/enrichment-result-types';

import type {
  MangaForMatching,
  MetadataUpdate,
  MangaMatchState
} from '../types';

export interface UseMatchStatesParams {
  manga: MangaForMatching[];
  fetchMatches: (title: string) => Promise<ProviderMatch[]>;
  onSave: (updates: MetadataUpdate[]) => Promise<void>;
}

export interface UseMatchStatesReturn {
  matchStates: Map<number, MangaMatchState>;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  expandedManga: Set<number>;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isSaving: boolean;
  filteredManga: MangaMatchState[];
  handleSelectMatch: (mangaId: number, matchId: string) => void;
  handleToggleExpanded: (mangaId: number) => void;
  handleRetry: (manga: MangaForMatching) => void;
  handleSave: () => Promise<void>;
}

export function useMatchStates({
  manga,
  fetchMatches,
  onSave,
}: UseMatchStatesParams): UseMatchStatesReturn {
  // State declarations
  const [matchStates, setMatchStates] = useState<Map<number, MangaMatchState>>(new Map());
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [expandedManga, setExpandedManga] = useState<Set<number>>(new Set());
  const [activeTab, setActiveTab] = useState<string>('all');

  // Initialize match states
  useEffect(() => {
    const initialStates = new Map<number, MangaMatchState>();
    manga.forEach((m) => {
      initialStates.set(m.id, {
        manga: m,
        matches: [],
        isLoading: false
      });
    });
    setMatchStates(initialStates);
  }, [manga]);

  // Fetch matches for manga
  const fetchMatchesForManga = useCallback(async (m: MangaForMatching): Promise<void> => {
    setMatchStates((prev) => {
      const newMap = new Map(prev);
      const state = newMap.get(m.id) ?? { manga: m, matches: [], isLoading: false };
      newMap.set(m.id, { ...state, isLoading: true });
      return newMap;
    });

    try {
      const matches = await fetchMatches(m.title);
      setMatchStates((prev) => {
        const newMap = new Map(prev);
        const state = newMap.get(m.id) ?? { manga: m, matches: [], isLoading: false };
        const firstMatch = matches[0];
        newMap.set(m.id, {
          ...state,
          matches,
          isLoading: false,
          // Auto-select high confidence match
          ...(firstMatch && firstMatch.confidence >= 0.9 && { selectedMatchId: firstMatch.id })
        });
        return newMap;
      });
    } catch (error: unknown) {
      setMatchStates((prev) => {
        const newMap = new Map(prev);
        const state = newMap.get(m.id) ?? { manga: m, matches: [], isLoading: false };
        newMap.set(m.id, {
          ...state,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to fetch matches'
        });
        return newMap;
      });
    }
  }, [fetchMatches]);

  // Fetch matches for all manga
  // Sequential fetching is intentional to avoid overwhelming the metadata API
  useEffect(() => {
    const fetchAllMatches = async (): Promise<void> => {
      for (const m of manga) {
        // eslint-disable-next-line no-await-in-loop -- Sequential requests intentional to respect API rate limits
        await fetchMatchesForManga(m);
      }
    };
    void fetchAllMatches();
  }, [manga, fetchMatchesForManga]);

  // Filter manga based on search and tab
  const filteredManga = useMemo((): MangaMatchState[] => {
    let filtered = Array.from(matchStates.values());

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((state) => state.manga.title.toLowerCase().includes(query));
    }

    // Filter by tab
    switch (activeTab) {
      case 'matched':
        filtered = filtered.filter((state) => state.selectedMatchId);
        break;
      case 'unmatched':
        filtered = filtered.filter((state) => !state.selectedMatchId && state.matches.length > 0);
        break;
      case 'no-results':
        filtered = filtered.filter((state) => state.matches.length === 0 && !state.isLoading);
        break;
      case 'errors':
        filtered = filtered.filter((state) => state.error);
        break;
      case 'all':
      default:
        // 'all' tab or any other - no additional filtering needed
        break;
    }

    return filtered;
  }, [matchStates, searchQuery, activeTab]);

  // Event handlers
  const handleSelectMatch = useCallback((mangaId: number, matchId: string): void => {
    setMatchStates((prev) => {
      const newMap = new Map(prev);
      const state = newMap.get(mangaId);
      if (state) {
        newMap.set(mangaId, {
          ...state,
          ...(matchId === state.selectedMatchId ? {} : { selectedMatchId: matchId })
        });
      }
      return newMap;
    });
  }, []);

  const handleToggleExpanded = useCallback((mangaId: number): void => {
    setExpandedManga((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(mangaId)) {
        newSet.delete(mangaId);
      } else {
        newSet.add(mangaId);
      }
      return newSet;
    });
  }, []);

  const handleRetry = useCallback((manga: MangaForMatching): void => {
    void fetchMatchesForManga(manga);
  }, [fetchMatchesForManga]);

  const handleSave = useCallback(async (): Promise<void> => {
    const updates: MetadataUpdate[] = [];
    matchStates.forEach((state, mangaId) => {
      if (state.selectedMatchId) {
        const match = state.matches.find((m) => m.id === state.selectedMatchId);
        if (match) {
          updates.push({
            mangaId,
            provider: match.provider,
            providerId: match.providerId
          });
        }
      }
    });

    setIsSaving(true);
    try {
      await onSave(updates);
    } finally {
      setIsSaving(false);
    }
  }, [matchStates, onSave]);

  return {
    matchStates,
    searchQuery,
    setSearchQuery,
    expandedManga,
    activeTab,
    setActiveTab,
    isSaving,
    filteredManga,
    handleSelectMatch,
    handleToggleExpanded,
    handleRetry,
    handleSave,
  };
}
