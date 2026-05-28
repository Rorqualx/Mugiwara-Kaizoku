/**
 * AniList Provider Fetcher
 *
 * Fetches and enhances metadata from AniList API using ts-mangadex's AniListProvider.
 * Falls back to mutation-based fetching if ts-mangadex fails.
 *
 * @module provider-fetchers/anilist
 */

import { MetadataProvider } from '@prisma/client';
import { AniListProvider } from 'mangadex-ts-client';

import { adaptUnifiedMangaToMetadata } from '@/server/services/providers/adapters/ts-mangadex-adapter';
import { logger } from '@/utils/logger';
import { EnrichmentLevel } from '@/utils/metadata-cache';
import { isObject, hasProperty } from '@/utils/type-guards';




import { isMutation } from '../types';

import type { ProviderMutations } from '../types';

const ANILIST_PROPERTY_KEYS = [
  'format', 'status', 'genres', 'tags', 'themes', 'bannerImage',
  'characters', 'staff', 'recommendations', 'relations', 'trending',
  'externalLinks', 'countryOfOrigin', 'isAdult', 'siteUrl',
] as const;

/** Extract known AniList properties from a result object */
function extractAnilistProperties(result: Record<string, unknown>): Record<string, unknown> {
  const extracted: Record<string, unknown> = {};
  for (const key of ANILIST_PROPERTY_KEYS) {
    if (hasProperty(result, key)) {
      extracted[key] = result[key];
    }
  }
  return extracted;
}

/**
 * Fetch enhanced AniList data
 *
 * Uses ts-mangadex AniListProvider for direct API access.
 * Falls back to client mutation if provider fetch fails.
 */
export async function fetchAniListData(
  result: unknown,
  mutations: ProviderMutations | undefined
): Promise<{ enrichmentLevel: EnrichmentLevel; data: unknown }> {
  const resultObj = result as Record<string, unknown>;
  const anilistId = resultObj["id"] ?? resultObj["sourceId"];

  if (!anilistId) {
    return {
      enrichmentLevel: EnrichmentLevel.BASIC,
      data: result
    };
  }

  // Try ts-mangadex AniListProvider first
  try {
    const provider = new AniListProvider();
    const providerResult = await provider.getMetadata(String(anilistId));

    const metadata = adaptUnifiedMangaToMetadata(providerResult.manga, MetadataProvider.ANILIST);

      return {
        enrichmentLevel: EnrichmentLevel.FULL,
        data: {
          ...(result as Record<string, unknown>),
          ...metadata
        }
      };
  } catch (error: unknown) {
    logger.warn('ts-mangadex AniList fetch failed, trying mutation fallback', {
      anilistId,
      error: error instanceof Error ? error.message : String(error)
    });
  }

  // Fallback: use client-side mutation if available
  let enhancedResult = { ...(result as Record<string, unknown>) };
  let enrichmentLevel = EnrichmentLevel.BASIC;

  try {
    const anilistMutation = mutations?.fetchAnilistMutation;
    if (anilistMutation && isMutation(anilistMutation)) {
      const anilistResult: unknown = await anilistMutation.mutateAsync({
        id: String(anilistId)
      });

      if (isObject(anilistResult)) {
        enhancedResult = {
          ...enhancedResult,
          ...anilistResult,
          ...extractAnilistProperties(anilistResult),
        };

        enrichmentLevel = EnrichmentLevel.FULL;
      }
    }
  } catch (error: unknown) {
    logger.error('AniList enhancement failed:', error instanceof Error ? error.message : String(error));
  }

  return {
    enrichmentLevel,
    data: enhancedResult
  };
}
