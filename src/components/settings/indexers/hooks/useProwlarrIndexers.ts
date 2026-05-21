/**
 * Custom hook for managing Prowlarr indexers
 *
 * Handles indexers state, fetching, and operations for managing Prowlarr indexers.
 *
 * @module pages/settings/indexers/hooks/useProwlarrIndexers
 */

import { useState, useCallback, useEffect } from 'react';

import { useIntegrationStore } from '@/store/integrationSlice';
import { logger } from '@/utils/logger';
import { createProwlarrClient } from '@/utils/prowlarrApi';

import { processIndexersData, extractErrorMessage } from '../utils/utils';

import type { IndexersState } from '../types';


/**
 * Hook return type
 */
export interface UseProwlarrIndexersReturn {
  indexersState: IndexersState;
  fetchIndexers: () => Promise<void>;
}

/**
 * Custom hook for managing Prowlarr indexers
 *
 * @returns Indexers state and handlers
 */
export function useProwlarrIndexers(): UseProwlarrIndexersReturn {
  const prowlarrSettings = useIntegrationStore((state) => state.prowlarr);

  // Indexers state
  const [indexersState, setIndexersState] = useState<IndexersState>({
    indexers: [],
    isLoading: false,
    error: null,
    showIndexers: false
  });

  /**
   * Fetches indexers from Prowlarr API
   */
  const fetchIndexers = useCallback(async () => {
    // Clear previous errors
    setIndexersState(prev => ({ ...prev, error: null }));

    // Check if Prowlarr is properly configured
    if (!prowlarrSettings.enabled) {
      setIndexersState(prev => ({
        ...prev,
        error: 'Prowlarr integration is disabled. Enable it using the toggle above.'
      }));
      return;
    }

    if (!prowlarrSettings.baseURL) {
      setIndexersState(prev => ({
        ...prev,
        error: 'Prowlarr URL is not configured. Please enter your Prowlarr URL and save.'
      }));
      return;
    }

    if (!prowlarrSettings.apiKey) {
      setIndexersState(prev => ({
        ...prev,
        error: 'Prowlarr API key is not configured. Please enter your API key and save.'
      }));
      return;
    }

    setIndexersState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const client = createProwlarrClient({
        baseURL: prowlarrSettings.baseURL,
        apiKey: prowlarrSettings.apiKey
      });

      const data: unknown = await client.getIndexers();
      const processedData = processIndexersData(data);

      setIndexersState(prev => ({
        ...prev,
        indexers: processedData,
        isLoading: false
      }));
    } catch (err: unknown) {
      logger.error('Failed to fetch indexers:', err);
      const errorMessage = extractErrorMessage(err);
      setIndexersState(prev => ({
        ...prev,
        error: `Failed to fetch indexers: ${errorMessage}`,
        isLoading: false
      }));
    }
  }, [prowlarrSettings.enabled, prowlarrSettings.baseURL, prowlarrSettings.apiKey]);

  /**
   * Initialization effect
   * Loads settings from store and fetches indexers if Prowlarr is configured
   */
  useEffect(() => {
    // Check if Prowlarr is configured
    if (prowlarrSettings.enabled && prowlarrSettings.baseURL && prowlarrSettings.apiKey) {
      setIndexersState(prev => ({ ...prev, showIndexers: true }));
      void fetchIndexers();
    }
  }, [prowlarrSettings.enabled, prowlarrSettings.baseURL, prowlarrSettings.apiKey, fetchIndexers]);

  return {
    indexersState,
    fetchIndexers
  };
}