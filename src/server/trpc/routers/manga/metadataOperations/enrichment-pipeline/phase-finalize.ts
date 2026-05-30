// @file-size-justified: orchestrator over 14+ sub-fillers in phase-finalize/.
/**
 * Phase 4: Finalize
 *
 * Stores volume data for frontend display in providerMetadata,
 * persists discovered provider bindings, invalidates server-side
 * cache, and emits WebSocket events.
 */


import { prisma } from '@/server/db';
import { includeMangaRelations, type MangaWithRelations } from '@/server/trpc/routers/manga/shared';
import { generateProxyUrl } from '@/server/trpc/routers/metadata/fandom-chapter/url-processing';
import { logger } from '@/utils/logger';

import { assignSpecialChapters } from './fandom-db-persistence';
import { reapplyManualManifestToDb } from './manual-volume-manifest-sentinel';
import { backfillMetadataChaptersFromChapterRows } from './phase-finalize/chapter-count-backfill';
import { fillChapterCoverFromVolume } from './phase-finalize/chapter-cover-fill';
import { fillChapterPagesFromProviders } from './phase-finalize/chapter-pages-fill';
import { fillGenericChapterTitlesFromProviders } from './phase-finalize/chapter-title-fill';
import { appendComicVineGalleryImages } from './phase-finalize/gallery-from-comicvine';
import { unionVolumeChapterCoversIntoGallery } from './phase-finalize/gallery-union';
import { persistAniListRelationsForManga } from './phase-finalize/manga-relation-resolver';
import { syncMangaStatusFromMetadata } from './phase-finalize/manga-status-sync';
import { persistMergedSynonyms } from './phase-finalize/merged-synonyms';
import { cacheProviderVolumeData } from './phase-finalize/volume-cache-writer';
import { backfillMetadataVolumesFromVolumeRows } from './phase-finalize/volume-count-backfill';
import { backfillChapterVolumeIds } from './phase-finalize/volume-id-backfill';
import { fillVolumeFallbacksFromMetadata } from './phase-finalize/volume-metadata-fallback';
import { fillVolumeFieldsFromWikipedia, runBannerImageFallback } from './phase-finalize/volume-wikipedia-fill';
import { buildMangaDexExternalLinks } from './phase-provider-fetch/external-id-extractor';

import type { EnrichmentProgress, UnifiedProviderResults } from './types';
import type { Prisma } from '@prisma/client';

/**
 * Run Phase 4: store volume data, persist provider bindings, invalidate cache, return fresh manga.
 */
export async function phaseFinalize(
  mangaId: number,
  providerResults: UnifiedProviderResults,
  onProgress?: EnrichmentProgress,
): Promise<MangaWithRelations | null> {
  await onProgress?.('finalizing', 'Storing volume data...');

  await prunePhantomVolumes(mangaId, providerResults);
  await storeVolumeCoverData(mangaId, providerResults);
  await labelVolumeFileChapters(mangaId);
  await inheritParentSeriesMetadata(mangaId);
  await persistProviderBindings(mangaId, providerResults);
  await persistAniListRelationsForManga(mangaId, providerResults);
  await cacheProviderVolumeData(mangaId, providerResults);
  await persistExternalLinks(mangaId, providerResults);
  await persistMergedSynonyms(mangaId, providerResults);
  await aggregateChapterReleaseDates(mangaId);
  await inheritSeriesPublisherToVolumes(mangaId);
  await inheritVolumeReleaseDatesToChapters(mangaId);
  await fillGenericChapterTitlesFromProviders(mangaId, providerResults);
  await fillChapterPagesFromProviders(mangaId, providerResults);
  // Wikipedia volumeList carries isbn/releaseDate/title/description that get
  // dropped by cross-validation when volumes lack chapter ranges. Direct-fill
  // from the raw list before the series-level fallbacks fire.
  await fillVolumeFieldsFromWikipedia(mangaId, providerResults);
  await fillVolumeFallbacksFromMetadata(mangaId);
  await appendComicVineGalleryImages(mangaId, providerResults);
  // Always-run gallery: union volume + chapter covers into Metadata.galleryImages.
  // Runs regardless of which enrichment path fired, so titles with only CV
  // volume covers still populate the gallery.
  await unionVolumeChapterCoversIntoGallery(mangaId);
  // Re-run banner fallback AFTER gallery union so galleryImages[0] can
  // contribute for titles that only got their gallery populated by the
  // union pass (CV-only enrichment, etc.). First call in volume-wikipedia-fill
  // runs before gallery is filled; this second call catches the post-union state.
  await runBannerImageFallback(mangaId);
  // Re-run chapter inheritance AFTER filling volume defaults so chapters
  // linked to previously-null-description volumes now pick up the fallback.
  await inheritVolumeReleaseDatesToChapters(mangaId);
  // Reapply user-curated volume ranges (providerMetadata.manual.volumeManifest)
  // after every other volume-mutation phase. Clears FKs so backfill re-links.
  await reapplyManualManifestToDb(mangaId);
  await backfillChapterVolumeIds(mangaId);
  // Round 6 iter 60: fill Chapter.coverImage from the parent Volume's cover
  // when the chapter has none of its own. Runs after volume-id-backfill so
  // the chapter->volume linkage is in place.
  await fillChapterCoverFromVolume(mangaId);
  // Catch special chapters (Ch <= 0, decimals) orphaned by non-Fandom paths
  // like the adaptive bridge (0.1-0.4 JJK prequel chapters). Idempotent with
  // the earlier call inside applyEnrichmentData.
  const allChaptersForSpecials = await prisma.chapter.findMany({
    where: { mangaId, chapterNumber: { not: null } },
    select: { id: true, chapterNumber: true, volume: true, volumeId: true, filePath: true },
  });
  await assignSpecialChapters(mangaId, allChaptersForSpecials);
  // Final inheritance pass: chapters just linked by the range-based backfill
  // haven't picked up volume-level covers/descriptions/releaseDates yet.
  await inheritVolumeReleaseDatesToChapters(mangaId);
  // Backfill Metadata.volumes from Volume row count when AniList/Kitsu/etc.
  // didn't provide a number. Library survey showed 184/199 null-volume titles
  // already have populated Volume rows — this closes that gap on every
  // re-enrichment. Runs after prunePhantomVolumes (line 44) so the count
  // reflects post-pruning state, not wiki-overflow noise.
  await backfillMetadataVolumesFromVolumeRows(mangaId);
  // Same for Metadata.chapters: FLOOR(MAX(chapterNumber)) gives the latest
  // published chapter when no provider count is available. Slight overcount
  // risk on titles with fan-translated bonus chapters; matches AL exactly
  // for ~60% of spot-check titles, within ±2 for the rest.
  await backfillMetadataChaptersFromChapterRows(mangaId);
  // Lift Metadata.status onto Manga.publicationStatus and stamp lastChecked /
  // lastSyncAt so the UI status badge and "last enriched" filters reflect this run.
  await syncMangaStatusFromMetadata(mangaId);
  await preWarmCoverCache(mangaId);
  await invalidateCache(mangaId);
  await emitWebSocketUpdate(mangaId);

  const freshManga = await prisma.manga.findUnique({
    where: { id: mangaId },
    include: includeMangaRelations,
  });

  return freshManga as MangaWithRelations | null;
}

/**
 * Fill Chapter.releaseDate from the linked Volume.releaseDate when the chapter
 * has no date of its own. Fandom per-chapter pages rarely expose magazine
 * publication dates for these sample mangas, but Wikipedia / MangaDex often
 * know the tankobon release date. The volume release is a useful fallback for
 * "when this chapter was available to readers" — better than null for
 * timeline UIs and the completeness score.
 *
 * Fill-when-null only; never overrides an explicit per-chapter date.
 */
async function inheritVolumeReleaseDatesToChapters(mangaId: number): Promise<void> {
  try {
    const volumes = await prisma.volume.findMany({
      where: { mangaId },
      select: { id: true, releaseDate: true, coverImage: true, description: true },
    });
    if (volumes.length === 0) return;
    const [dates, covers, descs] = await Promise.all([
      fillChapterDates(mangaId, volumes),
      fillChapterCovers(mangaId, volumes),
      fillChapterDescs(mangaId, volumes),
    ]);
    if (dates + covers + descs > 0) {
      logger.info(`[enrichmentPipeline] Inherited from volumes for manga ${mangaId}: ${dates} dates, ${covers} covers, ${descs} descriptions`);
    }
  } catch (err) {
    logger.warn(`[enrichmentPipeline] Failed to inherit volume fields to chapters for manga ${mangaId} (non-critical)`, err);
  }
}

async function fillChapterDates(mangaId: number, volumes: Array<{ id: number; releaseDate: Date | null }>): Promise<number> {
  let n = 0;
  for (const v of volumes) {
    if (!v.releaseDate) continue;
    // eslint-disable-next-line no-await-in-loop
    const r = await prisma.chapter.updateMany({ where: { mangaId, volumeId: v.id, releaseDate: null }, data: { releaseDate: v.releaseDate } });
    n += r.count;
  }
  return n;
}

async function fillChapterCovers(mangaId: number, volumes: Array<{ id: number; coverImage: string | null }>): Promise<number> {
  let n = 0;
  for (const v of volumes) {
    if (!v.coverImage) continue;
    // eslint-disable-next-line no-await-in-loop
    const r = await prisma.chapter.updateMany({ where: { mangaId, volumeId: v.id, coverImage: null }, data: { coverImage: v.coverImage } });
    n += r.count;
  }
  return n;
}

async function fillChapterDescs(mangaId: number, volumes: Array<{ id: number; description: string | null }>): Promise<number> {
  let n = 0;
  for (const v of volumes) {
    if (!v.description) continue;
    // eslint-disable-next-line no-await-in-loop
    const r = await prisma.chapter.updateMany({ where: { mangaId, volumeId: v.id, description: null }, data: { description: v.description } });
    n += r.count;
  }
  return n;
}

/**
 * Prune phantom Volume rows created by over-eager cover/extractor paths
 * (e.g. Tokyo Ghoul had 144 volumes, real is 14; Fruits Basket 115 vs 23).
 *
 * A volume is phantom when ALL of:
 *   - number > ceil(expectedVolumeCount * 1.1) — beyond plausible range
 *   - chapterStart IS NULL — no validated range
 *   - no Chapter rows reference it via volumeId OR volume number
 *
 * Safe to delete: no data is lost because these shells hold nothing.
 */
// eslint-disable-next-line complexity -- complexity 24: provenance-aware volume-count reconciliation across AniList, Wikipedia, and DB state with several anti-corruption guards
async function prunePhantomVolumes(
  mangaId: number,
  providerResults: UnifiedProviderResults,
): Promise<void> {
  try {
    const metadata = providerResults.enrichmentResult.appliedMatch?.metadata as Record<string, unknown> | undefined;
    const anilistVolumes = typeof metadata?.['volumes'] === 'number' ? metadata['volumes'] as number : 0;
    const wikiVolumes = providerResults.wikipediaResult?.data.volumeList?.length ?? 0;
    // Prefer AniList's scalar volume count — Wikipedia's volumeList can be
    // inflated by chapter-list pages or multi-edition tables (e.g. 20th Century
    // Boys Wikipedia returns 73 volumes for a 22-volume series). Use Wikipedia
    // only when AniList doesn't provide a count, and cap Wikipedia to 1.3×
    // anilist if both are present to reject clearly-inflated lists.
    let expected = 0;
    if (anilistVolumes > 0) {
      expected = wikiVolumes > 0 && wikiVolumes <= anilistVolumes * 1.3
        ? Math.max(anilistVolumes, wikiVolumes)
        : anilistVolumes;
    } else if (wikiVolumes > 0) {
      expected = wikiVolumes;
    }
    if (expected <= 0) return; // unknown — bail, don't risk deletion

    // Safety floor: if the DB already has Volume rows with chapterStart
    // populated (i.e. cross-validation or providers supplied real ranges)
    // at numbers beyond `expected`, those are trusted. AniList can under-
    // report for ongoing series (e.g. Rent-a-Girlfriend anilist.volumes=2
    // despite 22 real volumes). Take the max so we never prune real data.
    const highestRanged = await prisma.volume.findFirst({
      where: { mangaId, chapterStart: { not: null } },
      orderBy: { number: 'desc' },
      select: { number: true },
    });
    if (highestRanged && highestRanged.number > expected) {
      expected = highestRanged.number;
    }

    const maxAllowed = Math.ceil(expected * 1.1);
    const candidates = await prisma.volume.findMany({
      where: { mangaId, number: { gt: maxAllowed }, chapterStart: null },
      select: { id: true, number: true },
    });
    if (candidates.length === 0) return;

    // Guard: never delete a volume that has chapters referencing it
    const candidateIds = candidates.map(v => v.id);
    const candidateNumbers = candidates.map(v => v.number);
    const referenced = await prisma.chapter.findMany({
      where: {
        mangaId,
        OR: [
          { volumeId: { in: candidateIds } },
          { volume: { in: candidateNumbers } },
        ],
      },
      select: { volumeId: true, volume: true },
    });
    const keepNumbers = new Set<number>();
    const keepIds = new Set<number>();
    for (const ch of referenced) {
      if (ch.volumeId !== null) keepIds.add(ch.volumeId);
      if (ch.volume !== null) keepNumbers.add(ch.volume);
    }

    const toDelete = candidates.filter(v => !keepIds.has(v.id) && !keepNumbers.has(v.number));
    if (toDelete.length === 0) return;

    await prisma.volume.deleteMany({
      where: { mangaId, id: { in: toDelete.map(v => v.id) } },
    });
    logger.info(
      `[enrichmentPipeline] Pruned ${toDelete.length} phantom volumes for manga ${mangaId} ` +
      `(expected ~${expected}, max ${maxAllowed}; numbers: ${toDelete.slice(0, 5).map(v => v.number).join(',')}${toDelete.length > 5 ? '…' : ''})`,
    );
  } catch (err) {
    logger.warn(`[enrichmentPipeline] Failed to prune phantom volumes for manga ${mangaId} (non-critical)`, err);
  }
}

/**
 * Inherit series-level publisher (from Metadata.publisher) to any Volume
 * row that doesn't have its own publisher set. Most manga use a single
 * publisher across all volumes, so this is a safe fill-when-null default.
 * ComicVine would otherwise be the per-volume source, but many users
 * don't have an API key.
 */
async function inheritSeriesPublisherToVolumes(mangaId: number): Promise<void> {
  try {
    // Phase 1: publishers[] → Volume.publisher (single) takes the first entry.
    const manga = await prisma.manga.findUnique({
      where: { id: mangaId },
      select: { Metadata: { select: { publishers: true } } },
    });
    const publisher = manga?.Metadata?.publishers[0];
    if (!publisher || publisher.trim().length === 0) return;

    const updated = await prisma.volume.updateMany({
      where: { mangaId, publisher: null },
      data: { publisher },
    });
    if (updated.count > 0) {
      logger.info(`[enrichmentPipeline] Inherited series publisher to ${updated.count} volumes for manga ${mangaId}`);
    }
  } catch (err) {
    logger.warn(`[enrichmentPipeline] Failed to inherit publisher to volumes for manga ${mangaId} (non-critical)`, err);
  }
}

/**
 * Persist provider cross-reference links to Metadata.externalLinks JSON.
 *
 * Pulls MangaDex `attributes.links` (al, mu, kt, ap, bw, amz, ebj, etc.)
 * surfaced via enrichedData.manga.mangadexExternalIds, plus AniList /
 * Wikipedia / Fandom URLs derived elsewhere, and merges them into a single
 * JSON array of `{url, site}` for the UI's external-link strip.
 *
 * Merge-only: existing links are preserved; new ones append unless the same
 * site is already present.
 */
// eslint-disable-next-line complexity -- complexity 21: merges 5 provider link sources (AniList/Wikipedia/Fandom/Comicvine/MangaDex) into externalLinks while deduplicating per-site
async function persistExternalLinks(
  mangaId: number,
  providerResults: UnifiedProviderResults,
): Promise<void> {
  try {
    const manga = await prisma.manga.findUnique({
      where: { id: mangaId },
      select: { metadataId: true, Metadata: { select: { externalLinks: true } } },
    });
    if (!manga?.metadataId) return;

    const enrichedData = providerResults.enrichmentResult.enrichedData as Record<string, unknown> | undefined;
    const unifiedManga = enrichedData?.['manga'] as Record<string, unknown> | undefined;
    const mdLinks = (unifiedManga?.['mangadexExternalIds'] ?? {}) as Record<string, string>;

    const newLinks = buildMangaDexExternalLinks(mdLinks);
    // AniList already returns externalLinks in {url, site} shape — append directly
    const alLinks = (unifiedManga?.['anilistExternalLinks'] ?? []) as Array<{ url: string; site: string }>;
    if (Array.isArray(alLinks)) newLinks.push(...alLinks);
    const fandomUrl = providerResults.fandomResult?.url;
    if (fandomUrl) newLinks.push({ url: fandomUrl, site: 'Fandom' });
    const wikiUrl = providerResults.wikipediaResult?.data.wikipediaUrl;
    if (wikiUrl) newLinks.push({ url: wikiUrl, site: 'Wikipedia' });
    const cvVolumeId = providerResults.comicvineResult?.volumeId;
    if (typeof cvVolumeId === 'number' && cvVolumeId > 0) {
      newLinks.push({ url: `https://comicvine.gamespot.com/volume/4050-${cvVolumeId}/`, site: 'ComicVine' });
    }

    if (newLinks.length === 0) return;

    const existing = (manga.Metadata?.externalLinks ?? []) as unknown;
    const existingArr: Array<{ url: string; site: string }> = Array.isArray(existing)
      ? (existing as Array<unknown>).filter((e): e is { url: string; site: string } =>
          e !== null && typeof e === 'object'
          && typeof (e as { url?: unknown }).url === 'string'
          && typeof (e as { site?: unknown }).site === 'string',
        )
      : [];
    // Pipeline-produced links REPLACE existing same-site entries (newer-wins) so
    // a manual rebind that changes the bound provider id is reflected. Sites the
    // pipeline didn't produce this run are kept as-is.
    const newSites = new Set(newLinks.map(l => l.site));
    const kept = existingArr.filter(e => !newSites.has(e.site));
    const merged = [...kept, ...newLinks];
    const replaced = existingArr.length - kept.length;
    const added = newLinks.length - replaced;
    const linksChanged = replaced > 0 || added > 0;
    if (!linksChanged) return;

    await prisma.metadata.update({
      where: { id: manga.metadataId },
      data: { externalLinks: merged as unknown as Prisma.InputJsonValue },
    });
    logger.info(`[enrichmentPipeline] Persisted external links for manga ${mangaId} (added=${added}, replaced=${replaced})`);
  } catch (err) {
    logger.warn(`[enrichmentPipeline] Failed to persist external links for manga ${mangaId} (non-critical)`, err);
  }
}

/**
 * Aggregate chapter release dates and fill Metadata.startDate / endDate when empty.
 *
 * Providers like AniList sometimes don't ship publication dates; Fandom's
 * per-chapter releaseDate is a reliable fallback. Only writes to fields that
 * are still null — AniList wins when present.
 */
async function aggregateChapterReleaseDates(mangaId: number): Promise<void> {
  try {
    const manga = await prisma.manga.findUnique({
      where: { id: mangaId },
      select: { metadataId: true, Metadata: { select: { startDate: true, endDate: true } } },
    });
    if (!manga?.metadataId) return;
    const needsStart = !manga.Metadata?.startDate;
    const needsEnd = !manga.Metadata?.endDate;
    if (!needsStart && !needsEnd) return;

    const agg = await prisma.chapter.aggregate({
      where: { mangaId, releaseDate: { not: null } },
      _min: { releaseDate: true },
      _max: { releaseDate: true },
    });
    const data: Record<string, Date> = {};
    if (needsStart && agg._min.releaseDate) data['startDate'] = agg._min.releaseDate;
    if (needsEnd && agg._max.releaseDate) data['endDate'] = agg._max.releaseDate;
    if (Object.keys(data).length === 0) return;

    await prisma.metadata.update({ where: { id: manga.metadataId }, data });
    logger.info(`[enrichmentPipeline] Filled chapter-date aggregate for manga ${mangaId}: ${Object.keys(data).join(', ')}`);
  } catch (err) {
    logger.warn(`[enrichmentPipeline] Failed to aggregate chapter release dates for manga ${mangaId} (non-critical)`, err);
  }
}

/**
 * Extract a Wikipedia article ID from a URL or title.
 * "/wiki/Attack_on_Titan" → "Attack_on_Titan"
 */
function extractWikipediaId(wikipediaUrl?: string, title?: string): string | null {
  if (wikipediaUrl) {
    const match = /\/wiki\/([^#?]+)/.exec(wikipediaUrl);
    if (match?.[1]) return decodeURIComponent(match[1]);
  }
  if (title) return title.replace(/ /g, '_');
  return null;
}

/**
 * Extract a Fandom wiki key from its URL.
 * "https://attackontitan.fandom.com/wiki/..." → "attackontitan"
 */
function extractFandomId(fandomUrl?: string): string | null {
  if (!fandomUrl) return null;
  const match = /https?:\/\/([^.]+)\.fandom\.com/.exec(fandomUrl);
  return match?.[1] ?? null;
}

/**
 * For variant editions (colored, omnibus, etc.), inherit missing metadata
 * (cover, summary, genres) from the parent series in the same library.
 */
async function inheritParentSeriesMetadata(mangaId: number): Promise<void> {
  try {
    const manga = await prisma.manga.findUnique({
      where: { id: mangaId },
      select: { title: true, libraryId: true, metadataId: true },
    });
    if (!manga?.metadataId) return;

    const baseTitle = stripEditionQualifier(manga.title);
    if (baseTitle === manga.title) return; // Not a variant

    const parentMetaId = await findParentMetadataId(manga.libraryId, baseTitle, mangaId);
    if (!parentMetaId) return;

    await copyMissingMetadata(manga.metadataId, parentMetaId, baseTitle, mangaId);
  } catch (err) {
    logger.warn('[enrichmentPipeline] Failed to inherit parent series metadata (non-critical):', err);
  }
}

/** Find the metadata ID of the parent (non-variant) series in the same library */
async function findParentMetadataId(
  libraryId: number, baseTitle: string, excludeId: number,
): Promise<number | null> {
  const parent = await prisma.manga.findFirst({
    where: { libraryId, title: baseTitle, id: { not: excludeId } },
    select: { metadataId: true },
  });
  return parent?.metadataId ?? null;
}

/** Copy missing cover, summary, genres, authors from parent metadata */
async function copyMissingMetadata(
  targetId: number, sourceId: number, baseTitle: string, mangaId: number,
): Promise<void> {
  const [current, parent] = await Promise.all([
    prisma.metadata.findUnique({ where: { id: targetId },
      select: { cover: true, coverLarge: true, summary: true, genres: true } }),
    prisma.metadata.findUnique({ where: { id: sourceId }, select: { cover: true, coverLarge: true, coverMedium: true, summary: true, genres: true, authors: true, artists: true, publishers: true } }),
  ]);
  if (!current || !parent) return;

  const updates = buildInheritanceUpdates(current, parent);
  if (Object.keys(updates).length > 0) {
    await prisma.metadata.update({ where: { id: targetId }, data: updates });
    logger.info(`[enrichmentPipeline] Inherited ${Object.keys(updates).length} metadata fields from "${baseTitle}" for manga ${mangaId}`);
  }
}

/** Build the set of fields to copy from parent to child metadata */
function buildInheritanceUpdates(current: { cover: string | null; coverLarge: string | null; summary: string | null; genres: string[] }, parent: { cover: string | null; coverLarge: string | null; coverMedium: string | null; summary: string | null; genres: string[]; authors: string[]; artists: string[]; publishers: string[] }): Record<string, unknown> {
  const updates: Record<string, unknown> = {};
  const noCover = !current.cover || current.cover === '/cover-not-found.jpg';
  if (noCover && parent.cover && parent.cover !== '/cover-not-found.jpg') updates['cover'] = parent.cover;
  if (noCover && parent.coverLarge) updates['coverLarge'] = parent.coverLarge;
  if (noCover && parent.coverMedium) updates['coverMedium'] = parent.coverMedium;
  if (!current.summary && parent.summary) updates['summary'] = parent.summary;
  if (current.genres.length === 0 && parent.genres.length > 0) updates['genres'] = parent.genres;
  if (parent.authors.length > 0) updates['authors'] = parent.authors;
  if (parent.artists.length > 0) updates['artists'] = parent.artists;
  if (parent.publishers.length > 0) updates['publishers'] = parent.publishers;
  return updates;
}

/** Strip edition qualifiers to get the base series title */
function stripEditionQualifier(title: string): string {
  const qualifiers = 'colou?r(?:ed)?|digital\\s*colou?r(?:ed)?|official\\s*colou?r(?:ed)?|full\\s*colou?r|omnibus|deluxe|box\\s*set';
  return title
    .replace(new RegExp(`\\s*[-–—:]\\s*(${qualifiers})\\s*$`, 'i'), '')
    .replace(new RegExp(`\\s*\\((${qualifiers})\\)\\s*$`, 'i'), '')
    .trim();
}

/**
 * Build the providerMetadata.kitsu section from Kitsu fetch result + existing
 * binding. Returns a new object — caller assigns into the merged map.
 */
/** Carries urlSlug (from MU's `url`) + the legacy numeric series ID so
 *  the bind dialog can render a live /series/{slug} link. */
function buildMangaUpdatesSection(
  existingMu: Record<string, unknown>,
  muResult: NonNullable<UnifiedProviderResults['mangaupdatesResult']>,
): Record<string, unknown> {
  const next: Record<string, unknown> = {
    ...existingMu,
    relatedSeries: muResult.relatedSeries, recommendations: muResult.recommendations,
    authors: muResult.authors, publishers: muResult.publishers, publications: muResult.publications,
    type: muResult.type, year: muResult.year,
    bayesianRating: muResult.bayesianRating, ratingVotes: muResult.ratingVotes,
    latestChapter: muResult.latestChapter, animeMapping: muResult.animeMapping,
    alternativeTitles: muResult.alternativeTitles,
    licensed: muResult.licensed, completed: muResult.completed,
  };
  if (muResult.urlSlug !== null) next['urlSlug'] = muResult.urlSlug;
  return next;
}

function buildKitsuSection(
  existingKitsu: Record<string, unknown>,
  kitsuResult: NonNullable<UnifiedProviderResults['kitsuResult']>,
  boundAt: string,
): Record<string, unknown> {
  const next: Record<string, unknown> = {
    ...existingKitsu,
    kitsuId: kitsuResult.kitsuId,
    slug: kitsuResult.slug,
    canonicalTitle: kitsuResult.canonicalTitle,
    alternativeTitles: kitsuResult.alternativeTitles,
    synopsis: kitsuResult.synopsis,
    status: kitsuResult.status,
    subtype: kitsuResult.subtype,
    ageRating: kitsuResult.ageRating,
    ageRatingGuide: kitsuResult.ageRatingGuide,
    chapterCount: kitsuResult.chapterCount,
    volumeCount: kitsuResult.volumeCount,
    startDate: kitsuResult.startDate,
    endDate: kitsuResult.endDate,
    serialization: kitsuResult.serialization,
    averageRating: kitsuResult.averageRating,
    userCount: kitsuResult.userCount,
    favoritesCount: kitsuResult.favoritesCount,
    posterImageUrl: kitsuResult.posterImageUrl,
    coverImageUrl: kitsuResult.coverImageUrl,
  };
  if (!existingKitsu['providerId']) {
    next['providerId'] = kitsuResult.kitsuId;
    next['boundAt'] = boundAt;
  }
  return next;
}

/**
 * Persist all discovered provider IDs to providerMetadata so the UI
 * shows "Bound to ..." for every provider that returned data.
 *
/**
 * Merge-only: never overwrites an existing providerId (manual bindings win).
 */
// eslint-disable-next-line complexity -- complexity 28: collects bindings from 5 providers (AniList/MangaDex/ComicVine/MangaUpdates/Fandom/Wikipedia) + AL recommendations + MU extended data into a single merge-only update; each section guards against overwriting manual bindings
async function persistProviderBindings(
  mangaId: number,
  providerResults: UnifiedProviderResults,
): Promise<void> {
  try {
    const currentManga = await prisma.manga.findUnique({
      where: { id: mangaId },
      select: { providerMetadata: true },
    });
    const existing = (currentManga?.providerMetadata as Record<string, Record<string, unknown>> | null) ?? {};

    // Extract IDs from enrichedData.manga.ids (anilist, mangadex, comicvine, mangaupdates)
    const enrichedData = providerResults.enrichmentResult.enrichedData as Record<string, unknown> | undefined;
    const unifiedManga = enrichedData?.['manga'] as Record<string, unknown> | undefined;
    const ids = (unifiedManga?.['ids'] ?? {}) as Record<string, string>;

    // Build the set of provider → providerId mappings
    const discoveries: Array<[string, string]> = [];
    for (const [provider, id] of Object.entries(ids)) {
      if (id) discoveries.push([provider, String(id)]);
    }

    // Fandom: extract wiki key from URL
    const fandomId = extractFandomId(providerResults.fandomResult?.url);
    if (fandomId) discoveries.push(['fandom', fandomId]);

    // Wikipedia: extract article name from URL or title
    const wikiData = providerResults.wikipediaResult?.data;
    const wikipediaId = extractWikipediaId(wikiData?.wikipediaUrl, wikiData?.title);
    if (wikipediaId) discoveries.push(['wikipedia', wikipediaId]);

    // Merge into existing providerMetadata (don't overwrite manual bindings)
    let changed = false;
    const merged = { ...existing };
    const boundAt = new Date().toISOString();

    for (const [provider, providerId] of discoveries) {
      const section = (merged[provider] ?? {}) as Record<string, unknown>;
      if (section['providerId']) continue; // already bound — skip
      merged[provider] = { ...section, providerId, boundAt };
      changed = true;
    }

    // Store AniList recommendations (related manga) for the recommendations strip in the UI
    const enrichedDataAL = providerResults.enrichmentResult.enrichedData as Record<string, unknown> | undefined;
    const unifiedMangaAL = enrichedDataAL?.['manga'] as Record<string, unknown> | undefined;
    const alRecs = unifiedMangaAL?.['anilistRecommendations'];
    if (Array.isArray(alRecs) && alRecs.length > 0) {
      const alSection = (merged['anilist'] ?? {}) as Record<string, unknown>;
      merged['anilist'] = { ...alSection, related: alRecs };
      changed = true;
    }

    // Store extended MangaUpdates data (related series, recommendations, etc.)
    if (providerResults.mangaupdatesResult) {
      const muSection = (merged['mangaupdates'] ?? {}) as Record<string, unknown>;
      merged['mangaupdates'] = buildMangaUpdatesSection(muSection, providerResults.mangaupdatesResult);
      changed = true;
    }

    // Store Kitsu data (age rating, alt covers, community signals)
    if (providerResults.kitsuResult) {
      const existingKitsu = (merged['kitsu'] ?? {}) as Record<string, unknown>;
      merged['kitsu'] = buildKitsuSection(existingKitsu, providerResults.kitsuResult, boundAt);
      changed = true;
    }

    if (!changed) return;

    await prisma.manga.update({
      where: { id: mangaId },
      data: { providerMetadata: merged as unknown as Prisma.InputJsonValue },
    });

    const boundProviders = discoveries
      .filter(([p]) => !(existing[p] as Record<string, unknown> | undefined)?.['providerId'])
      .map(([p]) => p);
    logger.info(`[enrichmentPipeline] Auto-bound ${boundProviders.length} providers for manga ${mangaId}: ${boundProviders.join(', ')}`);
  } catch (bindError) {
    logger.warn('[enrichmentPipeline] Failed to persist provider bindings (non-critical):', bindError);
  }
}

/**
 * Set volume-file chapter titles to the volume name from the Volume table.
 * Volume files (NULL chapterNumber, file-backed) show "Volume N" by default —
 * this updates them to the enriched volume title (e.g., "The Desperate Battle Begins!").
 */
async function labelVolumeFileChapters(mangaId: number): Promise<void> {
  try {
    const volumeFiles = await prisma.chapter.findMany({
      where: { mangaId, chapterNumber: null, filePath: { not: null }, volume: { not: null } },
      select: { id: true, volume: true, title: true },
    });
    if (volumeFiles.length === 0) return;

    const volumes = await prisma.volume.findMany({
      where: { mangaId },
      select: { number: true, title: true },
    });
    const volumeTitleMap = new Map(
      volumes.filter(v => v.title !== null).map(v => [v.number, v.title as string]),
    );

    for (const vf of volumeFiles) {
      const volTitle = volumeTitleMap.get(vf.volume as number);
      if (volTitle && vf.title !== volTitle) {
        // eslint-disable-next-line no-await-in-loop -- sequential updates
        await prisma.chapter.update({ where: { id: vf.id }, data: { title: volTitle } });
      }
    }
  } catch (err) {
    logger.warn('[enrichmentPipeline] Failed to label volume-file chapters (non-critical):', err);
  }
}

/** Pre-warm the image proxy cache for the manga cover so it's instant on first page load */
async function preWarmCoverCache(mangaId: number): Promise<void> {
  try {
    const metadata = await prisma.metadata.findFirst({
      where: { Manga: { id: mangaId } },
      select: { coverLarge: true, cover: true },
    });

    const coverUrl = metadata?.coverLarge ?? metadata?.cover;
    if (!coverUrl) return;

    const proxyUrl = await generateProxyUrl(coverUrl);
    const port = process.env['PORT'] ?? '3000';

    // Fire-and-forget: don't block enrichment for image caching
    fetch(`http://localhost:${port}${proxyUrl}`)
      .then(() => logger.info(`[enrichmentPipeline] Pre-warmed cover cache for manga ${mangaId}`))
      .catch(() => { /* silently ignore — non-critical */ });
  } catch {
    // Non-critical: don't fail enrichment if pre-warming fails
  }
}

/**
 * Store volume covers in providerMetadata for frontend. Also persists the
 * current ComicVine volumeId (when bound) so the orchestrator can detect
 * stale-cache mismatches on future re-enrichment passes.
 */
async function storeVolumeCoverData(
  mangaId: number,
  providerResults: UnifiedProviderResults,
): Promise<void> {
  try {
    const dbVolumes = await prisma.volume.findMany({
      where: { mangaId },
      orderBy: { number: 'asc' },
    });

    if (dbVolumes.length === 0) return;

    const volumeDataForFrontend = dbVolumes.map((v) => ({
      volumeNumber: v.number,
      number: v.number,
      title: v.title ?? undefined,
      description: v.description ?? undefined,
      coverImageUrl: v.coverImage ?? undefined,
      chapterStart: v.chapterStart ?? undefined,
      chapterEnd: v.chapterEnd ?? undefined,
    }));

    const currentManga = await prisma.manga.findUnique({
      where: { id: mangaId },
      select: { providerMetadata: true },
    });

    const existing = currentManga?.providerMetadata
      ? currentManga.providerMetadata as Record<string, unknown>
      : {};

    const comicvineSection = (existing['comicvine'] as Record<string, unknown> | undefined) ?? {};
    const importSection = (existing['importProfile'] as Record<string, unknown> | undefined) ?? {};

    const currentVolumeId = providerResults.comicvineResult?.volumeId;
    const nextComicvine: Record<string, unknown> = {
      ...comicvineSection,
      volumeData: volumeDataForFrontend,
    };
    if (currentVolumeId !== undefined) {
      nextComicvine['volumeId'] = currentVolumeId;
    }

    const providerMetadata = {
      ...existing,
      comicvine: nextComicvine,
      importProfile: { ...importSection, chapterSource: 'comicvine' },
    } as unknown as Prisma.InputJsonValue;

    await prisma.manga.update({
      where: { id: mangaId },
      data: { providerMetadata },
    });

    logger.info(`[enrichmentPipeline] Stored ${dbVolumes.length} volume covers in providerMetadata (volumeId=${currentVolumeId ?? 'unbound'})`);
  } catch (coverError) {
    logger.warn(`[enrichmentPipeline] Failed to store volume covers in providerMetadata (non-critical):`, coverError);
  }
}

/** Invalidate server-side manga cache */
async function invalidateCache(mangaId: number): Promise<void> {
  try {
    const { invalidateMangaCache } = await import('../../crud-operations/get-manga-cache');
    await invalidateMangaCache(mangaId);
  } catch { /* cache invalidation non-critical */ }
}

/** Emit WebSocket event so open manga pages auto-refetch */
async function emitWebSocketUpdate(mangaId: number): Promise<void> {
  try {
    const { realtimeEmitter } = await import('@/server/services/realtime/RealtimeEventEmitter');
    await realtimeEmitter.emitMangaUpdate({
      mangaId,
      action: 'metadata_updated',
    });
  } catch { /* WebSocket not available */ }
}
