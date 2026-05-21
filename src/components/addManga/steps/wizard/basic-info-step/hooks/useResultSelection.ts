/**
 * useResultSelection Hook
 *
 * Manages search result selection with loading states.
 * Handles special cases like ComicVine chapter loading.
 *
 * @module components/addManga/steps/wizard/basic-info-step/hooks/useResultSelection
 */

import { useState, useCallback } from 'react';

import { getStringProp } from '../utils';

/**
 * Parameters for useResultSelection hook
 */
export interface UseResultSelectionParams {
  selectedSources: string[];
  handleAdditionalSourceSelection: (provider: string, result: unknown, forceUpdate?: boolean) => Promise<void>;
}

/**
 * Return type for useResultSelection hook
 */
export interface UseResultSelectionReturn {
  loadingResults: Record<string, string>;
  handleSelectResult: (provider: string, result: unknown) => Promise<void>;
}

/**
 * Custom hook for managing search result selection
 *
 * @param params - Hook parameters
 * @returns Result selection state and handlers
 */
export function useResultSelection(params: UseResultSelectionParams): UseResultSelectionReturn {
  // selectedSources is passed via callbacks to source-selection.ts, not used directly here
  const { selectedSources: _selectedSources, handleAdditionalSourceSelection } = params;

  const [loadingResults, setLoadingResults] = useState<Record<string, string>>({});

  /**
   * Handle result selection with loading state
   * Now handles all providers uniformly with loading state and error handling
   */
  const handleSelectResult = useCallback(async (providerName: string, result: unknown): Promise<void> => {
    const resultId = getStringProp(result, 'id') ?? getStringProp(result, 'sourceId') ?? '';
    const resultKey = `${providerName}-${resultId}`;

    // Set loading state for all providers
    const loadingMessage = providerName.toLowerCase() === 'comicvine'
      ? 'Loading chapters...'
      : `Loading ${providerName} metadata...`;
    setLoadingResults(prev => ({ ...prev, [resultKey]: loadingMessage }));

    try {
      // Add timeout to prevent infinite hanging (30 seconds for metadata fetch)
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Timeout: ${providerName} metadata fetch took too long`)), 30000);
      });

      await Promise.race([
        handleAdditionalSourceSelection(providerName, result, false),
        timeoutPromise
      ]);
    } catch (error) {
      console.error(`[useResultSelection] Failed to select ${providerName}:`, error);
    } finally {
      setLoadingResults(prev => {
        const updated = { ...prev };
        delete updated[resultKey];
        return updated;
      });
    }
  }, [handleAdditionalSourceSelection]);

  return {
    loadingResults,
    handleSelectResult
  };
}
