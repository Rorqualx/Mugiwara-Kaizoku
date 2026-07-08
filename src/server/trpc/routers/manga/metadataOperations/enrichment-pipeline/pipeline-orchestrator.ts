// @file-size-justified: central pipeline orchestrator; phases are tightly coupled to sequencing decisions — splitting would obscure the readable order of operations

/**
 * Enrichment Pipeline Orchestrator
 *
 * Coordinates the enrichment pipeline phases:
 * 1.   Provider fetch (AniList + MangaDex metadata + ComicVine + Fandom + Wikipedia)
 * 2.   DB persistence (chapters/volumes from provider data) — always runs
 * 2.5  Chapter reconciliation (creates PENDING chapters from all Phase 1 sources)
 * 3.   Cross-validate volume ranges from all sources
 * 4.   Persist validated volume ranges + assign chapters
 * 5.   Fandom enrichment (per-chapter covers, descriptions)
 * 6.   Safety net (reconcile missing volumes + correct assignments)
 * 7.   Finalize (volume covers, cache invalidation)
 *
 * Architecture: Collect → Normalize → Validate → Store
 * Each source produces VolumeRangeProposals, which are cross-validated
 * into a single ground truth before persistence. No more phase-override chain.
 */

import { prisma } from '@/server/db';
import { computeMangaCompleteness, formatCompletenessLine } from '@/server/services/completeness/manga-completeness';
import { withTimeoutOrNull } from '@/server/services/shared/with-timeout';
import { parseChaptersFromDescription } from '@/utils/comicvine-chapter-parser';
import { logger } from '@/utils/logger';

import { filterFandomChaptersByCrossSeriesGate } from './cross-series-gate';
import { withEnrichmentLock } from './enrichment-lock';
import { reassignBonusChaptersToParentVolumes } from './phase-bonus-reassignment';
import { reconcileChapterCount, mergeAllSourceChapters } from './phase-chapter-reconciliation';
import { assembleSourceData, resolveTrustedFinalChapter, plausibleTrustedCeiling, type StoredTerminalSignal } from './phase-data-assembly';
import { phaseDbPersistence } from './phase-db-persistence';
import { phaseFandomEnrichment } from './phase-fandom-enrichment';
import { phaseFinalize } from './phase-finalize';
import { phaseProviderFetch } from './phase-provider-fetch';
import { collectVolumeRangeProposals, crossValidateVolumeRanges } from './phase-volume-cross-validation';
import { resolveExpectedChapterCount } from './phase-volume-cross-validation/chapter-consensus-resolver';
import { resolveExpectedVolumeCount } from './phase-volume-cross-validation/consensus-resolver';
import { assignOverflowChapters } from './phase-volume-overflow';
import { pruneOutOfRangeChapters, pruneOutOfRangeVolumes, removeEmptyPhantomVolumes } from './phase-volume-phantom-prune';
import { reconcileMissingVolumeRecords, fillEmptyVolumeRanges, correctVolumeAssignments, reassignNullNumberedVolumeArchives } from './phase-volume-reconciliation';
import { pruneRedundantVolumeFileStubs } from './phase-volume-stub-cleanup';
import { applyFandomVolumeFields, resolveFandomUrl } from './pipeline-orchestrator/fandom-volume-fields';
import { persistValidatedVolumeRanges } from './pipeline-orchestrator/volume-persistence';
import { maybePlausibilityCheck, maybeSyncSuwayomiChapters, maybeTriggerAutoDownload } from './post-enrichment-hooks';
import { isBonusTitle } from './types';

import type { ValidatedVolumeRange } from './phase-volume-cross-validation';
import type { BonusChapterInfo, ChapterDataItem, EnrichmentProgress, EnrichmentPipelineOptions, EnrichmentPipelineResult, UnifiedProviderResults, VolumeDataItem } from './types';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert MangaDex aggregate volume data into ChapterDataItem[] for fusion.
 * Each volume's chapter range produces individual chapter entries with volume assignment.
 */
function extractMangaDexChapters(result: UnifiedProviderResults): ChapterDataItem[] {
  const volumes = result.mangadexAggregate?.volumes;
  if (!volumes || volumes.length === 0) return [];

  const chapters: ChapterDataItem[] = [];
  for (const vol of volumes) {
    for (let n = Math.floor(vol.chapterStart); n <= Math.floor(vol.chapterEnd); n++) {
      chapters.push({ number: n, volume: vol.volumeNumber });
    }
  }
  return chapters;
}

/**
 * Load the stored terminal signal + AniList volume anchor in one query. The
 * stored endDate/status/chapters act as a last-resort trusted ceiling when live
 * providers report a finished series as ongoing (Berserk reads RELEASING on
 * AniList); the volumes field is the cross-validation fallback anchor.
 */
async function loadStoredTerminalSignal(mangaId: number): Promise<StoredTerminalSignal & { volumes: number | null }> {
  const row = await prisma.manga.findUnique({
    where: { id: mangaId },
    select: { publicationStatus: true, Metadata: { select: { endDate: true, chapters: true, volumes: true } } },
  });
  return {
    endDate: row?.Metadata?.endDate ?? null,
    status: row?.publicationStatus ?? null,
    chapters: row?.Metadata?.chapters ?? null,
    volumes: row?.Metadata?.volumes ?? null,
  };
}

/**
 * Resolve the volume cross-validation gate context: the chapter ceiling (exact
 * for a finished series, broken-scalar-safe), whether it's trusted, and the
 * expected volume count (with the persisted AniList volume anchor as fallback).
 * The stored terminal signal lets the gate clamp a series whose LIVE provider
 * data reads ongoing (Berserk).
 */
async function resolveVolumeGateContext(
  mangaId: number,
  result: UnifiedProviderResults,
): Promise<{ expectedChapterCount: number | null; volumeTrusted: boolean; expectedVolumeCount: number }> {
  const storedAnchor = await loadStoredTerminalSignal(mangaId);
  const { expectedChapterCount, trusted: volumeTrusted } = resolveVolumeGateCeiling(result, storedAnchor);
  const dbAlVolumes = storedAnchor.volumes;
  const fallbackAlVolumes = dbAlVolumes !== null && dbAlVolumes > 0 ? dbAlVolumes : undefined;
  const expectedVolumeCount = extractExpectedVolumeCount(result, fallbackAlVolumes);
  return { expectedChapterCount, volumeTrusted, expectedVolumeCount };
}

/**
 * Build merged source chapters from Phase 1 results and run reconciliation.
 * Computes expectedChapterCount using assembleSourceData, then creates
 * PENDING chapters for any chapter numbers missing from the database.
 */
async function reconcileFromProviderResults(
  mangaId: number,
  result: UnifiedProviderResults,
  onProgress?: EnrichmentProgress,
): Promise<void> {
  const rawFandomChapters = result.fandomResult?.chapterList ?? [];
  const wikiChapters = result.wikipediaResult?.chapterList ?? [];
  const mangadexChapters = extractMangaDexChapters(result);
  const anilistChapterCount = (result.enrichmentResult.enrichedData as { manga?: { chapters?: number } } | undefined)
    ?.manga?.chapters ?? 0;

  // Multi-series wiki gate: prefer AniList as the upper-bound reference (its
  // chapter count is the most accurate; spin-offs are indexed separately).
  // Fall back to MangaDex only when AniList is unavailable. Earlier this gate
  // was MangaDex-only, which discarded valid Fandom chapter lists when
  // MangaDex's English feed was incomplete (e.g. Twin Star Exorcists had
  // AL=134/Fandom=135/MDX=12 → MDX rule misfired and dropped 13 real chapters).
  // Mirrors the same tiered logic in phase-provider-fetch's `shouldGate`.
  const FANDOM_OVERFLOW_RATIO = 2.0;
  const FANDOM_OVERFLOW_MIN_AL = 2;
  const FANDOM_OVERFLOW_MIN_MANGADEX = 10;
  const FANDOM_TIGHT_RATIO = 1.5;
  const FANDOM_ABS_OVERFLOW = 40;
  const FANDOM_TIGHT_MIN_AL = 30;
  const fandomChapters = filterFandomChaptersByCrossSeriesGate(
    mangaId,
    rawFandomChapters,
    { mangadex: mangadexChapters.length, anilist: anilistChapterCount },
    {
      ratio: FANDOM_OVERFLOW_RATIO, minAniList: FANDOM_OVERFLOW_MIN_AL, minMangaDex: FANDOM_OVERFLOW_MIN_MANGADEX,
      tightRatio: FANDOM_TIGHT_RATIO, absOverflow: FANDOM_ABS_OVERFLOW, tightMinAniList: FANDOM_TIGHT_MIN_AL,
    },
  );

  const dbChapterCount = await prisma.chapter.count({ where: { mangaId } });
  // Stored terminal signal — last-resort trusted ceiling when live providers
  // report no terminal status (e.g. Berserk reads RELEASING on AniList yet the
  // library already knows it concluded via stored endDate + chapter count).
  const stored = await loadStoredTerminalSignal(mangaId);
  const sourceData = assembleSourceData(result, dbChapterCount, stored);
  // ComicVine chapters live inside sourceData.sources.comicvine (parsed from
  // per-vol descriptions by parseComicVineDescriptions). The previous
  // call passed only fandom/wiki/mangadex, silently dropping every CV chapter
  // title — for OP Colored this meant vols 101+ (CV's only source) ended up
  // with valid Volume rows but no Chapter rows for chs 1016-1133.
  const comicvineChapters = sourceData.sources.comicvine;

  // No source chapter data — nothing to reconcile
  if (fandomChapters.length === 0 && wikiChapters.length === 0
      && mangadexChapters.length === 0 && comicvineChapters.length === 0) return;

  const merged = mergeAllSourceChapters(
    sourceData.expectedChapterCount, sourceData.trustedFinalChapter ?? null,
    fandomChapters, wikiChapters, mangadexChapters, comicvineChapters,
  );

  await onProgress?.('reconciling', `Reconciling ${merged.length} source chapters against DB...`);
  const created = await reconcileChapterCount(
    mangaId, merged, sourceData.expectedChapterCount,
  );
  if (created > 0) {
    logger.info(`[enrichmentPipeline] Reconciliation created ${created} chapters for manga ${mangaId}`);
  }
}

// ============================================================================
// Cross-Validated Volume Persistence
// ============================================================================

/**
 * Extract ComicVine granular volumes from the enrichment result.
 * These come from Phase 2 DB persistence and have startChapter/endChapter
 * from the ComicVine volume mapper (Phase A fix).
 *
 * Falls back to stored providerMetadata.comicvine.volumeData only when the
 * stored binding's volumeId matches the current run's matched volumeId —
 * prevents re-applying stale data from a prior wrong match when the current
 * run legitimately produced no match (e.g. language guard rejection).
 */
async function extractComicVineVolumes(mangaId: number, result: UnifiedProviderResults): Promise<Array<Record<string, unknown>>> {
  const enrichedData = result.enrichmentResult.enrichedData as Record<string, unknown> | undefined;
  const unifiedManga = enrichedData?.['manga'] as Record<string, unknown> | undefined;
  const volumes = (unifiedManga?.['volumes'] ?? []) as Array<Record<string, unknown>>;
  const sources = (unifiedManga?.['sources'] ?? []) as string[];
  // Use fresh enrichment result if ComicVine ran this cycle
  if (sources.includes('comicvine') && volumes.length > 0) return volumes;

  // Fallback: only trust cached volumeData when the current run confirms the
  // same ComicVine volume binding (API transient failure / no-key scenarios).
  // Without this parity check, a prior wrong match (e.g. "Asshou"→Ao Ashi)
  // would get silently re-applied every time the matcher legitimately rejects
  // the correct volume (e.g. language guard on a JP-only manga).
  const currentVolumeId = result.comicvineResult?.volumeId;
  if (currentVolumeId === undefined) return [];

  const manga = await prisma.manga.findUnique({
    where: { id: mangaId },
    select: { providerMetadata: true },
  });
  const pm = manga?.providerMetadata as Record<string, unknown> | null;
  const comicvine = pm?.['comicvine'] as Record<string, unknown> | undefined;
  const cachedVolumeId = comicvine?.['volumeId'];
  if (cachedVolumeId !== currentVolumeId) return [];

  const storedVolumeData = comicvine?.['volumeData'] as Array<Record<string, unknown>> | undefined;
  if (storedVolumeData && storedVolumeData.length > 0) {
    // Filter to volumes with chapter ranges (skip empty shells like vol 15-18)
    const withRanges = storedVolumeData.filter(v =>
      v['chapterStart'] !== undefined && v['chapterEnd'] !== undefined,
    );
    if (withRanges.length > 0) {
      logger.info(`[enrichmentPipeline] Using ${withRanges.length} stored ComicVine volume ranges (API unavailable, volumeId=${String(currentVolumeId)} parity confirmed)`);
      return withRanges;
    }
  }

  return [];
}

/**
 * Extract bonus chapter titles per volume from ComicVine descriptions.
 *
 * Identifies bonus chapters by their title pattern (e.g., "Extra Evil",
 * "Bonus Story") rather than relying on the difference between parsed count
 * and validated range count. This works correctly regardless of whether
 * the volume range already accounts for bonus chapters.
 */
/**
 * iter-PVM-1: walk CV volume rows and surface a `chapters: number[]` field
 * derived from each volume's description's Contents listing. Pure pass-through
 * for rows without parsable descriptions. Lets `extractComicVineProposals`
 * emit per-chapter signal without changing the upstream provider fetch.
 */
function enrichComicVineWithChapterList(
  comicvineVolumes: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  return comicvineVolumes.map(vol => {
    const desc = vol['description'];
    if (typeof desc !== 'string' || desc.length === 0) return vol;
    const parsed = parseChaptersFromDescription(desc);
    const nums = parsed
      .filter(ch => ch.hasRealNumber)
      .map(ch => ch.chapterNumber)
      .filter(n => typeof n === 'number' && n > 0)
      .sort((a, b) => a - b);
    if (nums.length === 0) return vol;
    return { ...vol, chapters: nums };
  });
}

function extractBonusTitleMap(
  comicvineVolumes: Array<Record<string, unknown>>,
  validatedRanges: ValidatedVolumeRange[],
): Map<number, BonusChapterInfo[]> {
  // Build lookup: volumeNumber → chapterEnd from cross-validated ranges
  const rangeByVolume = new Map<number, number>();
  for (const r of validatedRanges) {
    rangeByVolume.set(r.volumeNumber, r.chapterEnd);
  }

  const map = new Map<number, BonusChapterInfo[]>();
  for (const vol of comicvineVolumes) {
    const volNum = Number(vol['number'] ?? vol['volumeNumber'] ?? 0);
    if (volNum <= 0) continue;
    const desc = vol['description'] as string | undefined;
    if (!desc) continue;

    const chapterEnd = rangeByVolume.get(volNum);
    if (chapterEnd === undefined || chapterEnd <= 0) continue;

    const parsed = parseChaptersFromDescription(desc);
    if (parsed.length === 0) continue;

    // Identify bonus chapters by their title pattern. Skip entries whose
    // chapterNumber was parsed from an explicit "Chapter N:" prefix — those
    // are main chapters even if their title incidentally matches a bonus
    // keyword (e.g. "Chapter 738: Trebol Army, Special Officer Sugar"
    // matches /\bspecial\b/ but is a regular numbered chapter).
    const bonusEntries = parsed.filter(ch => !ch.hasRealNumber && isBonusTitle(ch.title));
    // Skip if no bonuses or too many (likely a data mismatch)
    if (bonusEntries.length === 0 || bonusEntries.length > 5) continue;

    const bonusInfos = bonusEntries.map((ch, i): BonusChapterInfo => ({
      title: ch.title,
      chapterNumber: chapterEnd + (i + 1) * 0.1,
      volumeNumber: volNum,
    }));
    map.set(volNum, bonusInfos);
  }
  return map;
}

// ============================================================================
// Volume Cover Enrichment
// ============================================================================

/**
 * Build a volume-number → coverImage URL map from all sources.
 * Priority: ComicVine (highest) > Fandom > Wikipedia (none).
 */
function buildVolumeCoverMap(
  comicvineVolumes: Array<Record<string, unknown>>,
  fandomVolumes: VolumeDataItem[],
): Map<number, string> {
  const coverMap = new Map<number, string>();

  // Fandom first (lower priority — will be overwritten by ComicVine)
  for (const fv of fandomVolumes) {
    if (fv.coverImage && typeof fv.number === 'number') {
      coverMap.set(fv.number, fv.coverImage);
    }
  }

  // ComicVine second (higher priority — overwrites Fandom)
  for (const cv of comicvineVolumes) {
    const num = cv['number'] as number | undefined;
    const cover = cv['coverImage'] as string | undefined;
    if (cover && typeof num === 'number') {
      coverMap.set(num, cover);
    }
  }

  return coverMap;
}

/**
 * Apply cover images to Volume records that are missing them.
 * Creates Volume records for volumes that exist in the coverMap but not in the DB
 * (e.g., Fandom has 29 volumes but ComicVine only created 15).
 *
 * @param expectedVolumeCount - Max expected volume count from AniList/Wikipedia (0 = unknown)
 */
async function applyVolumeCoverImages(
  mangaId: number,
  coverMap: Map<number, string>,
  expectedVolumeCount: number,
): Promise<void> {
  // Create Volume records for volumes in coverMap that don't exist yet
  const allVolumes = await prisma.volume.findMany({
    where: { mangaId },
    select: { number: true, coverImage: true },
  });
  const existingNumbers = new Set(allVolumes.map(v => v.number));

  // Guard: reject volumes beyond expected count + 10% tolerance
  const maxVolume = expectedVolumeCount > 0 ? Math.ceil(expectedVolumeCount * 1.1) : Infinity;
  const toCreate: number[] = [];
  for (const volNum of coverMap.keys()) {
    if (!existingNumbers.has(volNum) && volNum <= maxVolume) toCreate.push(volNum);
  }
  const rejected = [...coverMap.keys()].filter(v => !existingNumbers.has(v) && v > maxVolume);
  if (rejected.length > 0) {
    logger.warn(
      `[enrichmentPipeline] Rejected ${rejected.length} volume cover entries beyond expected count ` +
      `${expectedVolumeCount} (max ${maxVolume}) for manga ${mangaId}: ${rejected.slice(0, 5).join(', ')}...`,
    );
  }
  if (toCreate.length > 0) {
    await prisma.volume.createMany({
      data: toCreate.map(number => ({ mangaId, number })),
      skipDuplicates: true,
    });
    logger.info(`[enrichmentPipeline] Created ${toCreate.length} missing Volume records for cover application: ${toCreate.join(', ')}`);
  }

  // Apply covers to volumes that don't have one yet
  const needsCover = toCreate.length > 0
    ? await prisma.volume.findMany({ where: { mangaId, coverImage: null }, select: { number: true } })
    : allVolumes.filter(v => v.coverImage === null);

  const updates: Array<ReturnType<typeof prisma.volume.updateMany>> = [];
  for (const v of needsCover) {
    const coverImage = coverMap.get(v.number);
    if (coverImage) {
      updates.push(
        prisma.volume.updateMany({
          where: { mangaId, number: v.number },
          data: { coverImage },
        }),
      );
    }
  }

  if (updates.length > 0) {
    await Promise.all(updates);
    logger.info(`[enrichmentPipeline] Applied cover images to ${updates.length} volumes for manga ${mangaId}`);
  }
}

/**
 * Build a volume-number → pageCount map from Fandom volume data.
 * Fandom is the only source that reliably publishes per-volume page counts
 * (ComicVine issues don't, Wikipedia volume lists don't).
 */
function buildVolumePageCountMap(fandomVolumes: VolumeDataItem[]): Map<number, number> {
  const map = new Map<number, number>();
  for (const fv of fandomVolumes) {
    if (fv.pageCount !== undefined && fv.pageCount > 0) {
      map.set(fv.number, fv.pageCount);
    }
  }
  return map;
}

/**
 * Sum the per-volume chapter counts from the MangaDex aggregate. Used as the
 * contamination-gate floor in Phase 2 — represents the total number of
 * actually-uploaded chapters across every language.
 */
function getMangaDexAggregateCount(result: UnifiedProviderResults): number {
  return result.mangadexAggregate?.volumes.reduce((sum, v) => sum + v.chapterCount, 0) ?? 0;
}

/**
 * Phase 5: per-chapter Fandom enrichment, capped at 90s. Skips when Phase 1's
 * multi-series gate fired (Fandom URL discovered but chapterList wiped) — re-running
 * discovery would just re-bind the same wiki and re-pull the same data.
 */
async function runFandomEnrichmentPhase(ctx: {
  mangaId: number;
  title: string;
  result: UnifiedProviderResults;
  onProgress: EnrichmentProgress | undefined;
  options: EnrichmentPipelineOptions | undefined;
  expectedVolumeCount: number;
  expectedChapterCount: number | null;
}): Promise<void> {
  const { mangaId, title, result, onProgress, options, expectedVolumeCount, expectedChapterCount } = ctx;
  const fandomGated = result.fandomResult !== null
    && result.fandomResult.chapterList.length === 0;
  if (fandomGated) {
    logger.info(`[enrichmentPipeline] Skipping Fandom enrichment phase for manga ${mangaId} — Phase 1 gate fired (cross-series wiki)`);
  } else {
    await onProgress?.('fandom', 'Enriching with Fandom data...');
    await withTimeoutOrNull(
      phaseFandomEnrichment(mangaId, title, onProgress, options, expectedVolumeCount, expectedChapterCount ?? undefined),
      90_000,
      'fandom-enrichment',
    );
  }
  // Always run the standalone gallery harvest. Reaches gated titles AND titles
  // where Phase 2 timed out before its inline harvest could fire (Bleach,
  // long-running multi-source enrichments). Idempotent — unions with whatever
  // the inline harvest already wrote.
  await runStandaloneGalleryHarvest(mangaId, title);
}

/**
 * When the Phase 1 gate prevents Phase 2 Fandom enrichment from running,
 * still attempt a standalone gallery harvest. Discovers the wiki URL fresh,
 * then harvests gallery URLs via the MediaWiki API.
 */
async function runStandaloneGalleryHarvest(mangaId: number, title: string): Promise<void> {
  try {
    const { discoverFandomWikiUrl } = await import('./wiki-discovery');
    const { harvestFandomGalleryDirect } = await import('./phase-fandom-enrichment');
    const fandomUrl = await discoverFandomWikiUrl(mangaId, title);
    if (!fandomUrl) return;
    await harvestFandomGalleryDirect(mangaId, fandomUrl, title);
  } catch (err: unknown) {
    logger.warn(`[enrichmentPipeline] Standalone gallery harvest failed for manga ${mangaId} (non-critical): ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Compute expected chapter count from available sources.
 */
function computeExpectedChapterCount(result: UnifiedProviderResults): number | null {
  const wikiChapters = result.wikipediaResult?.data.chapters;
  if (wikiChapters && wikiChapters > 0) return wikiChapters;

  const metadata = result.enrichmentResult.appliedMatch?.metadata as Record<string, unknown> | undefined;
  const scalar = typeof metadata?.['chapters'] === 'number' ? metadata['chapters'] as number : 0;
  return scalar > 0 ? scalar : null;
}

/**
 * Resolve the volume-gate chapter ceiling for cross-validation.
 *
 * A finished series with a plausible trusted scalar clamps the ceiling to its
 * known final chapter and switches the gate to exact (no 1.1× tolerance), so an
 * end-of-series phantom volume (AoT "Volume 35" @ ch 140 past the real 139) is
 * rejected. plausibleTrustedCeiling ignores a broken scalar (Black Clover
 * chapters=1) so a real volume structure is never gated away.
 */
function resolveVolumeGateCeiling(
  result: UnifiedProviderResults,
  stored?: StoredTerminalSignal,
): { expectedChapterCount: number | null; trusted: boolean } {
  const rawExpected = computeExpectedChapterCount(result);
  const ceiling = plausibleTrustedCeiling(resolveTrustedFinalChapter(result, stored).ceiling, rawExpected ?? 0);
  if (ceiling === null) return { expectedChapterCount: rawExpected, trusted: false };
  return { expectedChapterCount: Math.min(rawExpected ?? ceiling, ceiling), trusted: true };
}

/**
 * Extract the expected volume count from cross-source consensus.
 *
 * Thin wrapper around `resolveExpectedVolumeCount`; preserved as a
 * scalar return for the many downstream callers that only need the
 * count. Consumers that need confidence/sources should call the
 * resolver directly.
 *
 * iter-PVM-N-tune-1: when `fallbackAniListVolumes` (persisted
 * Metadata.volumes from a prior run) is supplied, it enters the
 * candidate set as `anilist-db`. The applied match's metadata can drop
 * the volumes field on cached fetches; the DB anchor is authoritative
 * and prevents min-fallback from picking a 1-vol WP outlier when AL is
 * temporarily absent.
 */
function extractExpectedVolumeCount(
  result: UnifiedProviderResults,
  fallbackAniListVolumes?: number,
): number {
  return resolveExpectedVolumeCount(result, fallbackAniListVolumes).count;
}

/**
 * Execute enrichment phases after provider fetch.
 *
 * Architecture: Collect -> Normalize -> Validate -> Store
 */
// eslint-disable-next-line max-lines-per-function -- Orchestrates 7 enrichment phases sequentially; each phase call is a discrete step and splitting further would scatter state (volumeCount, coverMap, validatedRanges) across helpers without clarity gain
async function executeEnrichmentPhases(
  mangaId: number,
  _title: string,
  result: UnifiedProviderResults,
  onProgress?: EnrichmentProgress,
  options?: EnrichmentPipelineOptions,
): Promise<void> {
  // Phase 2: DB persistence (metadata + chapters/volumes from providers).
  // Pass the MangaDex aggregate chapter total so phaseDbPersistence's contamination
  // gate has a reference floor independent of AniList — MangaDex publishes one
  // entry per actually-uploaded chapter across every language.
  await onProgress?.('persisting', 'Persisting provider data to database...');
  // Compute cross-source chapter-count consensus to cap stub-row creation when
  // AniList's scalar overshoots (e.g. Sweat and Soap AL=110 vs canon=66).
  // Confidence high/medium acts as a ceiling on `expectedCount`; low/unknown
  // leaves prior behavior untouched.
  // Bonus chapters (decimal chapterNumbers like 5.1, 64.5) account for the
  // gap between providers that count them (MAL: 104) and those that don't
  // (CV: 97). Counting current DB bonus stubs widens the cluster window so
  // a count-with-bonuses isn't rejected as an outlier in the consensus.
  const bonusRows = await prisma.$queryRaw<Array<{ n: bigint }>>`
    SELECT COUNT(*)::bigint AS n FROM "Chapter"
    WHERE "mangaId" = ${mangaId}
      AND "chapterNumber" IS NOT NULL
      AND "chapterNumber" <> FLOOR("chapterNumber")
  `;
  const bonusChapterCount = Number(bonusRows[0]?.n ?? 0);
  const chapterConsensus = resolveExpectedChapterCount(result, undefined, bonusChapterCount);
  logger.info(`[enrichmentPipeline] chapterConsensus for manga ${mangaId}: count=${chapterConsensus.count}, confidence=${chapterConsensus.confidence}, sources=${chapterConsensus.sources.join(',')}, bonusHint=${bonusChapterCount}`);
  await phaseDbPersistence(mangaId, result.enrichmentResult, onProgress, getMangaDexAggregateCount(result), chapterConsensus);

  // Phase 2.5: Chapter reconciliation (merge Fandom + Wikipedia chapters)
  await reconcileFromProviderResults(mangaId, result, onProgress);

  // Phase 3: COLLECT proposals from all sources
  await onProgress?.('validating', 'Cross-validating volume ranges...');
  const comicvineVolumes = await extractComicVineVolumes(mangaId, result);
  const wikiVolumes = (result.wikipediaResult?.data.volumeList ?? []).map(wv => {
    const chNums = wv.chapters
      .map(c => typeof c.number === 'number' ? c.number : parseFloat(String(c.number)))
      .filter((n): n is number => !isNaN(n) && n > 0)
      .sort((a, b) => a - b);
    const first = chNums[0];
    const last = chNums[chNums.length - 1];
    const wvAny = wv as unknown as Record<string, unknown>;
    return {
      number: wv.number,
      chapters: wv.chapters.map(c => ({ number: c.number })),
      ...(first !== undefined && last !== undefined ? { chapterStart: first, chapterEnd: last } : {}),
      ...(typeof wvAny['title'] === 'string' ? { title: wvAny['title'] as string } : {}),
      ...(typeof wvAny['description'] === 'string' ? { description: wvAny['description'] as string } : {}),
      ...(typeof wvAny['coverImage'] === 'string' ? { coverImage: wvAny['coverImage'] as string } : {}),
      // Wikipedia uses `originalReleaseDate` / `englishReleaseDate` — the unnamed
      // `releaseDate` is rare. Fall through so Fix 1's downstream persistence fires.
      ...(typeof wvAny['originalReleaseDate'] === 'string' ? { releaseDate: wvAny['originalReleaseDate'] as string }
        : typeof wvAny['englishReleaseDate'] === 'string' ? { releaseDate: wvAny['englishReleaseDate'] as string }
        : typeof wvAny['releaseDate'] === 'string' ? { releaseDate: wvAny['releaseDate'] as string }
        : {}),
      // Wikipedia volume rows often carry ISBN (extracted via the table-parser).
      // Prefer isbn13, fall back to isbn.
      ...(typeof wvAny['isbn13'] === 'string' ? { isbn: wvAny['isbn13'] as string }
        : typeof wvAny['isbn'] === 'string' ? { isbn: wvAny['isbn'] as string }
        : {}),
    };
  });
  const fandomVolumes = (result.fandomResult?.volumeList ?? []).map(fv => {
    const entry: { number: number; chapterStart?: number; chapterEnd?: number; title?: string; description?: string; coverImage?: string; releaseDate?: string; isbn?: string; pageCount?: number } = { number: fv.number };
    if (fv.chapterStart !== undefined) entry.chapterStart = fv.chapterStart;
    if (fv.chapterEnd !== undefined) entry.chapterEnd = fv.chapterEnd;
    if (fv.title !== undefined) entry.title = fv.title;
    if (fv.description !== undefined) entry.description = fv.description;
    if (fv.coverImage !== undefined) entry.coverImage = fv.coverImage;
    if (fv.releaseDate !== undefined) entry.releaseDate = fv.releaseDate;
    if (fv.isbn !== undefined) entry.isbn = fv.isbn;
    else if (fv.isbnEn !== undefined) entry.isbn = fv.isbnEn;
    if (fv.pageCount !== undefined) entry.pageCount = fv.pageCount;
    return entry;
  });

  const mangadexVolumes = result.mangadexAggregate?.volumes ?? [];
  // iter-PVM-1: surface per-chapter list on CV volume rows from their
  // description's Contents listing so proposals carry per-chapter granularity.
  const cvWithChapterList = enrichComicVineWithChapterList(comicvineVolumes);
  const proposals = collectVolumeRangeProposals(cvWithChapterList, wikiVolumes, fandomVolumes, mangadexVolumes);
  // iter-PVM-N-tune-1: thread persisted Metadata.volumes as fallback so the
  // AniList anchor stays in the candidate set even when the applied match
  // drops the field this run (cached fetches, partial-match path, etc.). Also
  // surfaces the stored terminal signal (endDate/status/chapters) so the gate can
  // clamp a finished series whose LIVE provider data reads ongoing (Berserk).
  const { expectedChapterCount, volumeTrusted, expectedVolumeCount } =
    await resolveVolumeGateContext(mangaId, result);

  // Phase 4: CROSS-VALIDATE + PERSIST validated volume ranges
  const validatedRanges = crossValidateVolumeRanges(
    proposals, expectedChapterCount, expectedVolumeCount, volumeTrusted,
  );
  if (validatedRanges.length > 0) {
    await persistValidatedVolumeRanges(mangaId, validatedRanges);
  }

  // Phase 4.5: Apply volume cover images from all sources
  const coverMap = buildVolumeCoverMap(comicvineVolumes, result.fandomResult?.volumeList ?? []);
  if (coverMap.size > 0) {
    await applyVolumeCoverImages(mangaId, coverMap, expectedVolumeCount);
  }

  // Phase 4.6: Fill Volume.pageCount / isbn / releaseDate from Fandom where DB has null.
  // Cross-validation only creates proposals for Fandom volumes with chapterStart/End
  // (see extractFandomProposals — the chapter-range filter), so wikis that publish
  // pageCount in the infobox but don't expose chapter ranges at the volume level
  // (Rent-a-Girlfriend, Nana, Bleach) silently lose the pageCount during merge.
  // This post-pass fills the gap without touching the chapter-range validation.
  const pageCountMap = buildVolumePageCountMap(result.fandomResult?.volumeList ?? []);
  const fandomUrl = await resolveFandomUrl(mangaId, _title, result.fandomResult?.url);
  await applyFandomVolumeFields(mangaId, fandomUrl, expectedVolumeCount, pageCountMap);

  // Phase 5: Fandom enrichment (per-chapter covers, descriptions, titles).
  // Capped at 90s — the batch-processor persists per-batch, so partial
  // completion still lands data in DB for downstream fills to consume.
  await runFandomEnrichmentPhase({
    mangaId, title: _title, result, onProgress, options, expectedVolumeCount, expectedChapterCount,
  });

  // Phase 6: Safety net (should rarely fire with cross-validation)
  // Use the stronger expectedVolumeCount (AniList + Wikipedia) instead of just Wikipedia list length
  const expectedVolCount = expectedVolumeCount > 0 ? expectedVolumeCount : null;
  // Pull NULL-numbered whole-volume archive rows into their real volume BEFORE reconciliation,
  // so they can't seed phantom "reconciliation" volumes (Dorohedoro v19-v23.zip → vols 24/25).
  await reassignNullNumberedVolumeArchives(mangaId);
  await reconcileMissingVolumeRecords(mangaId, expectedVolCount);
  await fillEmptyVolumeRanges(mangaId);
  await correctVolumeAssignments(mangaId);

  // Phase 6.2: iter-B1 — strip the ComicVine "sparse-then-dense" bug
  // where leading Vols 1-3 each claim chapterStart=chapterEnd while
  // Vols 4+ have proper multi-chapter spans. Runs AFTER
  // correctVolumeAssignments (so its orphan-unlink doesn't fire on the
  // chapters whose ranges we're about to NULL) and BEFORE
  // assignOverflowChapters (which only touches chapters past the last
  // volume; harmless either way).
  //
  // iter-B3: also runs the INTERLEAVED variant — sparse runs in the
  // middle of the volume sequence (Slime Vols 9-16 sandwiched between
  // dense Vols 5-8 and semi-dense Vol 17). Trailing-sparse runs are
  // deliberately preserved (ongoing-manga single-chapter tails).
  const { pruneSparseLeadingVolumeRanges, pruneInterleavedSparseVolumeRanges, pruneMajoritySparseVolumeRanges } = await import('./phase-volume-prune-sparse');
  await pruneSparseLeadingVolumeRanges(mangaId);
  await pruneInterleavedSparseVolumeRanges(mangaId);
  await pruneMajoritySparseVolumeRanges(mangaId);

  // Phase 6.25: Backstop for the cross-validation discontinuity guard — delete
  // finished-series volumes whose declared range sits entirely beyond the real
  // (file-backed) chapters along with the never-downloadable phantom rows they
  // hold (ComicVine phantom vols 11-13 = ch 91-117 for a 48-chapter series; AoT
  // "Volume 35" @ ch 140/141 past the real 139). Runs BEFORE overflow handling
  // so the phantom volume can't masquerade as the legitimate last volume and
  // disarm the overflow logic. Cleans rows persisted by an earlier run.
  await pruneOutOfRangeVolumes(mangaId);

  // Phase 6.26: Companion chapter-level sweep for LOOSE (volumeId=NULL) generic
  // phantoms the volume pass can't see. A reidentify of a finished-but-AniList-
  // ongoing series (Berserk: live AniList RELEASING, so the merge cap can't fire)
  // re-creates bare "Chapter 386".."441" past the stored final chapter, none
  // attached to a volume. Title-aware so real recent chapters (Berserk 384/385)
  // and decimals/downloads survive. Also runs before overflow handling.
  await pruneOutOfRangeChapters(mangaId);

  // Phase 6.26b: Remove EMPTY phantom volumes the chapter-range prune misses —
  // placeholder-titled or numbered beyond the trusted volume ceiling (e.g. an
  // empty "Vol 39" of a finished 38-volume series).
  await removeEmptyPhantomVolumes(mangaId);

  // Phase 6.27: Handle chapters beyond the (now phantom-free) last volume range.
  await assignOverflowChapters(mangaId, expectedVolumeCount);

  // Phase 6.5: Reassign bonus/extra/special chapters to their parent volumes
  const bonusTitleMap = extractBonusTitleMap(comicvineVolumes, validatedRanges);
  if (bonusTitleMap.size > 0) {
    logger.info(`[enrichmentPipeline] Found bonus titles in ${bonusTitleMap.size} volumes for manga ${mangaId}`);
  }
  await reassignBonusChaptersToParentVolumes(mangaId, bonusTitleMap);

  // Phase 6.6: Prune redundant file-backed volume stubs + repair mis-stamped page counts.
  // Whole-volume-archive imports scaffold one stub row per expected chapter (all sharing one
  // vN.zip); after numbering, the unmatched stubs linger as empty NULL-chapterNumber rows that
  // still carry the whole-archive pageCount, inflating the volume's CHAPTERS + PAGES badges.
  // Runs last so it compares against the finalized chapter list.
  await pruneRedundantVolumeFileStubs(mangaId);
}

// ============================================================================
// Main Orchestrator Function
// ============================================================================

/**
 * Run the full enrichment pipeline for a manga.
 *
 * 1. Fetch metadata from all providers (MangaDex + AniList + ComicVine + Fandom + Wikipedia)
 * 2. Persist metadata to DB + create chapters/volumes
 * 3. Assemble source data + gap detection (AI path only)
 * 4. AI agent enrichment (3-step merge) OR Fandom + Wikipedia adaptive parser
 * 5. Store volume data for frontend + cache invalidation
 *
 * Uses an in-memory mutex to prevent concurrent enrichment of the same manga,
 * which would cause race conditions and duplicate chapters.
 */
export async function runEnrichmentPipeline(
  mangaId: number,
  title: string,
  onProgress?: EnrichmentProgress,
  options?: EnrichmentPipelineOptions,
): Promise<EnrichmentPipelineResult> {
  return withEnrichmentLock(mangaId, async () => {
    // Phase 1: Fetch metadata from providers
    await onProgress?.('fetching', `Fetching metadata for "${title}" from AniList, ComicVine, Fandom, Wikipedia...`);
    const result = await phaseProviderFetch(mangaId, title, onProgress, options);

    // Phases 2-4: AI agent or adaptive parser
    await executeEnrichmentPhases(mangaId, title, result, onProgress, options);

    // Phase 5: Finalize (volume covers, cache, WebSocket)
    await onProgress?.('finalizing', 'Storing volume covers and finalizing...');
    const manga = await phaseFinalize(mangaId, result, onProgress);

    // Phase 6: Completeness audit — re-read with Volume relation and score
    let completeness;
    if (manga) {
      try {
        const volumes = await prisma.volume.findMany({
          where: { mangaId },
          orderBy: { number: 'asc' },
        });
        completeness = computeMangaCompleteness({
          id: manga.id,
          title: manga.title,
          summary: manga.summary,
          publicationStatus: manga.publicationStatus,
          Metadata: manga.Metadata,
          Chapter: manga.Chapter,
          Volume: volumes,
        });
        logger.info(
          `[enrichmentPipeline] completeness audit for manga ${mangaId}: ${formatCompletenessLine(completeness)}`,
          { mangaId, completeness },
        );
      } catch (err) {
        logger.warn(`[enrichmentPipeline] completeness scoring failed for manga ${mangaId}`, { err });
      }
    }

    // Post-enrichment hooks: Suwayomi chapter sync, auto-download trigger, and
    // binding-plausibility flag (see post-enrichment-hooks.ts for rationale).
    await maybeSyncSuwayomiChapters(mangaId);
    await maybeTriggerAutoDownload(mangaId);
    await maybePlausibilityCheck(mangaId, result);

    return { result: result.enrichmentResult, manga, ...(completeness ? { completeness } : {}) };
  });
}