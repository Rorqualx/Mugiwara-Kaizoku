/**
 * GetComics adapter — iter-GC.
 *
 * Emits one pack-granularity `ReleaseCandidate` per getcomics.org search
 * hit. Coverage is left empty (`chapters: []`) — the dispatcher treats
 * unparseable packs as "covers the full in-scope chapter set", matching
 * the convention used for Prowlarr packs whose titles the coverage
 * parser couldn't decode (see `dispatch.ts:474-479`).
 *
 * The downstream `getcomics-handler.ts` takes `payload.detailPageUrl`,
 * resolves the DDL links (MediaFire, MEGA, etc.) via
 * `GetComicsService.getDownloadLinks`, and surfaces them on the job for
 * the user to complete manually through the jobs-page import flow
 * (commit `2a144536d`). Auto-downloading the file hosts is out of scope
 * for this iter.
 *
 * Gating: this adapter is only invoked when the target manga has
 * `mediaType === 'COMICBOOK'` (see `phase-indexer-search.ts`). Calling
 * it for a manga row would surface noise hits (getcomics.org regularly
 * returns "did you mean" results that look plausible).
 */

import { JobType } from '@prisma/client';

import { getGetComicsService } from '@/server/services/getcomics';
import { isError, isSuccess } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import type { ReleaseCandidate } from '../types';

const log = logger.child('GetComicsAdapter');

/** Cap hits per query so a noisy search doesn't flood the dispatcher's candidate pool. */
const MAX_HITS = 8;

export interface GetComicsCandidatePayload {
  /** getcomics.org detail page URL — handler fetches DDL links from here. */
  detailPageUrl: string;
  /** Site-internal slug, useful for blocklist dedup. */
  slug: string;
  /** Raw search-result title (used as releaseTitle on the job). */
  title: string;
  /** Optional metadata surfaced for the UI / scoring. */
  year?: string;
  format?: string;
  size?: string;
}

/**
 * Score search hits by listing position. The site puts most-recent /
 * most-relevant results first, so position is a usable signal without
 * needing to parse year / file-size / etc. Higher = better.
 */
function scoreForPosition(idx: number): number {
  return Math.max(1, MAX_HITS - idx);
}

export async function searchGetComics(title: string): Promise<ReleaseCandidate[]> {
  const service = getGetComicsService();
  const result = await service.searchComics(title);
  if (!isSuccess(result)) {
    const msg = isError(result) ? result.error.message : 'idle/loading';
    log.warn('GetComics search failed', { title, error: msg });
    return [];
  }

  const hits = result.data.slice(0, MAX_HITS);
  if (hits.length === 0) {
    log.debug('GetComics search returned no hits', { title });
    return [];
  }

  return hits.map((hit, idx): ReleaseCandidate => {
    const payload: GetComicsCandidatePayload = {
      detailPageUrl: hit.url,
      slug: hit.id,
      title: hit.title,
      ...(hit.year !== undefined ? { year: hit.year } : {}),
      ...(hit.format !== undefined ? { format: hit.format } : {}),
      ...(hit.size !== undefined ? { size: hit.size } : {}),
    };
    return {
      source: 'getcomics',
      granularity: 'pack',
      coverage: { chapters: [] },
      score: scoreForPosition(idx),
      label: `GetComics: ${hit.title}${hit.year !== undefined ? ` (${hit.year})` : ''}`,
      payload,
      enqueueJobType: JobType.getcomics_download,
    };
  });
}
