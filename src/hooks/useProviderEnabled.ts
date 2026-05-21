/**
 * Provider Enabled Toggle Hook
 *
 * Generic hook for the simple `{provider}.enabled` boolean — used by metadata
 * providers that have no other config to manage (Fandom, Wikipedia, MangaDex,
 * MangaUpdates). Providers with richer config (AniList, ComicVine, MAL) keep
 * their dedicated hooks.
 *
 * Backed by `useConfigValue`, so the React-Query cache for the key is shared
 * across every component on the page (settings header + grid card + anything
 * else that asks for the same provider's enabled state). Toggling in one
 * component refreshes the others without a page reload.
 *
 * The legacy `search.providers.MANGADEX.enabled` fallback was dropped — the
 * `metadataProvidersEnabledMigration` already backfills the new key on every
 * startup, so no runtime fallback is necessary.
 */

import { useCallback } from 'react';

import { notify } from '@/utils/notify';

import { useConfigValue } from './useConfigValue';

export interface UseProviderEnabledOptions {
  /** Default value when the key is absent. */
  defaultEnabled?: boolean;
  /** Friendly label for toast messages (defaults to providerId). */
  displayName?: string;
}

export interface UseProviderEnabledResult {
  enabled: boolean;
  isLoading: boolean;
  saving: boolean;
  error: Error | null;
  setEnabled: (value: boolean) => Promise<void>;
}

function showSuccessToast(label: string, value: boolean): void {
  notify({ severity: 'SUCCESS', title: 'Success', message: `${label} ${value ? 'enabled' : 'disabled'}` });
}

function showErrorToast(label: string, message: string): void {
  notify({ severity: 'ERROR', title: 'Error', message: `Failed to toggle ${label}: ${message}` });
}

export function useProviderEnabled(
  providerId: string,
  options: UseProviderEnabledOptions = {},
): UseProviderEnabledResult {
  const { defaultEnabled = true, displayName } = options;
  const label = displayName ?? providerId;

  const { value, isLoading, saving, error, setValue } = useConfigValue<boolean>(
    `${providerId}.enabled`,
    defaultEnabled,
  );

  const setEnabled = useCallback(
    async (next: boolean): Promise<void> => {
      try {
        await setValue(next);
        showSuccessToast(label, next);
      } catch (err: unknown) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        showErrorToast(label, errorObj.message);
        throw errorObj;
      }
    },
    [setValue, label],
  );

  return { enabled: value, isLoading, saving, error, setEnabled };
}
