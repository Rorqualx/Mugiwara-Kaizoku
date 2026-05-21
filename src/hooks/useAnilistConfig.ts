/**
 * AniList Configuration Hook
 *
 * Reads/writes AniList integration config keys via `useConfigValue`, so the
 * React-Query cache for each key is shared across every consumer on the page.
 * Public API ({ config, isLoading, saving, error, updateSetting, updateConfig,
 * refresh }) is unchanged.
 *
 * `updateSetting` preserves the original cascade rules:
 *   - enabled=false             → also clears useForMetadata + useEnhancedProvider
 *   - useForMetadata=false      → also clears useEnhancedProvider
 *   - useEnhancedProvider=true  → also forces enabled + useForMetadata to true
 */

import React, { useCallback } from 'react';

import { notifications } from '@mantine/notifications';
import { IconCheck, IconAlertCircle } from '@tabler/icons-react';

import { useConfigValue, type UseConfigValueResult } from './useConfigValue';

export interface AnilistConfig {
  enabled: boolean;
  useForMetadata: boolean;
  clientId: string;
  clientSecret: string;
  accessToken: string;
  useEnhancedProvider: boolean;
  filterAdultContent: boolean;
  /** Experimental: Filter out webtoon format from results */
  filterWebtoons: boolean;
  /** Experimental: Filter out Korean manhwa from results */
  filterKoreanManhwa: boolean;
}

export interface UseAnilistConfigResult {
  config: AnilistConfig;
  isLoading: boolean;
  saving: string | null;
  error: Error | null;
  updateSetting: <K extends keyof AnilistConfig>(key: K, value: AnilistConfig[K]) => Promise<void>;
  updateConfig: (config: Partial<AnilistConfig>) => Promise<void>;
  refresh: () => Promise<void>;
}

interface AnilistFields {
  enabled: UseConfigValueResult<boolean>;
  useForMetadata: UseConfigValueResult<boolean>;
  clientId: UseConfigValueResult<string>;
  clientSecret: UseConfigValueResult<string>;
  accessToken: UseConfigValueResult<string>;
  useEnhancedProvider: UseConfigValueResult<boolean>;
  filterAdultContent: UseConfigValueResult<boolean>;
  filterWebtoons: UseConfigValueResult<boolean>;
  filterKoreanManhwa: UseConfigValueResult<boolean>;
}

function showSuccess(message: string): void {
  notifications.show({
    title: 'Success',
    message,
    color: 'green',
    icon: React.createElement(IconCheck, { size: 16 }),
  });
}

function showError(message: string): void {
  notifications.show({
    title: 'Error',
    message,
    color: 'red',
    icon: React.createElement(IconAlertCircle, { size: 16 }),
  });
}

/**
 * Resolves the cascade for a single setting change.
 * Returns the array of writes that must run together to keep dependent
 * fields consistent (see hook's top-doc for rules).
 */
function buildCascade<K extends keyof AnilistConfig>(
  fields: AnilistFields,
  key: K,
  value: AnilistConfig[K],
): Promise<void>[] {
  const writes: Promise<void>[] = [];

  if (key === 'enabled') {
    writes.push(fields.enabled.setValue(value as boolean));
    if (value === false) {
      writes.push(fields.useForMetadata.setValue(false));
      writes.push(fields.useEnhancedProvider.setValue(false));
    }
    return writes;
  }
  if (key === 'useForMetadata') {
    writes.push(fields.useForMetadata.setValue(value as boolean));
    if (value === false) writes.push(fields.useEnhancedProvider.setValue(false));
    return writes;
  }
  if (key === 'useEnhancedProvider') {
    writes.push(fields.useEnhancedProvider.setValue(value as boolean));
    if (value === true) {
      writes.push(fields.enabled.setValue(true));
      writes.push(fields.useForMetadata.setValue(true));
    }
    return writes;
  }
  if (key === 'clientId') writes.push(fields.clientId.setValue(value as string));
  else if (key === 'clientSecret') writes.push(fields.clientSecret.setValue(value as string));
  else if (key === 'accessToken') writes.push(fields.accessToken.setValue(value as string));
  else if (key === 'filterAdultContent') writes.push(fields.filterAdultContent.setValue(value as boolean));
  else if (key === 'filterWebtoons') writes.push(fields.filterWebtoons.setValue(value as boolean));
  else if (key === 'filterKoreanManhwa') writes.push(fields.filterKoreanManhwa.setValue(value as boolean));
  return writes;
}

function buildBulkWrites(fields: AnilistFields, partial: Partial<AnilistConfig>): Promise<void>[] {
  const writes: Promise<void>[] = [];
  if (partial.enabled !== undefined) writes.push(fields.enabled.setValue(partial.enabled));
  if (partial.useForMetadata !== undefined) writes.push(fields.useForMetadata.setValue(partial.useForMetadata));
  if (partial.clientId !== undefined) writes.push(fields.clientId.setValue(partial.clientId));
  if (partial.clientSecret !== undefined) writes.push(fields.clientSecret.setValue(partial.clientSecret));
  if (partial.accessToken !== undefined) writes.push(fields.accessToken.setValue(partial.accessToken));
  if (partial.useEnhancedProvider !== undefined) writes.push(fields.useEnhancedProvider.setValue(partial.useEnhancedProvider));
  if (partial.filterAdultContent !== undefined) writes.push(fields.filterAdultContent.setValue(partial.filterAdultContent));
  if (partial.filterWebtoons !== undefined) writes.push(fields.filterWebtoons.setValue(partial.filterWebtoons));
  if (partial.filterKoreanManhwa !== undefined) writes.push(fields.filterKoreanManhwa.setValue(partial.filterKoreanManhwa));
  return writes;
}

function pickSavingKey(fields: AnilistFields): string | null {
  if (fields.enabled.saving) return 'enabled';
  if (fields.useForMetadata.saving) return 'useForMetadata';
  if (fields.clientId.saving) return 'clientId';
  if (fields.clientSecret.saving) return 'clientSecret';
  if (fields.accessToken.saving) return 'accessToken';
  if (fields.useEnhancedProvider.saving) return 'useEnhancedProvider';
  if (fields.filterAdultContent.saving) return 'filterAdultContent';
  if (fields.filterWebtoons.saving) return 'filterWebtoons';
  if (fields.filterKoreanManhwa.saving) return 'filterKoreanManhwa';
  return null;
}

export function useAnilistConfig(): UseAnilistConfigResult {
  const fields: AnilistFields = {
    enabled: useConfigValue<boolean>('anilist.enabled', true),
    useForMetadata: useConfigValue<boolean>('anilist.useForMetadata', true),
    clientId: useConfigValue<string>('anilist.clientId', ''),
    clientSecret: useConfigValue<string>('anilist.clientSecret', ''),
    accessToken: useConfigValue<string>('anilist.accessToken', ''),
    useEnhancedProvider: useConfigValue<boolean>('anilist.useEnhancedProvider', false),
    filterAdultContent: useConfigValue<boolean>('anilist.filterAdultContent', true),
    filterWebtoons: useConfigValue<boolean>('anilist.filterWebtoons', false),
    filterKoreanManhwa: useConfigValue<boolean>('anilist.filterKoreanManhwa', false),
  };

  const config: AnilistConfig = {
    enabled: fields.enabled.value,
    useForMetadata: fields.useForMetadata.value,
    clientId: fields.clientId.value,
    clientSecret: fields.clientSecret.value,
    accessToken: fields.accessToken.value,
    useEnhancedProvider: fields.useEnhancedProvider.value,
    filterAdultContent: fields.filterAdultContent.value,
    filterWebtoons: fields.filterWebtoons.value,
    filterKoreanManhwa: fields.filterKoreanManhwa.value,
  };

  const isLoading =
    fields.enabled.isLoading ||
    fields.useForMetadata.isLoading ||
    fields.clientId.isLoading ||
    fields.clientSecret.isLoading ||
    fields.accessToken.isLoading ||
    fields.useEnhancedProvider.isLoading ||
    fields.filterAdultContent.isLoading ||
    fields.filterWebtoons.isLoading ||
    fields.filterKoreanManhwa.isLoading;

  const saving = pickSavingKey(fields);

  const error =
    fields.enabled.error ??
    fields.useForMetadata.error ??
    fields.clientId.error ??
    fields.clientSecret.error ??
    fields.accessToken.error ??
    fields.useEnhancedProvider.error ??
    fields.filterAdultContent.error ??
    fields.filterWebtoons.error ??
    fields.filterKoreanManhwa.error;

  const updateSetting = useCallback(
    async <K extends keyof AnilistConfig>(key: K, value: AnilistConfig[K]): Promise<void> => {
      try {
        await Promise.all(buildCascade(fields, key, value));
        showSuccess('AniList setting updated successfully');
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        showError(`Failed to update setting: ${message}`);
        throw err;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fields is a fresh object each render; depending on its members covers updates
    Object.values(fields),
  );

  const updateConfig = useCallback(
    async (partial: Partial<AnilistConfig>): Promise<void> => {
      try {
        await Promise.all(buildBulkWrites(fields, partial));
        showSuccess('AniList configuration updated successfully');
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        showError(`Failed to update configuration: ${message}`);
        throw err;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    Object.values(fields),
  );

  const refresh = useCallback(
    async (): Promise<void> => {
      await Promise.all([
        fields.enabled.refetch(),
        fields.useForMetadata.refetch(),
        fields.clientId.refetch(),
        fields.clientSecret.refetch(),
        fields.accessToken.refetch(),
        fields.useEnhancedProvider.refetch(),
        fields.filterAdultContent.refetch(),
        fields.filterWebtoons.refetch(),
        fields.filterKoreanManhwa.refetch(),
      ]);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    Object.values(fields),
  );

  return { config, isLoading, saving, error, updateSetting, updateConfig, refresh };
}
