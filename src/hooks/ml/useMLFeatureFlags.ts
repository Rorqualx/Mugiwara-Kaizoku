/**
 * ML Feature Flags Hook
 *
 * Custom hook for fetching and updating ML feature flags configuration.
 * Supports optimistic updates for better UX.
 */

import { useState, useEffect, useCallback } from 'react';

import type { MLFeatureFlags, MLConfig } from '@/types/ml/ml-api-types';
import { isMLFeatureFlagsResponse } from '@/types/ml/ml-api-types';
import { logger } from '@/utils/logger';

interface UseMLFeatureFlagsReturn {
  featureFlags: MLFeatureFlags | null;
  mlConfig: MLConfig | null;
  mlAvailable: boolean;
  loading: boolean;
  error: string | null;
  updateFlag: (feature: keyof MLFeatureFlags, enabled: boolean) => Promise<void>;
  refetch: () => Promise<void>;
}

/**
 * Fetches and manages ML feature flags configuration
 *
 * @returns Feature flags data, update function, and loading/error states
 */
export function useMLFeatureFlags(): UseMLFeatureFlagsReturn {
  const [featureFlags, setFeatureFlags] = useState<MLFeatureFlags | null>(null);
  const [mlConfig, setMlConfig] = useState<MLConfig | null>(null);
  const [mlAvailable, setMlAvailable] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/ml/feature-flags?type=all');

      if (!response.ok) {
        throw new Error(`Failed to fetch feature flags: ${response.statusText}`);
      }

      const data: unknown = await response.json();

      if (!isMLFeatureFlagsResponse(data)) {
        throw new Error('Invalid feature flags response format');
      }

      setFeatureFlags(data.flags);
      setMlConfig(data.mlConfig);
      setMlAvailable(data.mlAvailable);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      logger.error('Failed to fetch ML feature flags', { error: err, message: errorMessage });
      setError('Failed to load feature flags');
    } finally {
      setLoading(false);
    }
  }, []);

  const updateFlag = useCallback(
    async (feature: keyof MLFeatureFlags, enabled: boolean): Promise<void> => {
      if (!featureFlags) {
        logger.warn('Cannot update feature flag: featureFlags is null');
        return;
      }

      // Optimistic update
      const previousFlags = featureFlags;
      setFeatureFlags({
        ...featureFlags,
        [feature]: enabled
      });

      try {
        const response = await fetch('/api/ml/feature-flags?type=flag', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ feature, enabled })
        });

        if (!response.ok) {
          throw new Error(`Failed to update feature flag: ${response.statusText}`);
        }

        // Re-fetch to ensure consistency with server state
        await fetchData();
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        logger.error('Failed to update feature flag', {
          error: err,
          message: errorMessage,
          feature,
          enabled
        });

        // Revert optimistic update on error
        setFeatureFlags(previousFlags);
        setError(`Failed to update ${feature}`);
      }
    },
    [featureFlags, fetchData]
  );

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  return {
    featureFlags,
    mlConfig,
    mlAvailable,
    loading,
    error,
    updateFlag,
    refetch: fetchData
  };
}
