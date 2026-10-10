/**
 * MAL metadata supplements.
 *
 * Split from `mal-fetch.ts`, whose config-reader import pulls in the database
 * client: the selector claim builders and the offline accuracy harness need
 * this builder without a database.
 *
 * @module enrichment-pipeline/phase-provider-fetch/mal-supplements
 */

import { logger } from '@/utils/logger';

import type { MALDirectResult } from './mal-fetch';

const log = logger.child('PhaseProviderFetch:MAL');

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

  // Phase 1: rating JSON. MAL contributes value + scoredBy + rank when no
  // higher-priority source (AniList) already wrote it.
  if (!metadata['rating'] && mal.score !== null && mal.score > 0) {
    supplements['rating'] = {
      value: Math.round(mal.score * 10),
      scoredBy: mal.scoredBy !== null && mal.scoredBy > 0 ? mal.scoredBy : undefined,
      rank: mal.rank !== null && mal.rank > 0 ? mal.rank : undefined,
      source: 'mal' as const,
    };
  }

  return supplements;
}
