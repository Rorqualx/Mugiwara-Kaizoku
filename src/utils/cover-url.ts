/**
 * Centralized cover URL resolver
 *
 * Resolves the best available cover image field from manga metadata
 * and routes it through the local image proxy for DB-backed caching.
 */

import { proxyImageUrl } from './image-proxy';

interface CoverMetadata {
  coverLarge?: string | null;
  coverExtraLarge?: string | null;
  cover?: string | null;
  coverMedium?: string | null;
  coverSmall?: string | null;
  coverUrl?: string | null;
}

const FALLBACK = '/cover-not-found.jpg';

/**
 * Returns the best available cover URL, routed through the image proxy.
 *
 * Priority: coverLarge > coverExtraLarge > cover > coverMedium > coverUrl
 * Falls back to local-cover extraction when mangaId is provided and no
 * metadata cover exists.
 *
 * @param metadata - Manga metadata object with cover fields
 * @param mangaId - Optional manga ID for local-cover fallback
 * @returns Proxied cover URL or fallback placeholder
 */
export function getCoverUrl(metadata: CoverMetadata | null | undefined, mangaId?: number): string {
  const raw =
    metadata?.coverLarge ??
    metadata?.coverExtraLarge ??
    metadata?.cover ??
    metadata?.coverMedium ??
    metadata?.coverUrl ??
    null;

  if (!raw || raw === FALLBACK) {
    if (mangaId !== undefined) return `/api/local-cover/${mangaId}`;
    return FALLBACK;
  }
  return proxyImageUrl(raw) ?? FALLBACK;
}
