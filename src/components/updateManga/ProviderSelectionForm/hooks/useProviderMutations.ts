/**
 * useProviderMutations Hook
 *
 * Manages mutations for fetching provider metadata and updating preferences.
 * Extracted from ProviderSelectionForm to improve modularity and testability.
 */

import { useCallback, useRef } from 'react';

import type { ProviderMetadataResult } from '@/components/updateManga/providerFormUtils';
import { logger } from '@/utils/logger';
import { notify } from '@/utils/notify';
import { trpc } from '@/utils/trpc-client';

interface UseProviderMutationsProps {
  onUpdate: () => void;
  onClose?: () => void;
  setSaving: (saving: boolean) => void;
}

interface UseProviderMutationsReturn {
  getProviderMetadata: (params: { mangaId: number; provider: string }) => Promise<ProviderMetadataResult | null>;
  updateProviderPreferences: (data: {
    id: number;
    preferences: Record<string, { provider: string; value: unknown }>;
  }) => Promise<unknown>;
  handleMutationSuccess: () => void;
  handleMutationError: (error: Error) => void;
  isMutating: boolean;
}

// Mock API for fallback when tRPC methods are unavailable
const mockMangaAPI = {
  getProviderMetadata: {
    useMutation: (): {
      mutateAsync: (data: unknown) => Promise<{
        success: boolean;
        data: {
          id: string;
          title: string;
          description: string;
          coverUrl: string;
          chapterCount: number;
          provider: string;
        };
      }>;
      isPending: boolean;
    } => ({
      mutateAsync: async (_data: unknown) => Promise.resolve({
        success: true,
        data: {
          id: '',
          title: '',
          description: '',
          coverUrl: '',
          chapterCount: 0,
          provider: ''
        }
      }),
      isPending: false
    })
  },
  updateProviderPreferences: {
    useMutation: (): {
      mutateAsync: (data: unknown) => Promise<unknown>;
      isPending: boolean;
    } => ({
      mutateAsync: async (data: unknown) => Promise.resolve(data),
      isPending: false
    })
  }
};

export function useProviderMutations({
  onUpdate,
  onClose,
  setSaving,
}: UseProviderMutationsProps): UseProviderMutationsReturn {
  // Merge mock API with actual tRPC API for safe access
  const mangaAPI = { ...mockMangaAPI, ...trpc.manga };

  // Provider metadata mutation
  const providerSearchMutation = typeof mangaAPI.getProviderMetadata.useMutation === 'function'
    ? mangaAPI.getProviderMetadata.useMutation()
    : mockMangaAPI.getProviderMetadata.useMutation();

  // Update preferences mutation
  const updateProviderPreferencesMutation = typeof mangaAPI.updateProviderPreferences.useMutation === 'function'
    ? mangaAPI.updateProviderPreferences.useMutation()
    : mockMangaAPI.updateProviderPreferences.useMutation();

  // Use refs to hold mutateAsync functions to avoid dependency on mutation state changes
  const providerSearchMutateRef = useRef(providerSearchMutation.mutateAsync);
  providerSearchMutateRef.current = providerSearchMutation.mutateAsync;

  const updatePreferencesMutateRef = useRef(updateProviderPreferencesMutation.mutateAsync);
  updatePreferencesMutateRef.current = updateProviderPreferencesMutation.mutateAsync;

  // Use refs for callback props to avoid recreating handlers when props change
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const setSavingRef = useRef(setSaving);
  setSavingRef.current = setSaving;

  /**
   * Fetches provider metadata for a specific manga and provider
   */
  const getProviderMetadata = useCallback(async (params: {
    mangaId: number;
    provider: string;
  }): Promise<ProviderMetadataResult | null> => {
    try {
      const result = await providerSearchMutateRef.current(params);
      return result as ProviderMetadataResult;
    }
    catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error fetching provider metadata: ${errorMessage}`);
      return null;
    }
  }, []);

  /**
   * Updates provider preferences for a manga
   */
  const updateProviderPreferences = useCallback(async (data: {
    id: number;
    preferences: Record<string, { provider: string; value: unknown }>;
  }): Promise<unknown> => {
    try {
      return await updatePreferencesMutateRef.current(data);
    }
    catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error updating provider preferences: ${errorMessage}`);
      throw error;
    }
  }, []);

  /**
   * Handles successful mutation completion
   */
  const handleMutationSuccess = useCallback((): void => {
    notify({ severity: 'SUCCESS', title: 'Preferences Updated', message: 'Provider preferences have been saved successfully.' });
    setSavingRef.current(false);
    onUpdateRef.current();
    if (onCloseRef.current) {
      onCloseRef.current();
    }
  }, []);

  /**
   * Handles mutation errors
   */
  const handleMutationError = useCallback((error: Error): void => {
    notify({ severity: 'ERROR', title: 'Update Failed', message: (error instanceof Error ? error.message : String(error)) || 'Failed to update provider preferences.' });
    setSavingRef.current(false);
  }, []);

  return {
    getProviderMetadata,
    updateProviderPreferences,
    handleMutationSuccess,
    handleMutationError,
    isMutating: providerSearchMutation.isPending || updateProviderPreferencesMutation.isPending
  };
}

export default useProviderMutations;
