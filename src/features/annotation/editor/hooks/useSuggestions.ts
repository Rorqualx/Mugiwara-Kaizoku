/**
 * useSuggestions Hook
 *
 * Manages label suggestion state and actions for Phase 4 suggestion-based pre-annotation.
 */

import { useState, useEffect, useCallback } from 'react';

import { showNotification } from '@mantine/notifications';

import { api } from '@/utils/api';

import type { Suggestion } from '../components/SuggestionPanel';

// ============================================================================
// Types
// ============================================================================

interface UseSuggestionsOptions {
  pageId: string | undefined;
  hasHtmlSnapshot: boolean;
  applyLabelToIndices: (entity: string | null, indices: number[]) => void;
}

interface UseSuggestionsReturn {
  pendingSuggestions: Suggestion[];
  autoAppliedCount: number;
  isLoading: boolean;
  handleAcceptSuggestion: (suggestionId: string) => void;
  handleRejectSuggestion: (suggestionId: string) => void;
  handleAcceptAllSuggestions: () => void;
  handleRejectAllSuggestions: () => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useSuggestions({
  pageId,
  hasHtmlSnapshot,
  applyLabelToIndices,
}: UseSuggestionsOptions): UseSuggestionsReturn {
  const [pendingSuggestions, setPendingSuggestions] = useState<Suggestion[]>([]);
  const [rejectedSuggestionIds, setRejectedSuggestionIds] = useState<Set<string>>(new Set());

  // Query for label suggestions
  const { data: suggestionsData, isLoading } = api.annotation.getSuggestions.useQuery(
    { pageId: pageId as string },
    { enabled: !!pageId && typeof pageId === 'string' && hasHtmlSnapshot }
  );

  // Update pending suggestions when data arrives (filter out rejected ones)
  useEffect(() => {
    if (suggestionsData?.suggestions) {
      const filtered = suggestionsData.suggestions.filter(
        (s) => !rejectedSuggestionIds.has(s.id)
      );
      setPendingSuggestions(filtered);
    }
  }, [suggestionsData?.suggestions, rejectedSuggestionIds]);

  const handleAcceptSuggestion = useCallback((suggestionId: string): void => {
    const suggestion = pendingSuggestions.find(s => s.id === suggestionId);
    if (!suggestion) return;

    // Apply the suggestion's label to the token indices
    applyLabelToIndices(suggestion.entityType, suggestion.tokenIndices);

    // Remove from pending suggestions
    setPendingSuggestions(prev => prev.filter(s => s.id !== suggestionId));

    showNotification({
      title: '✓ Suggestion Accepted',
      message: `Applied ${suggestion.entityType} to ${suggestion.tokenIndices.length} token(s)`,
      color: 'green',
      autoClose: 1500,
    });
  }, [pendingSuggestions, applyLabelToIndices]);

  const handleRejectSuggestion = useCallback((suggestionId: string): void => {
    // Add to rejected set and remove from pending
    setRejectedSuggestionIds(prev => new Set([...prev, suggestionId]));
    setPendingSuggestions(prev => prev.filter(s => s.id !== suggestionId));
  }, []);

  const handleAcceptAllSuggestions = useCallback((): void => {
    for (const suggestion of pendingSuggestions) {
      applyLabelToIndices(suggestion.entityType, suggestion.tokenIndices);
    }
    setPendingSuggestions([]);
    showNotification({
      title: '✓ All Suggestions Accepted',
      message: `Applied ${pendingSuggestions.length} suggestion(s)`,
      color: 'green',
      autoClose: 2000,
    });
  }, [pendingSuggestions, applyLabelToIndices]);

  const handleRejectAllSuggestions = useCallback((): void => {
    const ids = pendingSuggestions.map(s => s.id);
    setRejectedSuggestionIds(prev => new Set([...prev, ...ids]));
    setPendingSuggestions([]);
  }, [pendingSuggestions]);

  return {
    pendingSuggestions,
    autoAppliedCount: suggestionsData?.autoAppliedCount ?? 0,
    isLoading,
    handleAcceptSuggestion,
    handleRejectSuggestion,
    handleAcceptAllSuggestions,
    handleRejectAllSuggestions,
  };
}
