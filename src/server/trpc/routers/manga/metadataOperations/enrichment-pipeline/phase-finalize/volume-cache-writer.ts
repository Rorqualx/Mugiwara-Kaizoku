/**
 * iter-PVM-1.5: cache per-source per-volume-chapter signal in providerMetadata
 * so the iter-PVM harness (and any future debugging/audit tools) can read it
 * offline without re-fetching live APIs.
 *
 * Layout:
 *   providerMetadata.mangadex.volumeCache = {
 *     volumes: [{ volumeNumber, chapters: [1, 2, 3, 5.1, ...] }],
 *     cachedAt: ISO
 *   }
 *   providerMetadata.wikipedia.volumeCache = {
 *     volumes: [{ number, chapters: [...] }],
 *     cachedAt: ISO
 *   }
 *   providerMetadata.fandom.volumeCache = {
 *     volumes: [{ number, chapterStart, chapterEnd, chapters? }],
 *     cachedAt: ISO
 *   }
 *
 * Writer is merge-only: doesn't touch other providerMetadata sections.
 * Source data lives in `UnifiedProviderResults` already, this just persists
 * the slice needed for cross-source consensus measurement.
 */
import { prisma as defaultPrisma } from '@/server/db';
import { logger } from '@/utils/logger';

import type { UnifiedProviderResults } from '../types';

interface MangaDexVolumeCacheEntry {
  volumeNumber: number;
  chapters: number[];
}

interface WikipediaVolumeCacheEntry {
  number: number;
  chapters: number[];
}

interface FandomVolumeCacheEntry {
  number: number;
  chapterStart?: number;
  chapterEnd?: number;
  chapters?: number[];
}

function extractMangadexCache(result: UnifiedProviderResults): MangaDexVolumeCacheEntry[] {
  const volumes = result.mangadexAggregate?.volumes;
  if (!volumes || volumes.length === 0) return [];
  return volumes
    .filter(v => v.chapters.length > 0)
    .map(v => ({ volumeNumber: v.volumeNumber, chapters: v.chapters }));
}

function extractWikipediaCache(result: UnifiedProviderResults): WikipediaVolumeCacheEntry[] {
  const volumes = result.wikipediaResult?.data.volumeList;
  if (!volumes || volumes.length === 0) return [];
  const out: WikipediaVolumeCacheEntry[] = [];
  for (const vol of volumes) {
    const chs = vol.chapters
      .map(c => typeof c.number === 'number' ? c.number : parseFloat(String(c.number)))
      .filter((n): n is number => !isNaN(n) && n > 0)
      .sort((a, b) => a - b);
    if (chs.length > 0) out.push({ number: vol.number, chapters: chs });
  }
  return out;
}

function extractFandomCache(result: UnifiedProviderResults): FandomVolumeCacheEntry[] {
  const volumes = result.fandomResult?.volumeList;
  if (!volumes || volumes.length === 0) return [];
  const out: FandomVolumeCacheEntry[] = [];
  for (const vol of volumes) {
    if (typeof vol.number !== 'number') continue;
    const entry: FandomVolumeCacheEntry = { number: vol.number };
    if (typeof vol.chapterStart === 'number') entry.chapterStart = vol.chapterStart;
    if (typeof vol.chapterEnd === 'number') entry.chapterEnd = vol.chapterEnd;
    out.push(entry);
  }
  return out;
}

/**
 * Merge per-source volume caches into `Manga.providerMetadata.<source>.volumeCache`.
 * Each source's cache is rewritten in full on every call (no incremental merge —
 * a re-enrichment always carries the freshest signal).
 */
export async function cacheProviderVolumeData(
  mangaId: number,
  result: UnifiedProviderResults,
  prisma: typeof defaultPrisma = defaultPrisma,
): Promise<void> {
  try {
    const mdxVolumes = extractMangadexCache(result);
    const wpVolumes = extractWikipediaCache(result);
    const fandomVolumes = extractFandomCache(result);
    if (mdxVolumes.length === 0 && wpVolumes.length === 0 && fandomVolumes.length === 0) return;

    const cachedAt = new Date().toISOString();
    const manga = await prisma.manga.findUnique({
      where: { id: mangaId },
      select: { providerMetadata: true },
    });
    const pm = (manga?.providerMetadata as Record<string, Record<string, unknown>> | null) ?? {};

    const next = { ...pm };
    if (mdxVolumes.length > 0) {
      next['mangadex'] = { ...(next['mangadex'] ?? {}), volumeCache: { volumes: mdxVolumes, cachedAt } };
    }
    if (wpVolumes.length > 0) {
      next['wikipedia'] = { ...(next['wikipedia'] ?? {}), volumeCache: { volumes: wpVolumes, cachedAt } };
    }
    if (fandomVolumes.length > 0) {
      next['fandom'] = { ...(next['fandom'] ?? {}), volumeCache: { volumes: fandomVolumes, cachedAt } };
    }

    await prisma.manga.update({ where: { id: mangaId }, data: { providerMetadata: next as never } });
    logger.info(`[enrichmentPipeline] Cached volume signal for manga ${mangaId}: mdx=${mdxVolumes.length} wp=${wpVolumes.length} fandom=${fandomVolumes.length}`);
  } catch (err) {
    logger.warn(`[enrichmentPipeline] Volume signal cache write failed for manga ${mangaId} (non-critical)`, err);
  }
}
