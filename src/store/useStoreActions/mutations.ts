/**
 * Mutations Module
 *
 * tRPC mutation hooks for store actions.
 * Wrapped in useMemo to prevent dependency changes on every render.
 *
 * Extracted from: useStoreActions.ts (lines 125-169)
 */

import { useMemo } from 'react';

import { trpc } from '@/utils/trpc-client/index';

/**
 * Mock mutation type for fallback when endpoints are unavailable
 */
interface MockMutation {
  mutate: (params: unknown) => void;
  mutateAsync: (params: unknown) => Promise<unknown>;
  isPending: boolean;
}


/**
 * Return type for the mutations hook
 */
interface StoreActionsMutationsReturn {
  updateMangaMutation: ReturnType<typeof trpc.manga.update.useMutation>;
  downloadMutation: MockMutation;
  syncMutation: MockMutation;
  settingsMutation: ReturnType<typeof trpc.settings.set.useMutation>;
}

/**
 * Hook that provides all mutations used by store actions
 *
 * Uses useMemo to stabilize mutation references and prevent
 * react-hooks/exhaustive-deps warnings from conditional logic.
 *
 * @returns Object containing all mutations used by store actions
 */
export function useStoreActionsMutations(): StoreActionsMutationsReturn {
  // Core mutations - always available
  const updateMangaMutation = trpc.manga.update.useMutation({});
  const settingsMutation = trpc.settings.set.useMutation({});

  // Download mutation - available in the manga router
  const downloadMutationRaw = trpc.manga.download.useMutation({});

  // Memoize download mutation to stabilize reference for useCallback dependencies
  const downloadMutation = useMemo((): MockMutation => {
    return {
      mutate: downloadMutationRaw.mutate as (params: unknown) => void,
      mutateAsync: downloadMutationRaw.mutateAsync as (params: unknown) => Promise<unknown>,
      isPending: downloadMutationRaw.isPending,
    };
  }, [downloadMutationRaw.mutate, downloadMutationRaw.mutateAsync, downloadMutationRaw.isPending]);

  // Sync mutation - available in the manga router
  const syncMutationRaw = trpc.manga.fixOutOfSyncChapters.useMutation({});

  // Memoize sync mutation to stabilize reference for useCallback dependencies
  const syncMutation = useMemo((): MockMutation => {
    return {
      mutate: syncMutationRaw.mutate as (params: unknown) => void,
      mutateAsync: syncMutationRaw.mutateAsync as (params: unknown) => Promise<unknown>,
      isPending: syncMutationRaw.isPending,
    };
  }, [syncMutationRaw.mutate, syncMutationRaw.mutateAsync, syncMutationRaw.isPending]);

  return {
    updateMangaMutation,
    downloadMutation,
    syncMutation,
    settingsMutation,
  };
}
