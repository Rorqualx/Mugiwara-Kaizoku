/**
 * ML Models Hook
 *
 * Custom hook for fetching ML model status information.
 */

import { useState, useEffect, useCallback } from 'react';

import {
  MLModelsResponse,
  isMLModelsResponse
} from '@/types/ml/ml-api-types';
import { logger } from '@/utils/logger';

interface UseMLModelsReturn {
  modelStatus: MLModelsResponse;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Fetches ML model status information
 *
 * @returns Model status data and loading/error states
 */
export function useMLModels(): UseMLModelsReturn {
  const [modelStatus, setModelStatus] = useState<MLModelsResponse>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/ml/models?type=status');

      if (!response.ok) {
        throw new Error(`Failed to fetch model status: ${response.statusText}`);
      }

      const data: unknown = await response.json();

      if (!isMLModelsResponse(data)) {
        throw new Error('Invalid model status response format');
      }

      setModelStatus(data);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      logger.error('Failed to fetch ML model status', { error: err, message: errorMessage });
      setError('Failed to load model status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  return {
    modelStatus,
    loading,
    error,
    refetch: fetchData
  };
}
