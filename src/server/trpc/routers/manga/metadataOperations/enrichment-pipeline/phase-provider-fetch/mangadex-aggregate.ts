/**
 * MangaDex Aggregate Fetcher
 *
 * Fetches and parses the MangaDex aggregate endpoint to get
 * definitive volume→chapter mappings for cross-validation.
 *
 * @module phase-provider-fetch/mangadex-aggregate
 */

import type { KaizokuMangaDexClient } from '@/server/services/mangadex/ts-client-factory';
import { logger } from '@/utils/logger';

const log = logger.child('MangaDexAggregate');

/** Parsed volume from MangaDex aggregate endpoint */
export interface MangaDexAggregateVolume {
  volumeNumber: number;
  chapterStart: number;
  chapterEnd: number;
  chapterCount: number;
  /**
   * iter-PVM-1: per-chapter list (integers + decimals like 5.1) preserved
   * from the aggregate keys. Feeds the membership-consensus resolver.
   */
  chapters: number[];
}

/** Full aggregate result */
export interface MangaDexAggregateResult {
  mangaId: string;
  volumes: MangaDexAggregateVolume[];
}

/** Parse a single volume entry from the aggregate response */
function parseVolumeEntry(
  volKey: string,
  chapters: Record<string, unknown>,
): MangaDexAggregateVolume | null {
  const volNum = parseFloat(volKey);
  if (isNaN(volNum) || volNum <= 0) return null;

  const chapterNums = Object.keys(chapters)
    .map(parseFloat)
    .filter(n => !isNaN(n) && n > 0)
    .sort((a, b) => a - b);

  const first = chapterNums[0];
  const last = chapterNums[chapterNums.length - 1];
  if (first === undefined || last === undefined) return null;

  return {
    volumeNumber: volNum,
    chapterStart: first,
    chapterEnd: last,
    chapterCount: chapterNums.length,
    chapters: chapterNums,
  };
}

/**
 * Fetch and parse aggregate volume→chapter data from MangaDex.
 *
 * @param client - MangaDex client instance
 * @param mangaId - MangaDex manga UUID
 * @returns Aggregate result or null if unavailable
 */
export async function fetchMangaDexAggregate(
  client: KaizokuMangaDexClient,
  mangaId: string,
): Promise<MangaDexAggregateResult | null> {
  try {
    // Metadata-side aggregate: pull volume groupings across ALL languages, not
    // just English. The aggregate is what drives Volume.chapterStart/chapterEnd
    // for downstream chapter linkage; restricting to EN drops Vols 2-5/7-8 for
    // any series whose English translation is incomplete (Iken Senki Volundio:
    // 21 EN chapters in 4 vols vs 95 chapters in 11 vols across all langs).
    // The download side has its own preferredLanguage setting and isn't
    // affected by this fetcher.
    const response = await client.getMangaAggregate(mangaId, []);

    const volumes: MangaDexAggregateVolume[] = [];
    for (const [volKey, volData] of Object.entries(response.volumes)) {
      const parsed = parseVolumeEntry(volKey, volData.chapters);
      if (parsed) volumes.push(parsed);
    }

    if (volumes.length === 0) return null;

    volumes.sort((a, b) => a.volumeNumber - b.volumeNumber);
    log.info('Fetched aggregate', {
      mangaId,
      volumeCount: volumes.length,
      totalChapters: volumes.reduce((sum, v) => sum + v.chapterCount, 0),
    });

    return { mangaId, volumes };
  } catch (err: unknown) {
    log.debug('Aggregate fetch failed (non-critical)', {
      mangaId,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
