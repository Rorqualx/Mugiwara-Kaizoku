// @file-size-justified: phase-2 DB-persistence cohesion — splitting the merge
// graph (mergeEnrichmentChapters, buildChapterUpdates, findStaleChapterIds,
// buildNewChapterRecords) into separate files would scatter tightly-coupled
// helpers across 4-5 modules with no clean seam. Pre-existing at >500 lines.
/**
 * Phase 2: DB Persistence
 *
 * Persists metadata to DB and merges chapters/volumes from enriched data.
 * Uses a merge strategy: existing file-based chapters are preserved and enriched,
 * only genuinely new chapters are created as PENDING placeholders.
 */

import { prisma } from '@/server/db';
import { isPlaceholderVolumeTitle } from '@/server/parsers/extractors/table-extractor/volume-extractors';
import type { EnrichmentResult } from '@/server/services/library/metadataEnrichmentService/types';
import { metadataPersistenceService } from '@/server/services/metadata/metadata-persister';
import { persistNormalizedVolumes } from '@/server/services/metadataMerger/volume-persister';
import { isError } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import { chapterHasUserData } from '../refresh/clear-auto-bindings';

import { buildFileContentMatcher } from './file-content-matcher';

import type { ChapterConsensus } from './phase-volume-cross-validation/chapter-consensus-resolver';
import type { EnrichmentProgress, ProviderChapter } from './types';
import type { Prisma } from '@prisma/client';

// Re-export for external consumers
export type { ProviderChapter };

/** Defense-in-depth: reject titles that are CSS/HTML garbage before DB insert */
function sanitizeChapterTitle(title: string | undefined, chapterNumber: number): string {
  const fallback = `Chapter ${chapterNumber}`;
  if (!title || title.length === 0) return fallback;
  // Reject CSS content (braces, selectors, property values)
  if (/[{};]/.test(title)) return fallback;
  if (/\.mw-parser-output|background[-:]|font-size:|padding:|margin:/.test(title)) return fallback;
  if (/@media\s/.test(title)) return fallback;
  // Reject excessively long titles
  if (title.length > 300) return fallback;
  return title;
}

/** Transaction client type extracted from Prisma */
type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * Delete all existing volumes before chapter merge.
 *
 * Cross-validation (Phase 3-4) rebuilds volume ranges from all sources,
 * so we don't need to preserve any source-specific volumes here.
 */
async function deleteExistingVolumes(tx: TxClient, mangaId: number): Promise<void> {
  await tx.volume.deleteMany({ where: { mangaId } });
}

/** Selected fields from an existing chapter for merge comparison */
interface ExistingChapter {
  id: number;
  index: number;
  chapterNumber: number | null;
  filePath: string | null;
  downloadStatus: string;
  title: string;
  volume: number | null;
  description: string | null;
  coverImage: string | null;
  pages: number | null;
  pageCount: number | null;
  releaseDate: Date | null;
  packDownloadId: bigint | null;
  _count: {
    chapterFiles: number;
    ReadingProgress: number;
    ReaderBookmark: number;
    ReadingHistory: number;
    WantedItem: number;
    NativeDownload: number;
  };
}

/**
 * Generic title pattern — matches auto-generated or filename-derived chapter titles:
 *   "Chapter 123", "Chapter 1.5"     (space-separated)
 *   "chapter-1", "chapter_2"          (dash/underscore-separated)
 *   "c001.cbz", "c12"                 (filename-like)
 *   "Ch.5", "Ch 10"                   (abbreviated)
 */
const GENERIC_TITLE_RE = /^(?:chapter[\s_-]+\d|ch[.\s]+\d|c\d{1,4}(?:\.\w+)?$)/i;

/**
 * Run Phase 2: persist metadata + merge chapters/volumes.
 *
 * `mangadexAggregateChapterCount` is the chapter total from
 * `UnifiedProviderResults.mangadexAggregate` (computed in the orchestrator).
 * Used as a reference floor in the contamination gate so that an accurate
 * MangaDex chapter inventory isn't dropped just because AniList's scalar is
 * stale or null. Optional — undefined when MangaDex didn't match.
 */
export async function phaseDbPersistence(
  mangaId: number,
  result: EnrichmentResult,
  onProgress?: EnrichmentProgress,
  mangadexAggregateChapterCount?: number,
  chapterConsensus?: ChapterConsensus,
): Promise<void> {
  await onProgress?.('persisting', 'Creating chapters and volumes...');

  if (!result.appliedMatch?.metadata) return;

  const metadata = result.appliedMatch.metadata as Record<string, unknown>;
  const providerName = result.appliedMatch.provider;

  await persistMetadataToDb(mangaId, metadata, providerName);

  const enrichedData = result.enrichedData as
    Record<string, unknown> | undefined;

  await createChaptersAndVolumes(mangaId, metadata, enrichedData, mangadexAggregateChapterCount, chapterConsensus);
}

/** Persist metadata fields to the database */
async function persistMetadataToDb(
  mangaId: number,
  metadata: Record<string, unknown>,
  providerName: string,
): Promise<void> {
  const provenance: Record<string, string> = {};
  for (const key of Object.keys(metadata)) {
    if (metadata[key] !== undefined && metadata[key] !== null) {
      provenance[key] = providerName;
    }
  }

  const persistResult = await metadataPersistenceService.persistMetadata({
    mangaId,
    metadata: metadata as import('@/types/search.types').UnifiedMangaMetadata,
    metadataProvenance: provenance,
  });

  if (isError(persistResult)) {
    logger.warn(`Failed to persist enriched metadata for manga ${mangaId}: ${persistResult.error.message}`);
  } else {
    logger.info(`Persisted enriched metadata for manga ${mangaId}`);
  }
}

/**
 * Apply chapter-count consensus as a ceiling on the raw inferred count.
 *
 * Without this cap, an inflated AniList scalar (e.g. Sweat and Soap AL=110
 * vs canon=66 — AL conflates MangaDex split-part releases) creates ghost
 * stub chapters past the real manifest end. High/medium confidence acts
 * as a ceiling; low/unknown leaves the raw `Math.max` value untouched.
 */
function applyChapterConsensusCeiling(
  mangaId: number,
  rawCount: number,
  consensus: ChapterConsensus | undefined,
): number {
  if (!consensus) return rawCount;
  if (consensus.confidence !== 'high' && consensus.confidence !== 'medium') return rawCount;
  if (consensus.count <= 0 || consensus.count >= rawCount) return rawCount;
  logger.info(`[enrichmentPipeline] Chapter consensus capped expectedCount for manga ${mangaId}: rawMax=${rawCount} -> consensus=${consensus.count} (confidence=${consensus.confidence}, sources=${consensus.sources.join(',')})`);
  return consensus.count;
}

/** Create chapters and volumes from enriched data.
 *  Uses a transaction to merge provider chapters with existing file-based chapters. */
async function createChaptersAndVolumes(
  mangaId: number,
  metadata: Record<string, unknown>,
  enrichedData: Record<string, unknown> | undefined,
  mangadexAggregateChapterCount?: number,
  chapterConsensus?: ChapterConsensus,
): Promise<void> {
  const unifiedManga = enrichedData?.['manga'] as Record<string, unknown> | undefined;
  const granularChapters = (unifiedManga?.['chapters'] ?? []) as Array<{
    chapterNumber?: string; title?: string; volume?: string;
    pages?: number; source?: string; language?: string;
    releaseDate?: string;
  }>;
  const granularVolumes = (unifiedManga?.['volumes'] ?? []) as Array<{
    volumeNumber: string; title?: string; description?: string; coverImage?: string;
    startChapter?: string; endChapter?: string; chapterRange?: string; chapterCount?: number;
    isbn?: string; pageCount?: number; releaseDate?: string; id?: string;
  }>;

  const scalarChapterCount = typeof metadata['chapters'] === 'number' ? metadata['chapters'] : 0;
  const totalChapters = unifiedManga?.['totalChapters'];
  // Always compute the volume-derived count alongside the AniList scalar.
  // The user-facing search is AniList-only; the backend cross-matches against
  // MangaDex/ComicVine/Fandom — and AniList scalars are routinely stale or
  // null for ongoing series. Trusting AL alone makes the contamination gate
  // (below) drop legitimate MangaDex catalog data: e.g. Iken Senki Volundio
  // has AL=30 chapters but MangaDex catalogs 89 across 10 volumes, all of
  // which is real. Using the max of (AL, volume-inferred) keeps the gate
  // protective against ComicVine's cross-series flooding while letting
  // accurate MangaDex aggregates pass.
  const inferredFromVolumes = inferChapterCountFromVolumes(
    granularVolumes,
    typeof totalChapters === 'number' ? totalChapters : undefined,
  );
  const mangadexCount = mangadexAggregateChapterCount ?? 0;
  const rawInferredChapterCount = Math.max(scalarChapterCount, inferredFromVolumes, mangadexCount);
  const inferredChapterCount = applyChapterConsensusCeiling(mangaId, rawInferredChapterCount, chapterConsensus);
  logger.info(`[enrichmentPipeline] granularChapters=${granularChapters.length}, granularVolumes=${granularVolumes.length}, scalarChapterCount=${scalarChapterCount}, inferredFromVolumes=${inferredFromVolumes}, mangadexAggregate=${mangadexCount}, inferredChapterCount=${inferredChapterCount}`);

  // Granular chapter contamination gate: when the reference count (max of
  // AniList scalar and volume-inferred count) is known and the granular list
  // (ComicVine + MangaDex merge) still exceeds 2× reference, the granular
  // source is contaminated. Two real-world triggers caught here:
  //   - ComicVine's language-aware matcher binds the main-series volume to a
  //     spin-off (Naruto 700 issues bound to "Sasuke's Story" with AL=10 but
  //     volumes still report ~700 → reference=700, gate doesn't false-fire).
  //   - ComicVine catalogs 2× more "issues" than real chapters and the
  //     parser's running counter inflates chapter numbers (One Piece, ~2030
  //     CV issues vs ~1140 real chapters with AL=null and MangaDex
  //     aggregate≈1140 → reference=1140, gate fires correctly on 2030).
  // On gate fire: fall back to Tier 2 (synthetic chapter list sized to the
  // reference count) so persistence doesn't write the cross-series flood.
  const referenceCount = inferredChapterCount;
  const granularContaminated = referenceCount >= 2
    && granularChapters.length > referenceCount * 2;
  if (granularContaminated) {
    logger.warn(`[enrichmentPipeline] Granular chapter list contamination gated for manga ${mangaId} — ${granularChapters.length} granular chapters exceeds 2× reference (max of AL=${scalarChapterCount}, volumes=${inferredFromVolumes}, mangadex=${mangadexCount}); falling back to Tier 2`);
  }
  const useGranularChapters = !granularContaminated && granularChapters.length > 0 &&
    (inferredChapterCount === 0 || granularChapters.length >= inferredChapterCount * 0.5);

  // Dedup first so the title map doesn't carry a contaminated title at a
  // duplicate chapter number. e.g. Sweat and Soap had ch 53-62 carrying the
  // same titles as ch 7-16; without dedup the Tier-2 fallback would emit
  // phantom stubs at 53-62 with the canonical titles.
  const dedupedChapters = deduplicateChapters(granularChapters);
  const granularTitleMap = buildGranularTitleMap(dedupedChapters);

  const providerChapters = useGranularChapters
    ? buildTier1ChapterList(dedupedChapters)
    : inferredChapterCount > 0
      ? buildTier2ChapterList(inferredChapterCount, granularTitleMap)
      : [];

  try {
    if (providerChapters.length > 0) {
      await prisma.$transaction(async (tx) => {
        await deleteExistingVolumes(tx, mangaId);
        const mergeResult = await mergeEnrichmentChapters(tx, mangaId, providerChapters, inferredChapterCount);
        logger.info(
          `Chapter merge for manga ${mangaId}: ${mergeResult.updated} updated, ` +
          `${mergeResult.created} created, ${mergeResult.preserved} preserved`
        );
      }, { timeout: 30000 });
    }

    const sources = unifiedManga?.['sources'] as string[] | undefined;
    await persistVolumes(mangaId, granularVolumes, sources);
  } catch (chapterError) {
    logger.warn(`Failed to create chapters/volumes from enrichment for manga ${mangaId}:`, chapterError);
  }
}

// ---------------------------------------------------------------------------
// Pure data builders (no DB calls)
// ---------------------------------------------------------------------------

/** Tier 1: Build ProviderChapter[] from granular chapter arrays */
function buildTier1ChapterList(
  granularChapters: Array<{
    chapterNumber?: string; title?: string; volume?: string;
    pages?: number; source?: string; language?: string;
    coverImage?: string; description?: string; releaseDate?: string;
  }>,
): ProviderChapter[] {
  return granularChapters.map((ch, idx) => {
    const result: ProviderChapter = {
      chapterNumber: ch.chapterNumber ? parseFloat(ch.chapterNumber) : (idx + 1),
    };
    if (ch.title) result.title = ch.title;
    if (ch.pages) result.pages = ch.pages;
    if (ch.volume) result.volume = parseInt(ch.volume, 10);
    if (ch.coverImage) result.coverImage = ch.coverImage;
    if (ch.description) result.description = ch.description;
    if (ch.releaseDate) result.releaseDate = ch.releaseDate;
    return result;
  });
}

/** Tier 2: Build ProviderChapter[] from scalar count + partial titles */
function buildTier2ChapterList(
  count: number,
  titleMap: Map<number, { title?: string; pages: number }>,
): ProviderChapter[] {
  const chapters: ProviderChapter[] = [];
  for (let i = 1; i <= count; i++) {
    const granular = titleMap.get(i);
    const ch: ProviderChapter = { chapterNumber: i, pages: granular?.pages ?? 0 };
    if (granular?.title) ch.title = granular.title;
    chapters.push(ch);
  }
  return chapters;
}

// ---------------------------------------------------------------------------
// Merge logic (split into focused helpers)
// ---------------------------------------------------------------------------

interface MergeResult { updated: number; created: number; preserved: number }

/** Build update payload for an existing chapter from provider data */
// eslint-disable-next-line complexity -- sequential field-by-field merge, splitting would hurt readability
function buildChapterUpdates(
  match: ExistingChapter,
  pch: ProviderChapter,
): Record<string, unknown> | null {
  const updates: Record<string, unknown> = {};

  if (pch.title && (!match.title || GENERIC_TITLE_RE.test(match.title))) {
    const sanitized = sanitizeChapterTitle(pch.title, pch.chapterNumber);
    if (!GENERIC_TITLE_RE.test(sanitized)) {
      updates['title'] = sanitized;
    }
  }
  if (pch.description && match.description === null) updates['description'] = pch.description;
  if (pch.coverImage && match.coverImage === null) updates['coverImage'] = pch.coverImage;
  if (pch.volume !== undefined && match.volume === null) updates['volume'] = pch.volume;
  if (pch.pages !== undefined && pch.pages > 0) {
    if (match.pages === null || match.pages === 0) updates['pages'] = pch.pages;
    if (match.pageCount === null || match.pageCount === 0) updates['pageCount'] = pch.pages;
  }
  if (pch.releaseDate && match.releaseDate === null) {
    const parsed = Date.parse(pch.releaseDate);
    if (!isNaN(parsed)) updates['releaseDate'] = new Date(parsed);
  }

  return Object.keys(updates).length > 0 ? updates : null;
}

/**
 * Find stale PENDING chapter IDs that should be removed.
 *
 * Two passes:
 *   1. Numbered-but-orphaned — rows whose chapterNumber isn't in providerNumbers
 *      and aren't matched by file content. Only runs when provider coverage ≥ 80%.
 *   2. Phantom-stub — rows with chapterNumber=null AND filePath=null AND zero
 *      user-data signals. These are remnants from prior wrong bindings (CV
 *      issues misread as chapters) or from reidentify passes that nulled the
 *      row's chapterNumber. The previous filter required `chapterNumber !== null`
 *      so these were immortal. See audit plan 2026-05-19.
 */
function findStaleChapterIds(
  existing: ExistingChapter[],
  providerNumbers: Set<number>,
  matchedIds: Set<number>,
  expectedChapterCount: number,
): number[] {
  const coverageRatio = expectedChapterCount > 0
    ? providerNumbers.size / expectedChapterCount
    : 0;

  const numberedStale = coverageRatio < 0.8 ? [] : existing
    .filter(ch =>
      ch.downloadStatus === 'PENDING' &&
      ch.filePath === null &&
      ch.chapterNumber !== null &&
      Number.isInteger(ch.chapterNumber) &&
      !providerNumbers.has(ch.chapterNumber) &&
      !matchedIds.has(ch.id)
    )
    .map(ch => ch.id);

  // Phantom sweep runs regardless of coverage: a row with no chapterNumber AND
  // no filePath AND no user-data signals carries no information and only
  // exists to clutter the UI.
  const phantomStale = existing
    .filter(ch =>
      ch.chapterNumber === null &&
      ch.filePath === null &&
      ch.downloadStatus === 'PENDING' &&
      !matchedIds.has(ch.id) &&
      !chapterHasUserData(ch)
    )
    .map(ch => ch.id);

  return [...numberedStale, ...phantomStale];
}

/** Build createMany data for new provider chapters */
function buildNewChapterRecords(
  mangaId: number,
  toCreate: ProviderChapter[],
  maxIndex: number,
): Prisma.ChapterCreateManyInput[] {
  return toCreate.map((pch, idx) => ({
    mangaId,
    fileName: `c${pch.chapterNumber.toString().padStart(3, '0')}.cbz`,
    index: maxIndex + idx + 1,
    chapterNumber: pch.chapterNumber,
    title: sanitizeChapterTitle(pch.title, pch.chapterNumber),
    alternativeTitles: [] as string[],
    size: 0,
    downloadStatus: 'PENDING' as const,
    volume: pch.volume ?? null,
    downloadUrl: null,
    coverImage: pch.coverImage ?? null,
    description: pch.description ?? null,
    releaseDate: pch.releaseDate ? (() => { const d = Date.parse(pch.releaseDate); return isNaN(d) ? null : new Date(d); })() : null,
    pageCount: pch.pages ?? null,
    pages: pch.pages ?? null,
    monitored: true,
    updatedAt: new Date(),
  }));
}

/** Merge provider chapters into existing DB chapters */
async function mergeEnrichmentChapters(
  tx: TxClient,
  mangaId: number,
  providerChapters: ProviderChapter[],
  expectedCount: number,
): Promise<MergeResult> {
  const existing = await tx.chapter.findMany({
    where: { mangaId },
    select: {
      id: true, index: true, chapterNumber: true, filePath: true,
      downloadStatus: true, title: true, volume: true, description: true,
      coverImage: true, pages: true, pageCount: true, releaseDate: true,
      packDownloadId: true,
      _count: { select: {
        chapterFiles: true, ReadingProgress: true, ReaderBookmark: true,
        ReadingHistory: true, WantedItem: true, NativeDownload: true,
      } },
    },
  });

  const byChapterNumber = new Map<number, ExistingChapter>();
  for (const ch of existing) {
    if (ch.chapterNumber !== null) byChapterNumber.set(ch.chapterNumber, ch);
  }

  // Provider re-fetches must never shadow a user's downloaded chapter, even
  // when the new claim comes in at a different chapterNumber (or the existing
  // row was cleaned up to chapterNumber=NULL with title prefixed "[Dup of ch N]
  // ..."). See `file-content-matcher.ts`.
  const { findFileMatchByContent } = buildFileContentMatcher(existing, normalizeTitleForDedup);

  const toCreate: ProviderChapter[] = [];
  let updated = 0;
  let shadowSkipped = 0;
  const matchedIds = new Set<number>();
  const providerNumbers = new Set<number>();

  for (const pch of providerChapters) {
    providerNumbers.add(pch.chapterNumber);
    const match = byChapterNumber.get(pch.chapterNumber);
    if (!match) {
      const fileMatch = findFileMatchByContent(pch);
      if (fileMatch) {
        // User already owns this physical chapter under a different number
        // (or with chapterNumber NULLed by a manual cleanup). Don't create a
        // phantom stub that would re-introduce the duplicate.
        matchedIds.add(fileMatch.id);
        shadowSkipped++;
        continue;
      }
      toCreate.push(pch);
      continue;
    }

    matchedIds.add(match.id);
    // Title-clash guard: if the provider's title would land here BUT it
    // already belongs to a different file-attached row in this manga, the
    // provider is feeding us a contaminated mapping. Strip the title from
    // the update so buildChapterUpdates keeps the existing safe value
    // (or the "Chapter N" fallback).
    const clash = findFileMatchByContent(pch);
    const titleClashes = clash !== null && clash.id !== match.id;
    let safePch: ProviderChapter = pch;
    if (titleClashes) {
      shadowSkipped++;
      const { title: _drop, ...rest } = pch;
      safePch = rest;
    }
    const updates = buildChapterUpdates(match, safePch);
    if (updates) {
      updates['updatedAt'] = new Date();
      // eslint-disable-next-line no-await-in-loop -- sequential updates within transaction
      await tx.chapter.update({ where: { id: match.id }, data: updates });
      updated++;
    }
  }

  const staleIds = findStaleChapterIds(existing, providerNumbers, matchedIds, expectedCount);
  if (staleIds.length > 0) {
    await tx.chapter.deleteMany({ where: { id: { in: staleIds } } });
    logger.info(`Cleaned up ${staleIds.length} stale PENDING chapters for manga ${mangaId}`);
  }

  if (toCreate.length > 0) {
    const maxIndex = existing.reduce((max, ch) => Math.max(max, ch.index), 0);
    const records = buildNewChapterRecords(mangaId, toCreate, maxIndex);
    const batchSize = 50;
    for (let i = 0; i < records.length; i += batchSize) {
      // eslint-disable-next-line no-await-in-loop -- sequential batch inserts within transaction
      await tx.chapter.createMany({ data: records.slice(i, i + batchSize), skipDuplicates: true });
    }
  }

  const preserved = existing.length - updated - staleIds.length;
  if (shadowSkipped > 0) {
    logger.info(`[enrichmentPipeline] Skipped ${shadowSkipped} provider chapter(s) for manga ${mangaId} that would shadow existing file-attached row(s)`);
  }
  return { updated, created: toCreate.length, preserved };
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/**
 * Title-normalization key for the secondary dedup pass.
 *
 * Lowercase, strip leading "chapter N: " / "ch. N - " prefixes that some
 * providers attach, collapse whitespace and punctuation to a single space.
 * Returns null when the result is empty or matches a generic placeholder
 * like "chapter 12" — collapsing on generic titles would over-merge.
 */
function normalizeTitleForDedup(title: string | undefined): string | null {
  if (!title) return null;
  let s = title.toLowerCase().trim();
  s = s.replace(/^(?:chapter|ch\.?|episode|ep\.?)\s*\d+(?:\.\d+)?\s*[:.-]?\s*/i, '');
  s = s.replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  if (s.length < 3) return null;
  if (/^(?:chapter|ch|episode|ep)\s*\d+$/.test(s)) return null;
  return s;
}

/**
 * Primary dedup by chapter number; secondary dedup by (normalized title, releaseDate).
 *
 * Secondary pass exists because two providers can emit the *same physical
 * chapter* under different chapter-number schemes — e.g. Sweat and Soap
 * where ComicVine numbers ch 53‑62 and MangaDex numbers the same chapters
 * 7‑16 (both with `releaseDate = 2021-07-30`, title "A Morning of
 * Beginnings" etc.). The primary `chapterNumber` key keeps both; the
 * secondary `(title, releaseDate)` key collapses them, keeping the lowest
 * chapter number (MangaDex's continuous numbering is preferred over CV's
 * inflated scheme).
 */
function deduplicateChapters<T extends { chapterNumber?: string; title?: string; pages?: number; releaseDate?: string }>(
  chapters: T[],
): T[] {
  const seen = new Map<number, T>();
  for (const ch of chapters) {
    if (!ch.chapterNumber) continue;
    const num = parseFloat(ch.chapterNumber);
    if (isNaN(num)) continue;
    const prev = seen.get(num);
    if (!prev || hasMoreData(ch, prev)) seen.set(num, ch);
  }
  const primary = [...seen.values()];

  const byTitleDate = new Map<string, T>();
  const passthrough: T[] = [];
  for (const ch of primary) {
    const normTitle = normalizeTitleForDedup(ch.title);
    if (!normTitle || !ch.releaseDate) { passthrough.push(ch); continue; }
    const key = `${normTitle}|${ch.releaseDate}`;
    const prev = byTitleDate.get(key);
    if (!prev) { byTitleDate.set(key, ch); continue; }
    const prevNum = parseFloat(prev.chapterNumber ?? '');
    const curNum = parseFloat(ch.chapterNumber ?? '');
    if (!isNaN(curNum) && (isNaN(prevNum) || curNum < prevNum)) {
      byTitleDate.set(key, ch);
    }
  }
  const deduped = [...passthrough, ...byTitleDate.values()];

  if (deduped.length < chapters.length) {
    logger.info(`[enrichmentPipeline] Deduplicated chapters: ${chapters.length} → ${primary.length} (primary) → ${deduped.length} (secondary)`);
  }
  return deduped;
}

/** Compare which chapter entry has more metadata fields populated */
function hasMoreData(a: { title?: string; pages?: number }, b: { title?: string; pages?: number }): boolean {
  let scoreA = 0;
  let scoreB = 0;
  if (a.title) scoreA++;
  if (b.title) scoreB++;
  if (a.pages) scoreA++;
  if (b.pages) scoreB++;
  return scoreA > scoreB;
}

/** Infer total chapter count from volume data when scalar count is unavailable */
function inferChapterCountFromVolumes(
  granularVolumes: Array<{ endChapter?: string; chapterCount?: number }>,
  totalChapters: number | undefined,
): number {
  if (totalChapters && totalChapters > 0) return totalChapters;
  let maxChapter = 0;
  for (const vol of granularVolumes) {
    if (vol.endChapter) {
      const end = parseFloat(vol.endChapter);
      if (!isNaN(end) && end > maxChapter) maxChapter = end;
    }
  }
  if (maxChapter > 0) return Math.ceil(maxChapter);
  let totalFromCounts = 0;
  for (const vol of granularVolumes) {
    if (vol.chapterCount) totalFromCounts += vol.chapterCount;
  }
  return totalFromCounts;
}

/** Build lookup of granular chapter titles by chapter number */
function buildGranularTitleMap(
  granularChapters: Array<{
    chapterNumber?: string; title?: string; pages?: number;
    source?: string; language?: string;
  }>,
): Map<number, { title?: string; pages: number }> {
  const titleMap = new Map<number, { title?: string; pages: number }>();
  for (const ch of granularChapters) {
    if (!ch.chapterNumber) continue;
    const entry: { title?: string; pages: number } = { pages: ch.pages ?? 0 };
    if (ch.title) entry.title = ch.title;
    titleMap.set(parseFloat(ch.chapterNumber), entry);
  }
  return titleMap;
}

// ---------------------------------------------------------------------------
// Volume persistence
// ---------------------------------------------------------------------------

/** Persist normalized volumes to database */
async function persistVolumes(
  mangaId: number,
  granularVolumes: Array<{
    volumeNumber: string; title?: string; description?: string; coverImage?: string;
    startChapter?: string; endChapter?: string; chapterRange?: string; chapterCount?: number;
    isbn?: string; pageCount?: number; releaseDate?: string; id?: string;
  }>,
  sources?: string[],
): Promise<void> {
  if (granularVolumes.length === 0) return;
  const volumeData = buildVolumeData(granularVolumes);
  if (volumeData.length === 0) return;

  const sourceList = sources ?? [];
  const source = sourceList.includes('comicvine') ? 'comicvine' as const
    : sourceList.includes('anilist') ? 'anilist' as const
    : 'anilist' as const;
  await persistNormalizedVolumes({
    mangaId,
    volumes: volumeData as import('@/types/search-types/metadata.types').EnhancedVolumeData[],
    source,
  });
  logger.info(`Persisted ${volumeData.length} volumes for manga ${mangaId}`);
}

/** Build a single volume data entry */
function buildVolumeEntry(vol: {
  volumeNumber: string; title?: string; description?: string; coverImage?: string;
  startChapter?: string; endChapter?: string; chapterRange?: string; chapterCount?: number;
  isbn?: string; pageCount?: number; releaseDate?: string; id?: string;
}): Record<string, unknown> & { number: number } {
  const entry: Record<string, unknown> & { number: number } = {
    number: parseInt(vol.volumeNumber, 10),
  };
  if (vol.title && !isPlaceholderVolumeTitle(vol.title)) entry['title'] = vol.title;
  if (vol.description) entry['description'] = vol.description;
  if (vol.coverImage) entry['coverImage'] = vol.coverImage;
  if (vol.startChapter) {
    const start = parseFloat(vol.startChapter);
    if (!isNaN(start) && start > 0) entry['chapterStart'] = start;
  } else if (vol.chapterRange) {
    const parts = parseChapterRange(vol.chapterRange);
    if (parts) entry['chapterStart'] = parts.start;
  }
  if (vol.endChapter) {
    const end = parseFloat(vol.endChapter);
    if (!isNaN(end) && end > 0) entry['chapterEnd'] = end;
  } else if (vol.chapterRange) {
    const parts = parseChapterRange(vol.chapterRange);
    if (parts) entry['chapterEnd'] = parts.end;
  }
  if (vol.chapterCount !== undefined) entry['totalChapters'] = vol.chapterCount;
  if (vol.isbn) entry['isbn'] = vol.isbn;
  if (vol.pageCount !== undefined) entry['pageCount'] = vol.pageCount;
  if (vol.releaseDate) entry['releaseDate'] = vol.releaseDate;
  if (vol.id) entry['sourceId'] = vol.id;
  return entry;
}

/** Parse a chapter range string like "1-10" or "1–10", rejecting invalid/negative values */
function parseChapterRange(range: string): { start: number; end: number } | null {
  // Match "number separator number" where separator is dash/en-dash/em-dash
  const match = range.match(/^(\d+(?:\.\d+)?)\s*[-–—]\s*(\d+(?:\.\d+)?)$/);
  if (!match?.[1] || !match[2]) return null;
  const start = parseFloat(match[1]);
  const end = parseFloat(match[2]);
  if (isNaN(start) || isNaN(end) || start <= 0 || end <= 0 || end < start) return null;
  return { start, end };
}

/** Build volume data array from granular volumes */
function buildVolumeData(
  granularVolumes: Array<{
    volumeNumber: string; title?: string; description?: string; coverImage?: string;
    startChapter?: string; endChapter?: string; chapterRange?: string; chapterCount?: number;
    isbn?: string; pageCount?: number; releaseDate?: string; id?: string;
  }>,
): Array<Record<string, unknown> & { number: number }> {
  return granularVolumes
    .map(buildVolumeEntry)
    .filter((v) => !isNaN(v.number) && v.number > 0);
}
