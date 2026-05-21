/**
 * Hook for managing multi-source selection and primary provider
 */

import { useCallback, useMemo, useState } from 'react';

import type { SearchResult, SelectedSourceInfo } from '../types';

export function useSourceSelection(): {
  selectedSources: Record<string, SearchResult>;
  primaryProvider: string | null;
  selectedResult: SearchResult | null;
  selectedSourcesList: SelectedSourceInfo[];
  selectedSourcesCount: number;
  handleSelectResult: (result: SearchResult) => void;
  handleSetPrimary: (provider: string) => void;
  handleRemoveSource: (provider: string) => void;
  resetSelection: () => void;
} {
  // Multi-source selection: one result per provider
  const [selectedSources, setSelectedSources] = useState<Record<string, SearchResult>>({});
  // Primary source provider (the main one used for import)
  const [primaryProvider, setPrimaryProvider] = useState<string | null>(null);

  // Get the primary selected result (for backward compatibility)
  const selectedResult = primaryProvider ? selectedSources[primaryProvider] ?? null : null;

  // Handle search result selection - toggles source for that provider
  const handleSelectResult = useCallback((result: SearchResult) => {
    const provider = result.provider.toLowerCase();
    setSelectedSources(prev => {
      const isAlreadySelected = prev[provider]?.id === result.id;
      if (isAlreadySelected) {
        // Deselect this source
        const { [provider]: _, ...rest } = prev;
        // If this was the primary, clear it
        if (primaryProvider === provider) {
          setPrimaryProvider(Object.keys(rest)[0] ?? null);
        }
        return rest;
      } else {
        // Select/replace source for this provider
        const newSources = { ...prev, [provider]: result };
        // If no primary set, make this the primary
        if (!primaryProvider) {
          setPrimaryProvider(provider);
        }
        return newSources;
      }
    });
  }, [primaryProvider]);

  // Set a source as the primary
  const handleSetPrimary = useCallback((provider: string) => {
    if (selectedSources[provider]) {
      setPrimaryProvider(provider);
    }
  }, [selectedSources]);

  // Remove a source
  const handleRemoveSource = useCallback((provider: string) => {
    setSelectedSources(prev => {
      const { [provider]: _, ...rest } = prev;
      return rest;
    });
    if (primaryProvider === provider) {
      setPrimaryProvider(_prev => {
        const remaining = Object.keys(selectedSources).filter(p => p !== provider);
        return remaining[0] ?? null;
      });
    }
  }, [primaryProvider, selectedSources]);

  // Reset selection
  const resetSelection = useCallback(() => {
    setSelectedSources({});
    setPrimaryProvider(null);
  }, []);

  // Get list of selected sources for display
  const selectedSourcesList = useMemo(() => {
    return Object.entries(selectedSources).map(([provider, result]) => ({
      provider,
      result,
      isPrimary: provider === primaryProvider
    }));
  }, [selectedSources, primaryProvider]);

  // Count selected sources
  const selectedSourcesCount = Object.keys(selectedSources).length;

  return {
    selectedSources,
    primaryProvider,
    selectedResult,
    selectedSourcesList,
    selectedSourcesCount,
    handleSelectResult,
    handleSetPrimary,
    handleRemoveSource,
    resetSelection
  };
}
