/**
 * Whether a metadata provider is bound to a manga.
 *
 * @module hooks/manga/useMangaProviderCheck
 */

import React from 'react';

import type { MangaWithRelations } from '@/types/search.types';
import { isObject } from '@/utils/type-guards';

/**
 * Checks if an item in a provider metadata array matches a provider ID
 */
function isMatchingProviderItem(item: unknown, providerId: string): boolean {
  if (!isObject(item)) return false;
  const provider = item as Record<string, unknown>;
  return typeof provider['providerId'] === 'string' && provider['providerId'] === providerId;
}

/**
 * URL patterns for detecting legacy provider bindings via Metadata.urls
 */
const PROVIDER_URL_PATTERNS: Record<string, RegExp> = {
  anilist: /anilist\.co/,
  comicvine: /comicvine\.gamespot\.com/,
  fandom: /\.fandom\.com/,
  wikipedia: /wikipedia\.org/,
  mangadex: /mangadex\.org/
};

/**
 * Parse providerMetadata, handling both string (double-serialized) and object formats.
 */
function parseProviderMetadata(raw: unknown): unknown {
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return null;
    }
  }
  return raw;
}

/**
 * The section `unbindProvider` writes: `{ manual: true, providerId: null,
 * intent: 'unbound' }`. Client-side copy of the server's
 * `isManuallyUnboundFromMetadata` (server modules must stay out of the bundle).
 */
function isUnboundSentinel(section: unknown): boolean {
  if (!isObject(section)) return false;
  const entry = section as Record<string, unknown>;
  if (entry['manual'] !== true) return false;
  const pid = entry['providerId'];
  return entry['intent'] === 'unbound' || pid === null || pid === undefined || pid === '';
}

/**
 * Determines if a provider is bound to a manga by checking all data sources
 */
function checkProviderBound(manga: MangaWithRelations, providerId: string): boolean {
  // Check providerMetadata - handle both string and object formats
  if (manga.providerMetadata) {
    const parsed = parseProviderMetadata(manga.providerMetadata);
    if (Array.isArray(parsed)) {
      if (parsed.some((item: unknown) => isMatchingProviderItem(item, providerId))) return true;
    } else if (isObject(parsed) && providerId in (parsed as Record<string, unknown>)) {
      // An unbind leaves a sentinel section behind so enrichment does not
      // re-bind the provider; that is "not bound", and it settles the question
      // (a stale provider URL in Metadata.urls must not show it as bound again).
      return !isUnboundSentinel((parsed as Record<string, unknown>)[providerId]);
    }
  }

  // Legacy detection: check Metadata.urls for provider-specific URLs
  const urls = manga.Metadata?.urls;
  if (urls && Array.isArray(urls)) {
    const pattern = PROVIDER_URL_PATTERNS[providerId];
    if (pattern && urls.some((url: unknown) => typeof url === 'string' && pattern.test(url))) return true;
  }

  // Legacy AniList: check selectedSourceId for numeric AniList ID
  if (providerId === 'anilist' && manga.selectedSourceId && /^\d+$/.test(String(manga.selectedSourceId))) {
    return true;
  }

  return false;
}

/**
 * Hook for checking if metadata providers are bound to the manga
 *
 * @param manga - The manga entity with relations
 * @returns Object with isProviderBound function
 */
interface MangaProviderCheckReturn {
  isProviderBound: (providerId: string) => boolean;
}

export function useMangaProviderCheck(manga: MangaWithRelations | null): MangaProviderCheckReturn {
  return React.useMemo(() => ({
    isProviderBound: (providerId: string): boolean => {
      if (!manga) return false;
      return checkProviderBound(manga, providerId);
    }
  }), [manga]);
}
