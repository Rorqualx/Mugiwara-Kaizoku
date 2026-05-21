/**
 * Composes the 7 per-provider config hooks into a single object indexed by
 * provider id. Used by the metadata-providers grid and the active-providers
 * badge so they can derive enabled state from per-provider config keys instead
 * of the deprecated `metadata` JSON blob.
 *
 * Each entry exposes `{ enabled, isLoading, setEnabled }` — a uniform shape
 * regardless of whether the underlying hook is the rich `useAnilistConfig` /
 * `useComicvineConfig` / `useMalConfig` or the lean `useProviderEnabled`.
 */

import { useMemo } from 'react';

import { useAnilistConfig } from './useAnilistConfig';
import { useComicvineConfig } from './useComicvineConfig';
import { useMalConfig } from './useMalConfig';
import { useProviderEnabled } from './useProviderEnabled';

export interface ProviderConfigEntry {
  enabled: boolean;
  isLoading: boolean;
  setEnabled: (value: boolean) => Promise<void>;
}

export type AllProviderConfigs = Record<string, ProviderConfigEntry>;

export function useAllProviderConfigs(): AllProviderConfigs {
  const anilist = useAnilistConfig();
  const comicvine = useComicvineConfig();
  const mal = useMalConfig();
  const mangadex = useProviderEnabled('mangadex', {
    defaultEnabled: true,
    displayName: 'MangaDex',
  });
  const fandom = useProviderEnabled('fandom', { defaultEnabled: true, displayName: 'Fandom' });
  const wikipedia = useProviderEnabled('wikipedia', { defaultEnabled: true, displayName: 'Wikipedia' });
  const mangaupdates = useProviderEnabled('mangaupdates', { defaultEnabled: true, displayName: 'MangaUpdates' });
  const kitsu = useProviderEnabled('kitsu', { defaultEnabled: false, displayName: 'Kitsu' });

  return useMemo<AllProviderConfigs>(() => ({
    anilist: {
      enabled: anilist.config.enabled,
      isLoading: anilist.isLoading,
      setEnabled: (value) => anilist.updateSetting('enabled', value),
    },
    comicvine: {
      enabled: comicvine.config.enabled,
      isLoading: comicvine.isLoading,
      setEnabled: (value) => comicvine.updateSetting('enabled', value),
    },
    mal: {
      enabled: mal.config.enabled,
      isLoading: mal.isLoading,
      setEnabled: (value) => mal.updateSetting('enabled', value),
    },
    mangadex: {
      enabled: mangadex.enabled,
      isLoading: mangadex.isLoading,
      setEnabled: mangadex.setEnabled,
    },
    fandom: {
      enabled: fandom.enabled,
      isLoading: fandom.isLoading,
      setEnabled: fandom.setEnabled,
    },
    wikipedia: {
      enabled: wikipedia.enabled,
      isLoading: wikipedia.isLoading,
      setEnabled: wikipedia.setEnabled,
    },
    mangaupdates: {
      enabled: mangaupdates.enabled,
      isLoading: mangaupdates.isLoading,
      setEnabled: mangaupdates.setEnabled,
    },
    kitsu: {
      enabled: kitsu.enabled,
      isLoading: kitsu.isLoading,
      setEnabled: kitsu.setEnabled,
    },
  }), [anilist, comicvine, mal, mangadex, fandom, wikipedia, mangaupdates, kitsu]);
}
