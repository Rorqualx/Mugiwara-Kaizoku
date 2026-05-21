/**
 * Prowlarr release-search adapter.
 *
 * Calls `ProwlarrMangaSearch.searchManga(title)` and maps each release to a
 * `pack`-granularity {@link ReleaseCandidate}. Coverage is parsed from the
 * release title via {@link parseReleaseCoverage}; when the title is opaque,
 * the candidate carries `coverage.chapters: []` and the dispatcher treats it
 * as "covers all missing" — Prowlarr packs without a parseable range are
 * usually whole-series/whole-volume mirrors.
 *
 * Score is derived from seeders for torrents, fixed for usenet (Prowlarr
 * doesn't expose grabs counts uniformly). Pre-existing pack-scoring lives
 * in `prowlarr-scoring.ts` and is invoked by the dispatcher when ranking
 * candidates within Prowlarr — this adapter doesn't apply it; the candidate
 * carries raw data so the dispatcher's ranker can do source-internal sorting.
 */
import { JobType } from '@prisma/client';

import { ProwlarrMangaSearch } from '@/server/services/prowlarr/mangaSearch';
import type { ProwlarrSearchResult } from '@/types/prowlarr';
import { isSuccess } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import { parseReleaseCoverage } from '../coverage-parser';
import { recordOpaqueRelease } from '../parse-failure-log';

import type { ReleaseCandidate } from '../types';

const log = logger.child('ProwlarrAdapter');

const prowlarrMangaSearch = new ProwlarrMangaSearch();

/**
 * Score a single release. Higher is better. Pure function — does not consult
 * `AutoDownloadRule` filters; that's the dispatcher's job. Today: seeders for
 * torrents, fixed mid-rank for usenet.
 */
function scoreRelease(release: ProwlarrSearchResult): number {
  if (release.protocol === 'usenet') {
    return 50; // mid-rank baseline; usenet age/grabs handled at dispatcher
  }
  const seeders = typeof release.seeders === 'number' ? release.seeders : 0;
  return seeders;
}

function toCandidate(release: ProwlarrSearchResult): ReleaseCandidate {
  const parsed = parseReleaseCoverage(release.title);
  return {
    source: 'prowlarr',
    granularity: 'pack',
    coverage: { chapters: parsed.chapters, volumes: parsed.volumes },
    score: scoreRelease(release),
    label: `[${release.indexerName}] ${release.title}`,
    payload: release,
    // Prowlarr candidates don't use the queue handler map directly — the
    // dispatcher (Task #25) special-cases this JobType and submits via the
    // existing DownloadManager Prowlarr path, which dispatches the
    // magnet/NZB to the configured external client (Transmission / SAB / etc).
    enqueueJobType: JobType.prowlarr_search,
  };
}

/** Pull releases from one settled Prowlarr search; log failures, never throw. */
function unwrapSettledSearch(
  title: string,
  variant: string,
  settled: PromiseSettledResult<Awaited<ReturnType<typeof prowlarrMangaSearch.searchManga>>>,
): ProwlarrSearchResult[] {
  if (settled.status !== 'fulfilled') {
    const errMsg = settled.reason instanceof Error ? settled.reason.message : String(settled.reason);
    log.warn('Prowlarr search rejected for variant', { title, variant, error: errMsg });
    return [];
  }
  if (!isSuccess(settled.value)) {
    const errorMessage = settled.value.status === 'error'
      ? settled.value.error.message
      : `status=${settled.value.status}`;
    log.warn('Prowlarr search failed for variant', { title, variant, error: errorMessage });
    return [];
  }
  return settled.value.data.results;
}

/** Append unique releases from a settled-search batch into the running pool. */
function mergeSettledIntoPool(
  title: string,
  queries: string[],
  settled: PromiseSettledResult<Awaited<ReturnType<typeof prowlarrMangaSearch.searchManga>>>[],
  pool: ProwlarrSearchResult[],
  seenGuids: Set<string>,
): void {
  for (let i = 0; i < settled.length; i++) {
    const sr = settled[i];
    if (sr === undefined) continue;
    const releases = unwrapSettledSearch(title, queries[i] ?? title, sr);
    for (const release of releases) {
      if (seenGuids.has(release.guid)) continue;
      seenGuids.add(release.guid);
      pool.push(release);
    }
  }
}

/**
 * Search Prowlarr for releases of `title` (and optional `altTitles` — romaji /
 * native / synonyms) and return them as `pack` candidates. Errors degrade to
 * `[]` — never throws, never blocks the orchestrator.
 *
 * Alt-title fan-out (iter-1 of fifty-loop): each title is searched via
 * `prowlarrMangaSearch.searchManga` (60s TTL cache).
 *
 * Primary-sufficiency gate (iter-2): the primary title is queried first;
 * alt-titles only fan out when the primary returns FEWER than
 * `PRIMARY_SUFFICIENT_COUNT` releases. This avoids the iter-1 dilution
 * where titles like Re:ZERO + Knights of the Zodiac (abundant primary
 * results) had alt-title hits like `Saint Seiya` flood the candidate
 * pool and re-rank the dispatcher's pick worse. Sparse-primary titles
 * (Skip Beat!, Akane-banashi) still get the alt fan-out and keep the
 * iter-1 wins.
 */
const PRIMARY_SUFFICIENT_COUNT = 5;

export async function searchProwlarr(
  title: string,
  altTitles: string[] = [],
  mangaId?: number,
): Promise<ReleaseCandidate[]> {
  const primaryQuery = title.trim();
  if (primaryQuery.length === 0) return [];
  const altQueries = Array.from(new Set(altTitles.map((q) => q.trim()).filter((q) => q.length > 0 && q !== primaryQuery)));
  try {
    const seenGuids = new Set<string>();
    const allReleases: ProwlarrSearchResult[] = [];

    // Phase 1: primary query.
    const primarySettled = await Promise.allSettled([prowlarrMangaSearch.searchManga(primaryQuery)]);
    mergeSettledIntoPool(title, [primaryQuery], primarySettled, allReleases, seenGuids);
    const primaryHits = allReleases.length;

    // Phase 2: fan out to alt-titles ONLY when primary was sparse.
    const altsRan = primaryHits < PRIMARY_SUFFICIENT_COUNT && altQueries.length > 0;
    if (altsRan) {
      const altSettled = await Promise.allSettled(altQueries.map((q) => prowlarrMangaSearch.searchManga(q)));
      mergeSettledIntoPool(title, altQueries, altSettled, allReleases, seenGuids);
    }

    if (allReleases.length === 0) {
      log.info('Prowlarr: no releases', { title, primaryHits: 0, altsRan, altCount: altQueries.length });
      return [];
    }
    const candidates = allReleases.map(toCandidate);
    if (mangaId !== undefined) {
      // iter-A0 audit side-channel: capture opaque-coverage releases so the
      // harness can persist them as a regression corpus for parser hardening.
      // Production callers don't pass mangaId, so this is a noop in prod.
      for (const c of candidates) {
        if (c.coverage.chapters.length === 0 && (c.coverage.volumes?.length ?? 0) === 0) {
          const r = c.payload as ProwlarrSearchResult;
          recordOpaqueRelease({
            mangaId,
            releaseTitle: r.title,
            score: c.score,
            indexerName: r.indexerName,
          });
        }
      }
    }
    log.info('Prowlarr: candidates built', {
      title,
      primaryHits,
      altsRan,
      altCount: altQueries.length,
      count: candidates.length,
    });
    return candidates;
  } catch (err) {
    log.warn('Prowlarr adapter threw', { title, error: err instanceof Error ? err.message : String(err) });
    return [];
  }
}
