/**
 * Provider Configuration Hook
 *
 * Reads/writes per-provider config keys via `useConfigValue`, so the
 * React-Query cache for each key is shared across every consumer on the
 * page. Public API ({ config, isLoading, saving, error,
 * updateProviderSetting, setDefaultProvider, updateConfig,
 * getProvidersByPriority, getEnabledProviders, refresh }) is unchanged.
 *
 * Known provider list is fixed at module load (anilist, fandom, comicvine,
 * prowlarr); registering a new provider at runtime requires a page reload
 * — acceptable since provider registration is admin-only and infrequent.
 *
 * The `description` field on each provider is metadata baked into
 * `defaultProvidersConfig` and is never read back from the server, so
 * `updateProviderSetting(_, 'description', _)` is a no-op (matches original
 * effective behavior, which wrote to a key that loadProviderConfig never
 * read).
 */

import React, { useCallback, useMemo } from 'react';

import { notifications } from '@mantine/notifications';
import { IconCheck, IconAlertCircle } from '@tabler/icons-react';

import { useConfigValue, type UseConfigValueResult } from './useConfigValue';

export interface ProviderConfig {
  enabled: boolean;
  strength: number;
  priority: number;
  description: string;
}

export interface ProvidersConfig {
  defaultProvider: string;
  providers: Record<string, ProviderConfig>;
}

export interface UseProviderConfigResult {
  config: ProvidersConfig;
  isLoading: boolean;
  saving: boolean;
  error: string | null;
  updateProviderSetting: <K extends keyof ProviderConfig>(
    providerName: string,
    key: K,
    value: ProviderConfig[K],
  ) => Promise<void>;
  setDefaultProvider: (providerName: string) => Promise<void>;
  updateConfig: (config: Partial<ProvidersConfig>) => Promise<void>;
  getProvidersByPriority: () => string[];
  getEnabledProviders: () => string[];
  refresh: () => Promise<void>;
}

const defaultProvidersConfig: ProvidersConfig = {
  defaultProvider: 'anilist',
  providers: {
    anilist: {
      enabled: true,
      strength: 90,
      priority: 1,
      description: 'Official AniList API for manga metadata',
    },
    fandom: {
      enabled: true,
      strength: 70,
      priority: 2,
      description: 'Fandom wikis for supplemental manga information',
    },
    comicvine: {
      enabled: true,
      strength: 60,
      priority: 3,
      description: 'ComicVine API for Western comics metadata',
    },
    prowlarr: {
      enabled: false,
      strength: 50,
      priority: 4,
      description: 'Prowlarr for torrent and usenet indexers',
    },
  },
};

interface ProviderFields {
  enabled: UseConfigValueResult<boolean>;
  strength: UseConfigValueResult<number>;
  priority: UseConfigValueResult<number>;
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

function buildProviderConfig(
  providerName: string,
  fields: ProviderFields,
): ProviderConfig {
  const defaults = defaultProvidersConfig.providers[providerName];
  return {
    enabled: fields.enabled.value,
    strength: fields.strength.value,
    priority: fields.priority.value,
    description: defaults?.description ?? '',
  };
}

function buildProviderWrites(
  fields: ProviderFields,
  partial: Partial<ProviderConfig>,
): Promise<void>[] {
  const writes: Promise<void>[] = [];
  if (partial.enabled !== undefined) writes.push(fields.enabled.setValue(partial.enabled));
  if (partial.strength !== undefined) writes.push(fields.strength.setValue(partial.strength));
  if (partial.priority !== undefined) writes.push(fields.priority.setValue(partial.priority));
  return writes;
}

function collectAllProviderWrites(
  fieldsByProvider: Record<string, ProviderFields>,
  providers: Record<string, ProviderConfig>,
): Promise<void>[] {
  // Cast to Partial — callers pass per-field updates, not full ProviderConfigs.
  const entries = Object.entries(providers) as [string, Partial<ProviderConfig>][];
  return entries.flatMap(([name, providerPartial]) => {
    const fields = fieldsByProvider[name];
    return fields ? buildProviderWrites(fields, providerPartial) : [];
  });
}

interface ProviderFieldDefaults {
  enabled: boolean;
  strength: number;
  priority: number;
}

/**
 * Subscribe to one provider's three writable config keys.
 *
 * Hooks Rules: this helper always calls `useConfigValue` three times in a
 * fixed order (`enabled` → `strength` → `priority`), so as long as the
 * caller invokes `useProviderFields` once per provider in a stable order,
 * the overall hook-call sequence is identical to inlining the 12 longhand
 * `useConfigValue` calls. The behavior baseline test in
 * `__tests__/useProviderConfig.test.ts` asserts the exact key ordering.
 */
function useProviderFields(name: string, defaults: ProviderFieldDefaults): ProviderFields {
  const enabled = useConfigValue<boolean>(`providers.${name}.enabled`, defaults.enabled);
  const strength = useConfigValue<number>(`providers.${name}.strength`, defaults.strength);
  const priority = useConfigValue<number>(`providers.${name}.priority`, defaults.priority);
  return useMemo(
    () => ({ enabled, strength, priority }),
    [enabled, strength, priority],
  );
}

function aggregateLoading(
  defaultProvider: UseConfigValueResult<string>,
  fieldGroups: ProviderFields[],
): boolean {
  if (defaultProvider.isLoading) return true;
  return fieldGroups.some(f => f.enabled.isLoading || f.strength.isLoading || f.priority.isLoading);
}

function aggregateSaving(
  defaultProvider: UseConfigValueResult<string>,
  fieldGroups: ProviderFields[],
): boolean {
  if (defaultProvider.saving) return true;
  return fieldGroups.some(f => f.enabled.saving || f.strength.saving || f.priority.saving);
}

function aggregateError(
  defaultProvider: UseConfigValueResult<string>,
  fieldGroups: ProviderFields[],
): Error | null {
  if (defaultProvider.error) return defaultProvider.error;
  for (const f of fieldGroups) {
    const err = f.enabled.error ?? f.strength.error ?? f.priority.error;
    if (err) return err;
  }
  return null;
}

export function useProviderConfig(): UseProviderConfigResult {
  // Default provider key
  const defaultProvider = useConfigValue<string>(
    'providers.defaultProvider',
    defaultProvidersConfig.defaultProvider,
  );

  // Per-provider × field keys. The fixed call order
  // (anilist → fandom → comicvine → prowlarr, each calling enabled →
  // strength → priority internally) is locked in by the behavior baseline
  // test; do not reorder without updating the test.
  const anilist = useProviderFields('anilist', { enabled: true, strength: 90, priority: 1 });
  const fandom = useProviderFields('fandom', { enabled: true, strength: 70, priority: 2 });
  const comicvine = useProviderFields('comicvine', { enabled: true, strength: 60, priority: 3 });
  const prowlarr = useProviderFields('prowlarr', { enabled: false, strength: 50, priority: 4 });

  const fieldsByProvider: Record<string, ProviderFields> = useMemo(
    () => ({ anilist, fandom, comicvine, prowlarr }),
    [anilist, fandom, comicvine, prowlarr],
  );

  const config: ProvidersConfig = useMemo(
    () => ({
      defaultProvider: defaultProvider.value,
      providers: {
        anilist: buildProviderConfig('anilist', anilist),
        fandom: buildProviderConfig('fandom', fandom),
        comicvine: buildProviderConfig('comicvine', comicvine),
        prowlarr: buildProviderConfig('prowlarr', prowlarr),
      },
    }),
    [defaultProvider.value, anilist, fandom, comicvine, prowlarr],
  );

  const fieldGroups = [anilist, fandom, comicvine, prowlarr];
  const isLoading = aggregateLoading(defaultProvider, fieldGroups);
  const saving = aggregateSaving(defaultProvider, fieldGroups);
  const errorObj = aggregateError(defaultProvider, fieldGroups);
  const error = errorObj ? errorObj.message : null;

  const updateProviderSetting = useCallback(
    async <K extends keyof ProviderConfig>(
      providerName: string,
      key: K,
      value: ProviderConfig[K],
    ): Promise<void> => {
      const fields = fieldsByProvider[providerName];
      if (!fields) {
        const message = `Provider ${providerName} does not exist`;
        showError(message);
        throw new Error(message);
      }
      try {
        if (key === 'enabled') {
          await fields.enabled.setValue(value as boolean);
        } else if (key === 'strength') {
          await fields.strength.setValue(value as number);
        } else if (key === 'priority') {
          await fields.priority.setValue(value as number);
        }
        // 'description' is read from defaults, never written — see hook's top-doc.
        showSuccess(`Provider setting "${providerName}.${key}" updated successfully`);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        showError(`Failed to update provider setting: ${message}`);
        throw err;
      }
    },
    [fieldsByProvider],
  );

  const setDefaultProvider = useCallback(
    async (providerName: string): Promise<void> => {
      if (!fieldsByProvider[providerName]) {
        const message = `Provider ${providerName} does not exist`;
        showError(message);
        throw new Error(message);
      }
      try {
        await defaultProvider.setValue(providerName);
        showSuccess(`Default provider set to ${providerName}`);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        showError(`Failed to set default provider: ${message}`);
        throw err;
      }
    },
    [defaultProvider, fieldsByProvider],
  );

  const updateConfig = useCallback(
    async (partial: Partial<ProvidersConfig>): Promise<void> => {
      try {
        const writes: Promise<void>[] = [];
        if (partial.defaultProvider !== undefined) {
          writes.push(defaultProvider.setValue(partial.defaultProvider));
        }
        if (partial.providers) {
          writes.push(...collectAllProviderWrites(fieldsByProvider, partial.providers));
        }
        await Promise.all(writes);
        showSuccess('Provider configuration updated successfully');
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        showError(`Failed to update provider configuration: ${message}`);
        throw err;
      }
    },
    [defaultProvider, fieldsByProvider],
  );

  const getProvidersByPriority = useCallback(
    (): string[] =>
      Object.entries(config.providers)
        .sort(([, a], [, b]) => a.priority - b.priority)
        .map(([name]) => name),
    [config.providers],
  );

  const getEnabledProviders = useCallback(
    (): string[] =>
      Object.entries(config.providers)
        .filter(([, c]) => c.enabled)
        .map(([name]) => name),
    [config.providers],
  );

  const refresh = useCallback(
    async (): Promise<void> => {
      await Promise.all([
        defaultProvider.refetch(),
        anilist.enabled.refetch(),
        anilist.strength.refetch(),
        anilist.priority.refetch(),
        fandom.enabled.refetch(),
        fandom.strength.refetch(),
        fandom.priority.refetch(),
        comicvine.enabled.refetch(),
        comicvine.strength.refetch(),
        comicvine.priority.refetch(),
        prowlarr.enabled.refetch(),
        prowlarr.strength.refetch(),
        prowlarr.priority.refetch(),
      ]);
    },
    [defaultProvider, anilist, fandom, comicvine, prowlarr],
  );

  return {
    config,
    isLoading,
    saving,
    error,
    updateProviderSetting,
    setDefaultProvider,
    updateConfig,
    getProvidersByPriority,
    getEnabledProviders,
    refresh,
  };
}
