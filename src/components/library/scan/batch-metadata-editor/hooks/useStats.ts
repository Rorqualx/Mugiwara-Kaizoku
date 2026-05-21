/**
 * Batch Metadata Editor - Statistics Hook
 *
 * Computes statistics from match states for display in tabs and progress.
 *
 * Extracted from: BatchMetadataEditor.tsx (lines 296-306)
 */

import { useMemo } from 'react';

import type { MangaMatchState } from '../types';

export interface MatchStats {
  total: number;
  matched: number;
  unmatched: number;
  noResults: number;
  errors: number;
  isLoading: number;
}

export function useStats(matchStates: Map<number, MangaMatchState>): MatchStats {
  const stats = useMemo((): MatchStats => {
    const states = Array.from(matchStates.values());
    return {
      total: states.length,
      matched: states.filter((s) => s.selectedMatchId).length,
      unmatched: states.filter((s) => !s.selectedMatchId && s.matches.length > 0).length,
      noResults: states.filter((s) => s.matches.length === 0 && !s.isLoading).length,
      errors: states.filter((s) => s.error).length,
      isLoading: states.filter((s) => s.isLoading).length,
    };
  }, [matchStates]);

  return stats;
}
