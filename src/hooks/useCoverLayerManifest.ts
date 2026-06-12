/**
 * useCoverLayerManifest
 *
 * Fetches the living-cover layer manifest for a manga from
 * `/api/cover-layers/{id}/manifest.json`. Returns `null` until loaded, on any
 * error, or when no manifest exists (404) — callers (e.g. <LivingCover>) treat
 * `null` as "render the static cover", so this never blocks a cover from showing.
 *
 * Results are cached at module level with a short TTL and in-flight dedup:
 * library cards unmount/remount as they scroll through the virtualized grid,
 * and without the cache every remount re-probed the manifest endpoint (most
 * of them 404s for manga without living covers) — tens of requests per
 * minute on an idle library page. Nulls are cached too, since "no living
 * cover" is the common case.
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

const MANIFEST_TTL_MS = 5 * 60 * 1000;
const manifestCache = new Map<number, { manifest: CoverLayerManifest | null; fetchedAt: number }>();
const inFlight = new Map<number, Promise<CoverLayerManifest | null>>();

function fetchManifest(mangaId: number): Promise<CoverLayerManifest | null> {
  const pending = inFlight.get(mangaId);
  if (pending) return pending;

  const request = fetch(`/api/cover-layers/${mangaId}/manifest.json`)
    .then((res) => (res.ok ? res.json() : null))
    .then((data: unknown) => (isManifest(data) ? data : null))
    // No manifest / network error → stay on the static cover.
    .catch(() => null)
    .then((manifest: CoverLayerManifest | null) => {
      manifestCache.set(mangaId, { manifest, fetchedAt: Date.now() });
      inFlight.delete(mangaId);
      return manifest;
    });
  inFlight.set(mangaId, request);
  return request;
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

    const cached = manifestCache.get(mangaId);
    if (cached && Date.now() - cached.fetchedAt < MANIFEST_TTL_MS) {
      setManifest(cached.manifest);
      return undefined;
    }

    let active = true;
    setManifest(null);
    void fetchManifest(mangaId).then((result) => {
      if (active) setManifest(result);
    });
    return () => {
      active = false;
    };
  }, [mangaId]);

  return manifest;
}
