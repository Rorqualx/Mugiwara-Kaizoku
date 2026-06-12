/**
 * Thin imperative wrapper around the `settings.get` / `settings.set` tRPC
 * procedures. Exposes `{ get, set, isLoading, error, refetch }` — the only
 * surface the three callers (`useEventConfig`, `useFileOrganizationConfig`,
 * `useDownloadClientConfig`) consume.
 *
 * @module hooks/useConfigTRPC
 */
import { useCallback, useState } from 'react';

import { logger } from '../utils/logger';
import { trpc } from '../utils/trpc-client/index';

export interface UseConfigReturn {
  isLoading: boolean;
  error: Error | null;
  get: <T = unknown>(key: string) => Promise<T | undefined>;
  getBatch: (keys: string[]) => Promise<Record<string, unknown>>;
  set: <T = unknown>(key: string, value: T) => Promise<void>;
  refetch: () => void;
}

/**
 * Returns imperative `get`/`set` against the settings tRPC procedures.
 *
 * Reads go through `utils.settings.get.fetch` (TanStack-Query-cached). Writes
 * go through `settings.set` and invalidate the query cache on success.
 *
 * Optimistic updates and rollback are handled by callers in their own local
 * `useState` — this hook deliberately does not maintain a parallel cache.
 */
export function useConfig(): UseConfigReturn {
  const utils = trpc.useUtils();
  const [error, setError] = useState<Error | null>(null);

  const setMutation = trpc.settings.set.useMutation({
    onSuccess: () => {
      void utils.settings.get.invalidate();
    },
    onError: (err) => {
      setError(err instanceof Error ? err : new Error(String(err)));
      logger.error('Failed to set configuration:', err);
    },
  });

  const get = useCallback(
    async <T = unknown,>(key: string): Promise<T | undefined> => {
      try {
        setError(null);
        const value = await utils.settings.get.fetch({ key });
        return value === undefined ? undefined : (value as T);
      } catch (err: unknown) {
        logger.error(`Error getting config for key '${key}':`, err);
        setError(err instanceof Error ? err : new Error(String(err)));
        return undefined;
      }
    },
    [utils.settings.get],
  );

  const getBatch = useCallback(
    async (keys: string[]): Promise<Record<string, unknown>> => {
      try {
        setError(null);
        return await utils.settings.getBatch.fetch({ keys });
      } catch (err: unknown) {
        logger.error(`Error getting batch config for keys [${keys.join(', ')}]:`, err);
        setError(err instanceof Error ? err : new Error(String(err)));
        return {};
      }
    },
    [utils.settings.getBatch],
  );

  const set = useCallback(
    async <T = unknown,>(key: string, value: T): Promise<void> => {
      setError(null);
      await setMutation.mutateAsync({ key, value });
      logger.info(`Configuration saved: ${key}`);
    },
    [setMutation],
  );

  const refetch = useCallback((): void => {
    void utils.settings.get.invalidate();
  }, [utils.settings.get]);

  return {
    isLoading: setMutation.isPending,
    error,
    get,
    getBatch,
    set,
    refetch,
  };
}
