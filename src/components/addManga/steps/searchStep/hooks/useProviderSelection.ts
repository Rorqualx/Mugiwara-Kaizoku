/**
 * useProviderSelection Hook
 *
 * Manages provider selection state and coordinates search triggering
 * when the provider changes.
 */

import { useState, useCallback } from 'react';

import { logger } from '@/utils/logger';

import type { UseProviderSelectionReturn } from './types';

/**
 * Props for useProviderSelection hook
 */
interface UseProviderSelectionProps {
  query: string;
  onProviderChange?: (provider: string) => void;
}

/**
 * Hook to manage provider selection state
 *
 * @param props - Hook configuration
 * @returns Provider selection state and handlers
 *
 * @example
 * ```tsx
 * const { selectedProvider, handleProviderChange } = useProviderSelection({
 *   query,
 *   onProviderChange: (provider) => triggerSearch()
 * });
 * ```
 */
export function useProviderSelection({
  query,
  onProviderChange
}: UseProviderSelectionProps): UseProviderSelectionReturn {
  const [selectedProvider, setSelectedProvider] = useState<string>('');

  /**
   * Handle provider selection change
   * Triggers search if query is valid and notifies parent
   */
  const handleProviderChange = useCallback((value: string | null): void => {
    const newProvider = value ?? '';
    setSelectedProvider(newProvider);

    if (query.length >= 3) {
      logger.info(`Provider changed to "${newProvider}", triggering new search for "${query}"`);
    }

    // Notify parent of provider change
    if (onProviderChange) {
      onProviderChange(newProvider);
    }
  }, [query, onProviderChange]);

  return {
    selectedProvider,
    handleProviderChange,
    setSelectedProvider
  };
}
