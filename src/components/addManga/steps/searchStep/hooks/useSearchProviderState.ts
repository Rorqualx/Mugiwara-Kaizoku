/**
 * useSearchProviderState Hook
 *
 * Manages metadata provider state and configuration.
 * Handles enabled providers, default source, and provider search routing.
 *
 * MOVED from: useSearchStepState.tsx (lines 43-87)
 */

import { useState, useEffect, useMemo, useCallback } from 'react';

import { logger } from '@/utils/logger';
import { trpc } from '@/utils/trpc-client/index';

import { convertToMetadataProviders } from '../helpers';

import type { UseSearchProviderStateReturn } from './types';

/**
 * Hook to manage provider state and configuration
 *
 * @returns Provider state and helper functions
 *
 * @example
 * ```tsx
 * const { enabledSources, defaultSource, shouldUseProviderSearch } = useSearchProviderState();
 * ```
 */
export function useSearchProviderState(): UseSearchProviderStateReturn {
  const { data: metadataProviders } = trpc.search.getProviders.useQuery();
  const typedProviders = useMemo(() => convertToMetadataProviders(metadataProviders), [metadataProviders]);
  const enabledSources = useMemo(() => typedProviders.filter(source => source.status === 'active'), [typedProviders]);

  const [defaultSource, setDefaultSource] = useState<string>('anilist');

  // Update defaultSource when enabledSources changes
  useEffect(() => {
    if (enabledSources.length > 0) {
      const firstSource = enabledSources[0];
      if (firstSource?.id) {
        setDefaultSource(firstSource.id);
      }
    }
  }, [enabledSources]);

  // Get all enabled provider IDs
  const allProviderIds = useMemo((): string[] => {
    if (enabledSources.length === 0) return [];
    const ids = enabledSources.map(source => source.id).filter(Boolean) as string[];
    logger.debug(`Enabled search providers: ${ids.join(', ')}`);
    return ids;
  }, [enabledSources]);

  const shouldUseProviderSearch = useCallback((selectedProvider: string): boolean => {
    return selectedProvider !== 'anilist' && selectedProvider !== '';
  }, []);

  return {
    metadataProviders,
    enabledSources,
    defaultSource,
    setDefaultSource,
    allProviderIds,
    shouldUseProviderSearch
  };
}
