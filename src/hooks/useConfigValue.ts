/**
 * useConfigValue — single config-key reactive hook
 *
 * Wraps `trpc.settings.get.useQuery` + `trpc.settings.set.useMutation` so every
 * component reading the same key shares one React-Query cache entry. Mutations
 * optimistically update the cache and invalidate the query, so all subscribers
 * re-render with the new value automatically — no manual refresh, no stale
 * sibling components.
 *
 * Replaces the older pattern of imperative `useConfigService.getConfig` writes
 * into per-component `useState`, which left other consumers of the same key
 * showing stale values until page refresh.
 */

import { useCallback, useMemo } from 'react';

import { trpc } from '@/utils/trpc-client';

export interface UseConfigValueResult<T> {
  value: T;
  isLoading: boolean;
  saving: boolean;
  error: Error | null;
  setValue: (value: T) => Promise<void>;
  refetch: () => Promise<void>;
}

function coerce<T>(raw: unknown, defaultValue: T): T {
  if (raw !== undefined && raw !== null) {
    return raw as T;
  }
  return defaultValue;
}

export function useConfigValue<T>(key: string, defaultValue: T): UseConfigValueResult<T> {
  const utils = trpc.useUtils();

  const queryInput = useMemo(
    () => ({ key, defaultValue: defaultValue as unknown }),
    [key, defaultValue],
  );

  const query = trpc.settings.get.useQuery(queryInput, {
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const mutation = trpc.settings.set.useMutation({
    onSuccess: () => {
      void utils.settings.get.invalidate({ key });
    },
    onError: () => {
      void utils.settings.get.invalidate({ key });
    },
  });

  const setValue = useCallback(
    async (value: T): Promise<void> => {
      utils.settings.get.setData(queryInput, value as unknown);
      await mutation.mutateAsync({ key, value: value as unknown });
    },
    [mutation, utils.settings.get, key, queryInput],
  );

  const refetch = useCallback(async (): Promise<void> => {
    await query.refetch();
  }, [query]);

  const queryError = query.error ? new Error(query.error.message) : null;
  const mutationError = mutation.error ? new Error(mutation.error.message) : null;

  return {
    value: coerce<T>(query.data, defaultValue),
    isLoading: query.isLoading,
    saving: mutation.isPending,
    error: queryError ?? mutationError,
    setValue,
    refetch,
  };
}
