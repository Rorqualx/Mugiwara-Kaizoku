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

const log = logger.child('PhaseProviderFetch:MAL');

/** MAL fetch result — normalized metadata from Jikan API */
export interface MALDirectResult {
  malId: number;
  title: string;
  chapters: number | null;
  volumes: number | null;
  status: string;
  score: number | null;
  genres: string[];
  isAdult: boolean;
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

  return {
    malId: result.malId,
    title: result.title,
    chapters: result.chapters,
    volumes: result.volumes,
    status: result.status,
    score: result.score,
    genres: result.genres,
    isAdult: result.isAdult,
  };
}

/**
 * Build metadata supplements from MAL data.
 * MAL fills gaps when AniList returns null for chapters/volumes/score.
 *
 * @param metadata - Current metadata from AniList
 * @param mal - MAL fetch result (may be null)
 * @returns Supplement fields to merge into metadata
 */
export function buildMALMetadataSupplements(
  metadata: Record<string, unknown>,
  mal: MALDirectResult | null,
): Record<string, unknown> {
  if (!mal) return {};

  const supplements: Record<string, unknown> = {};

  // Chapter count: MAL fills gap when AniList returns null (common for ongoing series)
  if (!metadata['chapters'] && mal.chapters !== null && mal.chapters > 0) {
    supplements['chapters'] = mal.chapters;
    log.debug('MAL: supplementing chapter count', { malId: mal.malId, chapters: mal.chapters });
  }

  // Volume count: MAL fills gap when AniList returns null
  if (!metadata['volumes'] && mal.volumes !== null && mal.volumes > 0) {
    supplements['volumes'] = mal.volumes;
    log.debug('MAL: supplementing volume count', { malId: mal.malId, volumes: mal.volumes });
  }

  // Score: MAL fills gap when AniList has no averageScore (convert MAL /10 → /100)
  if (!metadata['averageScore'] && mal.score !== null && mal.score > 0) {
    supplements['averageScore'] = Math.round(mal.score * 10);
    log.debug('MAL: supplementing score', { malId: mal.malId, malScore: mal.score });
  }

  return supplements;
}
