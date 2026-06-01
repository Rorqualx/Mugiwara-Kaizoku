/**
 * useCoverLayerManifest
 *
 * Fetches the living-cover layer manifest for a manga from
 * `/api/cover-layers/{id}/manifest.json`. Returns `null` until loaded, on any
 * error, or when no manifest exists (404) — callers (e.g. <LivingCover>) treat
 * `null` as "render the static cover", so this never blocks a cover from showing.
 */

import { useEffect, useState } from 'react';

import type { CoverLayerManifest } from '@/types/domain/cover-layers-types';

function isManifest(value: unknown): value is CoverLayerManifest {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const v = value as Record<string, unknown>;
  return typeof v['mode'] === 'string' && Array.isArray(v['layers']);
}

/**
 * @param mangaId - The manga whose layer manifest to load.
 * @returns The manifest, or `null` while loading / when unavailable.
 */
export function useCoverLayerManifest(mangaId: number | undefined): CoverLayerManifest | null {
  const [manifest, setManifest] = useState<CoverLayerManifest | null>(null);

  useEffect(() => {
    if (mangaId === undefined || mangaId <= 0) {
      setManifest(null);
      return undefined;
    }
    let active = true;
    setManifest(null);
    fetch(`/api/cover-layers/${mangaId}/manifest.json`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: unknown) => {
        if (active && isManifest(data)) {
          setManifest(data);
        }
      })
      .catch(() => {
        // No manifest / network error → stay on the static cover.
      });
    return () => {
      active = false;
    };
  }, [mangaId]);

  return manifest;
}
