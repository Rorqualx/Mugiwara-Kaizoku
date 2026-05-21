/**
 * Direct Volume-field fill from Wikipedia volumeList.
 *
 * Wikipedia's volume-list tables often carry ISBN, original/English release
 * dates, volume titles, and descriptions that drop out of the cross-validation
 * path whenever a volume row lacks a chapter range (common for short runs,
 * English editions, and volumes Wikipedia documents without per-chapter
 * links). This pass applies those fields to existing Volume rows by number,
 * filling only when the DB column is null.
 *
 * Baseline n=50 seed=42 showed Volume.isbn missing in 46/50 (8% coverage)
 * and Volume.releaseDate missing in 18/50 (64%). This pass targets the gap
 * without touching the cross-validation logic.
 */

import { prisma } from '@/server/db';
import { isPlaceholderVolumeTitle } from '@/server/parsers/extractors/table-extractor/volume-extractors';
import { logger } from '@/utils/logger';

import type { UnifiedProviderResults } from '../types';

export async function fillVolumeFieldsFromWikipedia(
  mangaId: number,
  providerResults: UnifiedProviderResults,
): Promise<void> {
  try {
    await applyWikipediaVolumeFills(mangaId, providerResults);

    // Metadata.idMal fallback: when AniList didn't provide idMal but MangaDex's
    // attributes.links.mal carries it, thread it into Metadata.idMal.
    await fillMetadataIdMalFromMangaDex(mangaId, providerResults);

    // Volume.pageCount fallback from MangaDex: sum per-chapter pages per volume
    // number. MD chapter list captures pages per chapter; summing gives an
    // estimate when no dedicated per-volume source exists (Wikipedia rare,
    // ComicVine API omits page_count on manga issues).
    await fillVolumePageCountFromMangaDex(mangaId, providerResults);

    // Volume.releaseDate reverse-cascade: when a Volume has no releaseDate but
    // its linked chapters do (Chapter.releaseDate from MD publishAt), use the
    // earliest chapter date as the volume's release date.
    await fillVolumeReleaseDateFromChapters(mangaId);

    // Volume 1 chapterStart=1 seed + last-volume chapterEnd=max-chapter seed.
    // fillEmptyVolumeRanges interpolates middle gaps but can't anchor without
    // boundary volumes. This adds both boundaries when safe (no overlaps).
    await seedBoundaryVolumeRanges(mangaId);

    // Volume.totalChapters from DB chapter count: covers volumes whose
    // chapterStart/End are unknown but have linked chapters via volumeId
    // (iter-13 single-vol fallback / iter-5 range backfill).
    await fillVolumeTotalChaptersFromDbCount(mangaId);

    // Chapter.pages fallback from Volume.pageCount ÷ totalChapters (average).
    // A rough estimate when MD provider list doesn't supply per-chapter pages —
    // better than null for completeness scoring and UI readership estimates.
    await fillChapterPagesFromVolumeAverage(mangaId);

    // Volume.pageCount reverse-fill from DB Chapter.pages sum. Runs AFTER
    // Chapter.pages fill passes, so we sum the completed chapter data. Only
    // fills when Volume.pageCount is null.
    await fillVolumePageCountFromChaptersDb(mangaId);

    // Metadata.bannerImage fallback: when AniList didn't supply a bannerImage
    // (AniList banner coverage ~40% in n=50 sample), fall back to coverLarge.
    // isRealCover accepts any non-default URL, so a portrait cover displayed
    // as a landscape banner background beats a null placeholder for the UI
    // and the completeness score.
    await fillBannerImageFromCoverLarge(mangaId);
  } catch (err) {
    logger.warn(`[enrichmentPipeline] Failed to fill volume fields from Wikipedia for manga ${mangaId} (non-critical)`, err);
  }
}

// eslint-disable-next-line complexity -- complexity 37: per-volume merge of 8 Wikipedia-derived fields (isbn, releaseDate, title, description, pageCount, chapterStart, chapterEnd, totalChapters) into existing DB rows, each with a "only fill if currently empty" guard plus a "wiki value is non-empty" guard. Refactor candidate (could drive from a field-config array).
async function applyWikipediaVolumeFills(
  mangaId: number,
  providerResults: UnifiedProviderResults,
): Promise<void> {
  const wikiVolumes = providerResults.wikipediaResult?.data.volumeList ?? [];
  if (wikiVolumes.length === 0) return;

  const dbVolumes = await prisma.volume.findMany({
    where: { mangaId },
    select: { id: true, number: true, isbn: true, releaseDate: true, title: true, description: true, pageCount: true, chapterStart: true, chapterEnd: true, totalChapters: true },
  });
  if (dbVolumes.length === 0) return;

  // Fill Volume.totalChapters where chapterStart/End are known but totalChapters is null.
  // Cross-validation's persistValidatedVolumeRanges sets totalChapters, but pre-existing
  // rows from earlier reconciliation paths can land with null.
  for (const v of dbVolumes) {
    if (v.totalChapters !== null) continue;
    if (v.chapterStart === null || v.chapterEnd === null) continue;
    const total = v.chapterEnd - v.chapterStart + 1;
    if (total <= 0) continue;
    // eslint-disable-next-line no-await-in-loop -- sequential update
    await prisma.volume.update({ where: { id: v.id }, data: { totalChapters: total } });
  }

  const byNumber = new Map(dbVolumes.map(v => [v.number, v]));
  let isbnFilled = 0;
  let dateFilled = 0;
  let titleFilled = 0;
  let descFilled = 0;
  let pagesFilled = 0;

  for (const wv of wikiVolumes) {
    const db = byNumber.get(wv.number);
    if (!db) continue;

    const updates: Record<string, unknown> = {};
    if (!db.isbn && (wv.isbn13 ?? wv.isbn)) {
      updates['isbn'] = wv.isbn13 ?? wv.isbn;
    }
    if (!db.releaseDate && (wv.originalReleaseDate ?? wv.englishReleaseDate)) {
      const parsed = parseDate(wv.originalReleaseDate ?? wv.englishReleaseDate);
      if (parsed) updates['releaseDate'] = parsed;
    }
    if (!db.title && wv.title && !isPlaceholderVolumeTitle(wv.title)) updates['title'] = wv.title;
    const desc = wv.description ?? wv.summary;
    if (!db.description && desc) updates['description'] = desc;
    if (db.pageCount === null && typeof wv.pages === 'number' && wv.pages > 0) {
      updates['pageCount'] = wv.pages;
    }

    if (Object.keys(updates).length === 0) continue;
    // eslint-disable-next-line no-await-in-loop -- per-volume sequential update
    await prisma.volume.update({ where: { id: db.id }, data: updates });
    if (updates['isbn']) isbnFilled++;
    if (updates['releaseDate']) dateFilled++;
    if (updates['title']) titleFilled++;
    if (updates['description']) descFilled++;
    if (updates['pageCount']) pagesFilled++;
  }

  const total = isbnFilled + dateFilled + titleFilled + descFilled + pagesFilled;
  if (total > 0) {
    logger.info(
      `[enrichmentPipeline] Wikipedia volume-fill for manga ${mangaId}: ` +
      `${isbnFilled} isbn, ${dateFilled} releaseDate, ${titleFilled} title, ${descFilled} description, ${pagesFilled} pageCount`,
    );
  }
}

async function fillVolumePageCountFromMangaDex(
  mangaId: number,
  providerResults: UnifiedProviderResults,
): Promise<void> {
  const mdChapters = providerResults.mangadexChapterList ?? [];
  if (mdChapters.length === 0) return;

  // Group chapter pages by MD-declared volume number
  const pagesByVolume = new Map<number, number>();
  let totalPagesAllChapters = 0;
  let pagedChapterCount = 0;
  for (const ch of mdChapters) {
    if (typeof ch.pages !== 'number' || ch.pages <= 0) continue;
    totalPagesAllChapters += ch.pages;
    pagedChapterCount++;
    if (ch.volume === undefined || ch.volume <= 0) continue;
    pagesByVolume.set(ch.volume, (pagesByVolume.get(ch.volume) ?? 0) + ch.pages);
  }

  const nullPageVolumes = await prisma.volume.findMany({
    where: { mangaId, pageCount: null },
    select: { id: true, number: true },
  });
  if (nullPageVolumes.length === 0) return;

  let filled = 0;

  // Primary path: MD marks chapters with volume numbers — match to DB Volume rows by number.
  if (pagesByVolume.size > 0) {
    for (const v of nullPageVolumes) {
      const pages = pagesByVolume.get(v.number);
      if (!pages || pages <= 0) continue;
      // eslint-disable-next-line no-await-in-loop -- per-volume sequential update
      await prisma.volume.update({ where: { id: v.id }, data: { pageCount: pages } });
      filled++;
    }
  }

  // Single-volume fallback: if the manga has exactly 1 Volume in DB (manhwa/webtoon
  // pattern) and MD chapters carry page counts without volume numbers, sum ALL
  // paged chapters into that sole volume. Mirrors iter-13's Chapter.volumeId
  // single-volume cascade for pageCount.
  const allVolumes = await prisma.volume.findMany({
    where: { mangaId },
    select: { id: true, pageCount: true },
  });
  if (allVolumes.length === 1 && pagedChapterCount > 0 && totalPagesAllChapters > 0) {
    const solo = allVolumes[0];
    if (solo?.pageCount === null) {
      await prisma.volume.update({ where: { id: solo.id }, data: { pageCount: totalPagesAllChapters } });
      filled++;
    }
  }

  if (filled > 0) {
    logger.info(`[enrichmentPipeline] Filled Volume.pageCount on ${filled} volumes from MangaDex page sums for manga ${mangaId}`);
  }
}

async function fillMetadataIdMalFromMangaDex(
  mangaId: number,
  providerResults: UnifiedProviderResults,
): Promise<void> {
  const enrichedData = providerResults.enrichmentResult.enrichedData as Record<string, unknown> | undefined;
  const mdExternalIds = enrichedData?.['manga']
    ? ((enrichedData['manga'] as Record<string, unknown>)['mangadexExternalIds'] as Record<string, string> | undefined)
    : undefined;
  const mdMalStr = mdExternalIds?.['mal'];
  if (!mdMalStr) return;
  const mdMal = parseInt(mdMalStr, 10);
  if (!Number.isFinite(mdMal) || mdMal <= 0) return;

  const existing = await prisma.metadata.findFirst({
    where: { Manga: { id: mangaId } },
    select: { id: true, idMal: true },
  });
  if (existing?.idMal !== null) return;

  await prisma.metadata.update({ where: { id: existing.id }, data: { idMal: mdMal } });
  logger.info(`[enrichmentPipeline] Filled Metadata.idMal=${mdMal} from MangaDex for manga ${mangaId}`);
}

function parseDate(s: string | undefined): Date | undefined {
  if (!s) return undefined;
  const t = Date.parse(s);
  return Number.isNaN(t) ? undefined : new Date(t);
}

export async function runBannerImageFallback(mangaId: number): Promise<void> {
  return fillBannerImageFromCoverLarge(mangaId);
}

async function fillVolumePageCountFromChaptersDb(mangaId: number): Promise<void> {
  const vols = await prisma.volume.findMany({
    where: { mangaId, pageCount: null },
    select: { id: true },
  });
  if (vols.length === 0) return;

  let filled = 0;
  for (const v of vols) {
    // eslint-disable-next-line no-await-in-loop -- per-volume sum aggregate
    const agg = await prisma.chapter.aggregate({
      where: { mangaId, volumeId: v.id, pages: { not: null, gt: 0 } },
      _sum: { pages: true },
    });
    const sum = agg._sum.pages;
    if (!sum || sum <= 0) continue;
    // eslint-disable-next-line no-await-in-loop -- per-volume update
    await prisma.volume.update({ where: { id: v.id }, data: { pageCount: sum } });
    filled++;
  }
  if (filled > 0) {
    logger.info(`[enrichmentPipeline] Filled Volume.pageCount on ${filled} volumes from Chapter.pages sum for manga ${mangaId}`);
  }
}

async function fillChapterPagesFromVolumeAverage(mangaId: number): Promise<void> {
  const vols = await prisma.volume.findMany({
    where: { mangaId, pageCount: { not: null, gt: 0 }, totalChapters: { not: null, gt: 0 } },
    select: { id: true, pageCount: true, totalChapters: true },
  });
  if (vols.length === 0) return;

  let filled = 0;
  for (const v of vols) {
    const pc = v.pageCount;
    const tc = v.totalChapters;
    if (pc === null || tc === null || tc <= 0) continue;
    const avg = Math.round(pc / tc);
    if (avg <= 0) continue;
    // eslint-disable-next-line no-await-in-loop -- per-volume update of linked chapters
    const r = await prisma.chapter.updateMany({
      where: { mangaId, volumeId: v.id, OR: [{ pages: null }, { pages: 0 }] },
      data: { pages: avg },
    });
    filled += r.count;
  }
  if (filled > 0) {
    logger.info(`[enrichmentPipeline] Filled Chapter.pages on ${filled} chapters from Volume average for manga ${mangaId}`);
  }
}

async function fillVolumeTotalChaptersFromDbCount(mangaId: number): Promise<void> {
  const nullTotalVols = await prisma.volume.findMany({
    where: { mangaId, totalChapters: null },
    select: { id: true },
  });
  if (nullTotalVols.length === 0) return;

  let filled = 0;
  for (const v of nullTotalVols) {
    // eslint-disable-next-line no-await-in-loop -- per-volume count
    const count = await prisma.chapter.count({
      where: { mangaId, volumeId: v.id, chapterNumber: { not: null } },
    });
    if (count <= 0) continue;
    // eslint-disable-next-line no-await-in-loop -- per-volume update
    await prisma.volume.update({ where: { id: v.id }, data: { totalChapters: count } });
    filled++;
  }
  if (filled > 0) {
    logger.info(`[enrichmentPipeline] Filled Volume.totalChapters on ${filled} volumes from DB chapter count for manga ${mangaId}`);
  }
}

async function seedBoundaryVolumeRanges(mangaId: number): Promise<void> {
  const volumes = await prisma.volume.findMany({
    where: { mangaId, number: { gt: 0 } },
    select: { id: true, number: true, chapterStart: true, chapterEnd: true },
    orderBy: { number: 'asc' },
  });
  if (volumes.length === 0) return;

  const first = volumes[0];
  const last = volumes[volumes.length - 1];
  let updated = 0;

  // Seed Volume 1: chapterStart=1 if null and no later volume already claims 1
  if (first?.number === 1 && first.chapterStart === null) {
    const overlap = volumes.find(v => v.number !== 1 && v.chapterStart !== null && v.chapterStart <= 1);
    if (!overlap) {
      await prisma.volume.update({ where: { id: first.id }, data: { chapterStart: 1 } });
      updated++;
    }
  }

  // Seed last volume: chapterEnd=max(chapterNumber) if null and >= chapterStart
  if (last?.chapterEnd === null) {
    const agg = await prisma.chapter.aggregate({
      where: { mangaId, chapterNumber: { not: null } },
      _max: { chapterNumber: true },
    });
    const max = agg._max.chapterNumber;
    if (max !== null) {
      const floor = Math.floor(max);
      const lastStart = last.chapterStart;
      if (lastStart === null || floor >= lastStart) {
        await prisma.volume.update({ where: { id: last.id }, data: { chapterEnd: floor } });
        updated++;
      }
    }
  }

  if (updated > 0) {
    logger.info(`[enrichmentPipeline] Seeded ${updated} boundary volume ranges for manga ${mangaId}`);
  }
}

async function fillBannerImageFromCoverLarge(mangaId: number): Promise<void> {
  const md = await prisma.metadata.findFirst({
    where: { Manga: { id: mangaId } },
    select: { id: true, bannerImage: true, coverLarge: true, coverExtraLarge: true, coverMedium: true, cover: true, galleryImages: true },
  });
  if (!md || md.bannerImage) return;
  // Fallback chain: coverExtraLarge → coverLarge → coverMedium → cover (non-default)
  // → galleryImages[0] → Volume[1].coverImage. Skip the placeholder default.
  const candidates = [md.coverExtraLarge, md.coverLarge, md.coverMedium, md.cover];
  let fallback = candidates.find((c): c is string => typeof c === 'string' && c.length > 0 && c !== '/cover-not-found.jpg');
  // Secondary fallback: first gallery image (scene art is often landscape-banner-like)
  if (!fallback && md.galleryImages.length > 0) {
    fallback = md.galleryImages[0];
  }
  // Ultimate fallback: the first Volume's coverImage (Volume.coverImage is ~96%
  // covered in the sample, so this catches titles where AniList had neither
  // cover variants nor banner nor gallery).
  if (!fallback) {
    const v1 = await prisma.volume.findFirst({
      where: { mangaId, coverImage: { not: null } },
      orderBy: { number: 'asc' },
      select: { coverImage: true },
    });
    if (v1?.coverImage) fallback = v1.coverImage;
  }
  if (!fallback) return;
  await prisma.metadata.update({ where: { id: md.id }, data: { bannerImage: fallback } });
  logger.info(`[enrichmentPipeline] Filled Metadata.bannerImage from cover/volume fallback for manga ${mangaId}`);
}

async function fillVolumeReleaseDateFromChapters(mangaId: number): Promise<void> {
  const volumes = await prisma.volume.findMany({
    where: { mangaId, releaseDate: null },
    select: { id: true },
  });
  if (volumes.length === 0) return;

  let filled = 0;
  for (const v of volumes) {
    // eslint-disable-next-line no-await-in-loop -- per-volume sequential aggregate
    const agg = await prisma.chapter.aggregate({
      where: { mangaId, volumeId: v.id, releaseDate: { not: null } },
      _min: { releaseDate: true },
    });
    const min = agg._min.releaseDate;
    if (!min) continue;
    // eslint-disable-next-line no-await-in-loop -- sequential update
    await prisma.volume.update({ where: { id: v.id }, data: { releaseDate: min } });
    filled++;
  }
  if (filled > 0) {
    logger.info(`[enrichmentPipeline] Filled Volume.releaseDate on ${filled} volumes from earliest-chapter-date for manga ${mangaId}`);
  }
}
