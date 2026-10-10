/**
 * MAL Direct Fetch
 *
 * Fetches manga metadata from MyAnimeList via the Jikan API.
 * Only called when an idMal is available (from AniList or MangaDex links.mal).
 * Provides chapter/volume counts as secondary confirmation and gap-fill.
 *
 * @module enrichment-pipeline/phase-provider-fetch/mal-fetch
 */

import { jikanService } from '@/server/services/jikan';
import { getConfigBoolean } from '@/server/utils/configReader';
import { logger } from '@/utils/logger';

// Re-exported so existing importers keep one MAL entry point; the builder
// itself lives in a module that does not pull in the config reader.
export { buildMALMetadataSupplements } from './mal-supplements';

const log = logger.child('PhaseProviderFetch:MAL');

/** MAL fetch result — normalized metadata from Jikan API */
export interface MALDirectResult {
  malId: number;
  title: string;
  chapters: number | null;
  volumes: number | null;
  status: string;
  score: number | null;
  /** Phase 1: scored_by + rank surfaced for Metadata.rating JSON. */
  scoredBy: number | null;
  rank: number | null;
  genres: string[];
  isAdult: boolean;
  /**
   * Phase 5 Sprint #2: MAL recommendations (manga-to-manga). Resolved
   * downstream into MangaRecommendation rows with externalSource='mal'.
   */
  recommendations?: Array<{
    anilistId: number; // shared edge shape — carries malId here
    title: string;
    format: string | null;
    coverUrl: string | null;
    medium: 'MANGA' | 'ANIME' | 'NOVEL' | 'OTHER' | null;
    rating: number | null;
  }>;
}

/**
 * Fetch MAL metadata by MAL ID.
 *
 * When the `mal.filterAdultContent` setting is enabled, a match flagged by
 * MAL as hentai/erotica/adult is discarded (returns null) so its data
 * doesn't flow downstream. Mirrors AniList's filterAdultContent behavior.
 *
 * @param malId - MyAnimeList manga ID (from AniList idMal or MangaDex links.mal)
 * @returns Normalized MAL result or null on failure / when filtered
 */
export async function fetchMALDirect(malId: number): Promise<MALDirectResult | null> {
  const result = await jikanService.getMangaByMALId(malId);
  if (!result) {
    log.info('MAL: no data found', { malId });
    return null;
  }

  if (result.isAdult) {
    const filterAdult = await getConfigBoolean('mal.filterAdultContent', true);
    if (filterAdult) {
      log.info('MAL: filtered adult content', {
        malId, title: result.title, genres: result.genres,
      });
      return null;
    }
  }

  log.info('MAL: fetched metadata', {
    malId,
    title: result.title,
    chapters: result.chapters,
    volumes: result.volumes,
    status: result.status,
    isAdult: result.isAdult,
  });

  // Phase 5 Sprint #2: pull MAL recommendations alongside the metadata call.
  // Best-effort — failures here don't block the main metadata path.
  const recommendations = await jikanService.getMangaRecommendationsByMALId(malId);

  const out: MALDirectResult = {
    malId: result.malId,
    title: result.title,
    chapters: result.chapters,
    volumes: result.volumes,
    status: result.status,
    score: result.score,
    scoredBy: result.scoredBy,
    rank: result.rank,
    genres: result.genres,
    isAdult: result.isAdult,
  };
  if (recommendations.length > 0) out.recommendations = recommendations;
  return out;
}
