/**
 * Phase 4.6 helpers — Fandom URL resolution + volume field fill.
 * Extracted from pipeline-orchestrator.ts to keep that orchestrator's
 * complexity under the 20 limit.
 */

import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';

/**
 * Read the cached Fandom URL from Metadata.urls[].
 * Used when Phase 1's fandomResult is null.
 */
async function loadCachedFandomUrl(mangaId: number): Promise<string | null> {
  const metadata = await prisma.metadata.findFirst({
    where: { Manga: { id: mangaId } },
    select: { urls: true },
  });
  const fandomUrl = metadata?.urls.find(u => u.includes('.fandom.com'));
  return fandomUrl ?? null;
}

/**
 * Resolve the Fandom URL by trying Phase 1's result first, then the cached URL,
 * then a fresh wiki-discovery run as a last resort.
 */
export async function resolveFandomUrl(
  mangaId: number,
  title: string,
  fandomResultUrl: string | undefined,
): Promise<string | null> {
  let fandomUrl = fandomResultUrl ?? await loadCachedFandomUrl(mangaId);
  if (!fandomUrl) {
    const { discoverFandomWikiUrl } = await import('../wiki-discovery');
    fandomUrl = await discoverFandomWikiUrl(mangaId, title);
  }
  return fandomUrl;
}

/**
 * Run iterateVolumePages directly to harvest pageCount / ISBN / releaseDate
 * for wikis whose Phase 1 adaptiveParse returned before the merge fired.
 */
async function fetchVolumePageCountsDirect(
  fandomUrl: string,
  expectedVolumeCount: number,
): Promise<{ pageCount: Map<number, number>; isbn: Map<number, string>; releaseDate: Map<number, Date> }> {
  const pageCount = new Map<number, number>();
  const isbn = new Map<number, string>();
  const releaseDate = new Map<number, Date>();
  try {
    const domain = new URL(fandomUrl).hostname;
    const { iterateVolumePages } = await import('@/server/services/fandom/adaptive/per-volume-iterator');
    const knownCount = expectedVolumeCount > 0 ? expectedVolumeCount : undefined;
    const result = await iterateVolumePages(domain, knownCount, { timeoutMs: 10000 });
    if (!result.success) return { pageCount, isbn, releaseDate };
    for (const vol of result.volumes) {
      if (vol.pageCount !== undefined && vol.pageCount > 0) {
        pageCount.set(vol.volumeNumber, vol.pageCount);
      }
      if (vol.isbn) {
        isbn.set(vol.volumeNumber, vol.isbn);
      }
      if (vol.releaseDate) {
        const t = Date.parse(vol.releaseDate);
        if (!Number.isNaN(t)) releaseDate.set(vol.volumeNumber, new Date(t));
      }
    }
  } catch (err) {
    logger.debug(`[enrichmentPipeline] Phase 4.6 iterator fallback failed: ${err instanceof Error ? err.message : String(err)}`);
  }
  return { pageCount, isbn, releaseDate };
}

async function applyVolumePageCounts(mangaId: number, pageCountMap: Map<number, number>): Promise<void> {
  const existing = await prisma.volume.findMany({
    where: { mangaId, number: { in: [...pageCountMap.keys()] } },
    select: { id: true, number: true, pageCount: true },
  });

  let updated = 0;
  for (const vol of existing) {
    if (vol.pageCount !== null) continue;
    const pc = pageCountMap.get(vol.number);
    if (pc === undefined) continue;
    // eslint-disable-next-line no-await-in-loop -- per-volume sequential update
    await prisma.volume.update({ where: { id: vol.id }, data: { pageCount: pc } });
    updated++;
  }
  if (updated > 0) {
    logger.info(`[enrichmentPipeline] Filled Volume.pageCount on ${updated} volumes from Fandom for manga ${mangaId}`);
  }
}

async function applyVolumeIsbns(mangaId: number, isbnMap: Map<number, string>): Promise<void> {
  if (isbnMap.size === 0) return;
  const existing = await prisma.volume.findMany({
    where: { mangaId, number: { in: [...isbnMap.keys()] } },
    select: { id: true, number: true, isbn: true },
  });

  let updated = 0;
  for (const vol of existing) {
    if (vol.isbn) continue;
    const isbn = isbnMap.get(vol.number);
    if (!isbn) continue;
    // eslint-disable-next-line no-await-in-loop -- per-volume sequential update
    await prisma.volume.update({ where: { id: vol.id }, data: { isbn } });
    updated++;
  }
  if (updated > 0) {
    logger.info(`[enrichmentPipeline] Filled Volume.isbn on ${updated} volumes from Fandom for manga ${mangaId}`);
  }
}

async function applyVolumeReleaseDates(mangaId: number, dateMap: Map<number, Date>): Promise<void> {
  if (dateMap.size === 0) return;
  const existing = await prisma.volume.findMany({
    where: { mangaId, number: { in: [...dateMap.keys()] } },
    select: { id: true, number: true, releaseDate: true },
  });

  let updated = 0;
  for (const vol of existing) {
    if (vol.releaseDate) continue;
    const d = dateMap.get(vol.number);
    if (!d) continue;
    // eslint-disable-next-line no-await-in-loop -- per-volume sequential update
    await prisma.volume.update({ where: { id: vol.id }, data: { releaseDate: d } });
    updated++;
  }
  if (updated > 0) {
    logger.info(`[enrichmentPipeline] Filled Volume.releaseDate on ${updated} volumes from Fandom for manga ${mangaId}`);
  }
}

/**
 * Phase 4.6: fill Volume.pageCount / isbn / releaseDate on existing DB rows
 * where they are null. Falls back to a direct per-volume-iterator run when
 * the existing pageCountMap (from Phase 1) doesn't cover all expected volumes.
 */
export async function applyFandomVolumeFields(
  mangaId: number,
  fandomUrl: string | null,
  expectedVolumeCount: number,
  initialPageCountMap: Map<number, number>,
): Promise<void> {
  const pageCountMap = new Map(initialPageCountMap);
  const isbnMap = new Map<number, string>();
  const releaseDateMap = new Map<number, Date>();

  const needsDirect = fandomUrl
    && (expectedVolumeCount === 0 || pageCountMap.size < expectedVolumeCount);
  if (needsDirect && fandomUrl) {
    const directResult = await fetchVolumePageCountsDirect(fandomUrl, expectedVolumeCount);
    for (const [vol, pc] of directResult.pageCount) {
      if (!pageCountMap.has(vol)) pageCountMap.set(vol, pc);
    }
    for (const [vol, isbn] of directResult.isbn) isbnMap.set(vol, isbn);
    for (const [vol, rd] of directResult.releaseDate) releaseDateMap.set(vol, rd);
  }

  if (pageCountMap.size > 0) await applyVolumePageCounts(mangaId, pageCountMap);
  if (isbnMap.size > 0) await applyVolumeIsbns(mangaId, isbnMap);
  if (releaseDateMap.size > 0) await applyVolumeReleaseDates(mangaId, releaseDateMap);
}
