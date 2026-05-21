/**
 * Post-enrichment Volume Reconciliation
 *
 * After all enrichment phases, chapters may reference volume numbers
 * (via chapter.volume) for which no Volume record exists — typically
 * because Wikipedia's offset correction loses the last 1-2 volumes.
 *
 * This module detects orphaned volume references, fills gaps in the
 * volume sequence, splits overloaded volumes, and creates the missing
 * Volume records with correct chapter ranges.
 */

import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';

import { getVolumeCapForManga } from './phase-volume-cross-validation/db-volume-cap';

// ============================================================================
// Types
// ============================================================================

interface OrphanedVolumeGroup {
  volume: number;
  count: bigint;
  min_ch: number;
  max_ch: number;
}

interface VolumeCreateData {
  mangaId: number;
  number: number;
  title: string | null;
  chapterStart: number | null;
  chapterEnd: number | null;
  totalChapters: number | null;
  source: string;
}

interface SplitResult {
  creates: VolumeCreateData[];
  updates: Array<{ chapterNumbers: number[]; newVolume: number }>;
}

// ============================================================================
// Helper Functions
// ============================================================================

/** Query distinct chapter.volume values grouped with min/max chapter numbers. */
async function getChapterVolumeGroups(mangaId: number): Promise<OrphanedVolumeGroup[]> {
  return prisma.$queryRaw<OrphanedVolumeGroup[]>`
    SELECT volume, COUNT(*) as count,
           MIN("chapterNumber") as min_ch, MAX("chapterNumber") as max_ch
    FROM "Chapter"
    WHERE "mangaId" = ${mangaId} AND volume IS NOT NULL
    GROUP BY volume
    ORDER BY volume
  `;
}

/** Compute average chapters per volume from existing volumes that have ranges. */
function computeAvgChaptersPerVolume(
  existingVolumes: Array<{ number: number; chapterStart: number | null; chapterEnd: number | null }>,
): number {
  const withRanges = existingVolumes.filter(
    v => v.chapterStart !== null && v.chapterEnd !== null && v.number > 0,
  );
  if (withRanges.length === 0) return 10;
  return withRanges.reduce(
    (sum, v) => sum + ((v.chapterEnd ?? 0) - (v.chapterStart ?? 0) + 1), 0,
  ) / withRanges.length;
}

/** Find all missing volume numbers between the max existing volume and the orphan. */
function findMissingVolumes(
  orphanVolNum: number,
  maxExistingVolNum: number,
  existingVolumeSet: Set<number>,
  expectedVolumeCount: number | null,
): number[] {
  // Guard: never create volumes beyond expected count + 10%
  const maxAllowed = expectedVolumeCount && expectedVolumeCount > 0
    ? Math.ceil(expectedVolumeCount * 1.1)
    : Infinity;

  // Skip this orphan entirely if it's beyond the allowed range
  if (orphanVolNum > maxAllowed) return [];

  const missing: number[] = [];
  for (let v = maxExistingVolNum + 1; v <= orphanVolNum; v++) {
    if (!existingVolumeSet.has(v) && v <= maxAllowed) missing.push(v);
  }
  if (expectedVolumeCount && expectedVolumeCount > orphanVolNum) {
    const cappedMax = Math.min(expectedVolumeCount, maxAllowed);
    for (let v = orphanVolNum + 1; v <= cappedMax; v++) {
      if (!existingVolumeSet.has(v) && !missing.includes(v)) missing.push(v);
    }
  }
  return missing;
}

/** Split chapters evenly across missing volumes and return create/update data. */
async function splitChaptersAcrossVolumes(
  mangaId: number,
  orphanVolNum: number,
  missingVolumes: number[],
): Promise<SplitResult> {
  const chapters = await prisma.chapter.findMany({
    where: { mangaId, volume: orphanVolNum },
    select: { chapterNumber: true, filePath: true },
    orderBy: { chapterNumber: 'asc' },
  });
  const sorted = chapters
    .map(c => c.chapterNumber)
    .filter((n): n is number => n !== null)
    .sort((a, b) => a - b);

  // Exclude file-backed chapter numbers from redistribution — import pipeline is authoritative
  const fileBackedNumbers = new Set(
    chapters.filter(c => c.filePath !== null && c.chapterNumber !== null).map(c => c.chapterNumber as number),
  );
  const redistributable = sorted.filter(n => !fileBackedNumbers.has(n));

  const creates: VolumeCreateData[] = [];
  const updates: SplitResult['updates'] = [];
  if (redistributable.length === 0) return { creates, updates };

  const perSplit = Math.ceil(redistributable.length / missingVolumes.length);

  for (let i = 0; i < missingVolumes.length; i++) {
    const volNum = missingVolumes[i];
    if (volNum === undefined) continue;
    const slice = redistributable.slice(i * perSplit, Math.min((i + 1) * perSplit, redistributable.length));
    if (slice.length === 0) continue;
    const start = slice[0];
    const end = slice[slice.length - 1];
    if (start === undefined || end === undefined) continue;

    creates.push({
      mangaId, number: volNum, title: null,
      chapterStart: start, chapterEnd: end,
      totalChapters: slice.length, source: 'reconciliation',
    });
    if (volNum !== orphanVolNum) {
      updates.push({ chapterNumbers: slice, newVolume: volNum });
    }
  }
  return { creates, updates };
}

/** Detect if a chapter record is actually a volume-only file (not a chapter file with volume label).
 *  Matches "Manga V01", "Title Vol.3" but NOT "Manga V01 C001" or "Title V01 Chapter 5". */
function isVolumeFileName(fileName: string | null): boolean {
  if (fileName === null) return false;
  // Must have a volume indicator
  if (!/\bv(?:ol(?:ume)?)?[.\s-]*\d+/i.test(fileName)) return false;
  // Must NOT also have a chapter indicator (C001, Ch.5, Chapter 3, etc.)
  return !/\bc(?:h(?:apter)?)?[.\s-]*\d+/i.test(fileName);
}

/** Extract volume number from a volume filename (e.g., "Manga V03" → 3) */
function extractVolumeNumberFromFileName(fileName: string): number | null {
  const match = fileName.match(/\bv(?:ol(?:ume)?)?[.\s-]*(\d+)/i);
  return match?.[1] ? parseInt(match[1], 10) : null;
}

/** Classify each chapter as needing correction, orphan unlinking, or no action */
// eslint-disable-next-line complexity -- complexity 22: per-chapter classification considers chapterNumber/volume/volumeId/filePath/fileName + correctionMap + confidence threshold; each branch maps to one of 3 distinct outcomes
function classifyChapterCorrections(
  chapters: Array<{ chapterNumber: number | null; volume: number | null; volumeId: number | null; filePath: string | null; fileName: string | null }>,
  chapterToCorrectVolume: Map<number, number>,
  volumeNumberToId: Map<number, number>,
  isHighConfidence: boolean,
): { corrections: Map<number, number[]>; orphanedChapterNumbers: number[] } {
  const corrections = new Map<number, number[]>();
  const orphanedChapterNumbers: number[] = [];

  for (const ch of chapters) {
    if (ch.chapterNumber === null) continue;

    // Volume files: assign to the volume from their filename, not from chapter ranges
    if (ch.filePath !== null && isVolumeFileName(ch.fileName)) {
      const fileVolNum = extractVolumeNumberFromFileName(ch.fileName ?? '');
      if (fileVolNum !== null && ch.volume !== fileVolNum) {
        const arr = corrections.get(fileVolNum) ?? [];
        arr.push(ch.chapterNumber);
        corrections.set(fileVolNum, arr);
      }
      continue;
    }

    // File-backed chapter files with existing volume: import pipeline is authoritative
    if (ch.filePath !== null && ch.volume !== null) continue;
    const correctVol = chapterToCorrectVolume.get(ch.chapterNumber);

    if (correctVol === undefined) {
      // No Volume record covers this chapter — unlink if it has a stale assignment.
      // Only for high-confidence ranges; low-confidence ranges may be wrong.
      if (isHighConfidence && ch.volume !== null) {
        orphanedChapterNumbers.push(ch.chapterNumber);
      }
      continue;
    }

    const correctVolId = volumeNumberToId.get(correctVol);
    if (ch.volume !== correctVol || ch.volumeId !== correctVolId) {
      // High confidence: reassign wrong volumes + assign null chapters.
      // Low confidence: only assign chapters that are currently unassigned.
      // Either confidence: backfill a null volumeId when the existing volume
      //   number is correct — this is a pure FK fill, no semantic change.
      const volumeAlreadyCorrect = ch.volume === correctVol;
      const needsFkBackfill = volumeAlreadyCorrect && ch.volumeId === null && correctVolId !== undefined;
      if (isHighConfidence || ch.volume === null || needsFkBackfill) {
        const arr = corrections.get(correctVol) ?? [];
        arr.push(ch.chapterNumber);
        corrections.set(correctVol, arr);
      }
    }
  }

  return { corrections, orphanedChapterNumbers };
}

/** Build chapter→volume and volumeNumber→id lookups from volume records with ranges */
function buildVolumeLookups(
  volumesWithRanges: Array<{ id: number; number: number; chapterStart: number | null; chapterEnd: number | null }>,
): { chapterToVolume: Map<number, number>; volumeToId: Map<number, number> } {
  const chapterToVolume = new Map<number, number>();
  const volumeToId = new Map<number, number>();
  const firstVol = volumesWithRanges[0];

  for (const vol of volumesWithRanges) {
    volumeToId.set(vol.number, vol.id);
    const start = vol.chapterStart as number;
    const end = vol.chapterEnd as number;
    for (let ch = start; ch <= end; ch++) {
      if (!chapterToVolume.has(ch)) {
        chapterToVolume.set(ch, vol.number);
      }
    }
  }

  // Chapters below vol 1's start should be assigned to vol 1
  if (firstVol) {
    const firstStart = firstVol.chapterStart as number;
    for (let ch = 0; ch < firstStart; ch++) {
      if (!chapterToVolume.has(ch)) {
        chapterToVolume.set(ch, firstVol.number);
      }
    }
  }

  // Fill gaps between consecutive volumes — assign gap chapters to the preceding volume
  const sortedVols = [...volumesWithRanges]
    .filter(v => v.chapterStart !== null && v.chapterEnd !== null)
    .sort((a, b) => (a.chapterStart as number) - (b.chapterStart as number));

  for (let i = 0; i < sortedVols.length - 1; i++) {
    const curr = sortedVols[i];
    const next = sortedVols[i + 1];
    if (!curr || !next) continue;
    const gapStart = (curr.chapterEnd as number) + 1;
    const gapEnd = (next.chapterStart as number) - 1;
    // Cap at 50 chapters to avoid runaway fills from bad data
    for (let ch = gapStart; ch <= gapEnd && ch - gapStart < 50; ch++) {
      if (!chapterToVolume.has(ch)) {
        chapterToVolume.set(ch, curr.number);
      }
    }
  }

  return { chapterToVolume, volumeToId };
}

// ============================================================================
// Main Reconciliation Function
// ============================================================================

/**
 * Reconcile missing Volume records after all enrichment phases.
 *
 * For each orphaned volume number (chapter.volume with no Volume record):
 * 1. Detects gaps in the volume sequence (e.g., vol 18 exists but vol 19 missing)
 * 2. If the orphaned volume has >1.5x the average chapters, splits across gap volumes
 * 3. Creates Volume records with correct chapterStart/chapterEnd
 * 4. Updates chapter.volume assignments for redistributed chapters
 */
async function ensureExpectedVolumesExist(
  mangaId: number,
  expectedVolumeCount: number | null,
  existingSet: Set<number>,
): Promise<void> {
  if (expectedVolumeCount === null || expectedVolumeCount <= 0) return;
  const maxAllowed = Math.ceil(expectedVolumeCount * 1.1);
  const missingExpected: VolumeCreateData[] = [];
  for (let v = 1; v <= Math.min(expectedVolumeCount, maxAllowed); v++) {
    if (!existingSet.has(v)) {
      missingExpected.push({
        mangaId, number: v, title: null,
        chapterStart: null, chapterEnd: null,
        totalChapters: null, source: 'reconciliation',
      });
      existingSet.add(v);
    }
  }
  if (missingExpected.length > 0) {
    await prisma.volume.createMany({ data: missingExpected, skipDuplicates: true });
    logger.info(
      `[enrichmentPipeline] Created ${missingExpected.length} missing expected Volume records ` +
      `(expected: ${expectedVolumeCount}) for manga ${mangaId}`,
    );
  }
}

export async function reconcileMissingVolumeRecords(
  mangaId: number,
  expectedVolumeCount: number | null,
): Promise<void> {
  const groups = await getChapterVolumeGroups(mangaId);
  if (groups.length === 0) return;

  const existingVolumes = await prisma.volume.findMany({
    where: { mangaId },
    select: { number: true, chapterStart: true, chapterEnd: true },
    orderBy: { number: 'asc' },
  });
  const existingSet = new Set(existingVolumes.map(v => v.number));

  // Ensure all expected volumes exist (1 through expectedVolumeCount).
  // Prevents chapters from being crammed into only the 2-3 volumes that have
  // explicit provider data when AniList reports a higher volume count.
  await ensureExpectedVolumesExist(mangaId, expectedVolumeCount, existingSet);

  // iter-MM-8: drop orphans whose volume number overshoots the cap. Prevents
  // re-poisoning of cleaned-up data when chapters carry stale volume refs
  // (e.g. detached chapters from a manual-unbind purge still claim vol 13
  // on a 7-vol manga). DB-driven cap covers the case where the caller
  // didn't thread expectedVolumeCount.
  const { cap, source: capSource } = await getVolumeCapForManga(mangaId, expectedVolumeCount ?? undefined);
  let orphans = groups.filter(g => g.volume > 0 && !existingSet.has(g.volume));
  if (cap !== Infinity) {
    const before = orphans.length;
    orphans = orphans.filter(g => g.volume <= cap);
    const rejected = before - orphans.length;
    if (rejected > 0) {
      logger.warn(
        `[enrichmentPipeline] Reconciliation dropped ${rejected} orphan vols above cap=${cap} ` +
        `(source=${capSource}) for manga ${mangaId}`,
      );
    }
  }
  if (orphans.length === 0) return;

  const avgPerVol = computeAvgChaptersPerVolume(existingVolumes);
  const maxExisting = existingVolumes.length > 0
    ? Math.max(...existingVolumes.map(v => v.number))
    : 0;

  // Classify orphans: simple creates vs needs-split
  const simpleCreates: VolumeCreateData[] = [];
  const splitWork: Array<{ orphanVol: number; missing: number[] }> = [];

  for (const orphan of orphans) {
    const missing = findMissingVolumes(orphan.volume, maxExisting, existingSet, expectedVolumeCount);
    const chCount = Number(orphan.count);
    const needsSplit = missing.length > 1 && chCount > avgPerVol * 1.5;

    if (needsSplit) {
      splitWork.push({ orphanVol: orphan.volume, missing });
    } else {
      simpleCreates.push({
        mangaId, number: orphan.volume, title: null,
        chapterStart: orphan.min_ch, chapterEnd: orphan.max_ch,
        totalChapters: chCount, source: 'reconciliation',
      });
    }
    existingSet.add(orphan.volume);
  }

  // Process all splits concurrently
  const splitResults = await Promise.all(
    splitWork.map(s => splitChaptersAcrossVolumes(mangaId, s.orphanVol, s.missing)),
  );
  const allCreates = [...simpleCreates];
  const allUpdates: SplitResult['updates'] = [];
  for (const { creates, updates } of splitResults) {
    allCreates.push(...creates);
    allUpdates.push(...updates);
  }

  // Persist volume records and chapter reassignments
  if (allCreates.length > 0) {
    await prisma.volume.createMany({ data: allCreates, skipDuplicates: true });
    logger.info(
      `[enrichmentPipeline] Reconciliation created ${allCreates.length} Volume records ` +
      `for manga ${mangaId}: vol ${allCreates.map(v => v.number).join(', ')}`,
    );
  }
  if (allUpdates.length > 0) {
    await Promise.all(allUpdates.map(u =>
      prisma.chapter.updateMany({
        where: { mangaId, chapterNumber: { in: u.chapterNumbers } },
        data: { volume: u.newVolume },
      }),
    ));
    const total = allUpdates.reduce((s, u) => s + u.chapterNumbers.length, 0);
    logger.info(
      `[enrichmentPipeline] Reconciliation reassigned ${total} chapters across volumes for manga ${mangaId}`,
    );
  }
}

/**
 * Fill in chapter ranges for empty Volume records by interpolating from adjacent volumes.
 *
 * When a provider (e.g., ComicVine) only covers volumes 1-20 but the manga has 24 volumes,
 * volumes 21-23 may exist as empty shells (no chapterStart/chapterEnd). This function
 * distributes the gap chapters evenly across the empty volumes.
 */
export async function fillEmptyVolumeRanges(mangaId: number): Promise<void> {
  const allVolumes = await prisma.volume.findMany({
    where: { mangaId, number: { gt: 0 } },
    select: { id: true, number: true, chapterStart: true, chapterEnd: true },
    orderBy: { number: 'asc' },
  });

  if (allVolumes.length < 3) return;

  const maxChapter = await prisma.chapter.aggregate({
    where: { mangaId },
    _max: { chapterNumber: true },
  });
  const maxChNum = maxChapter._max.chapterNumber !== null
    ? Math.floor(maxChapter._max.chapterNumber)
    : null;

  const updates = buildGapInterpolations(allVolumes, maxChNum);
  if (updates.length === 0) return;

  await Promise.all(
    updates.map((u) => prisma.volume.update({ where: { id: u.id }, data: u.data }))
  );

  for (const u of updates) {
    logger.info(
      `[enrichmentPipeline] Interpolated volume ${u.volNumber} range: ` +
      `${u.data.chapterStart}-${u.data.chapterEnd} for manga ${mangaId}`,
    );
  }
}

interface VolumeRow { id: number; number: number; chapterStart: number | null; chapterEnd: number | null }
interface GapUpdate { id: number; volNumber: number; data: { chapterStart: number; chapterEnd: number; totalChapters: number } }

/** Build interpolation updates for gaps in volume ranges (pure function, no DB calls) */
// eslint-disable-next-line complexity -- Gap detection with boundary checks requires sequential volume iteration
function buildGapInterpolations(allVolumes: VolumeRow[], maxChNum: number | null): GapUpdate[] {
  const updates: GapUpdate[] = [];

  let i = 0;
  while (i < allVolumes.length) {
    const vol = allVolumes[i];
    if (vol?.chapterStart !== null) { i++; continue; }

    // Find run of empty volumes
    let gapEnd = i;
    while (gapEnd < allVolumes.length - 1 && allVolumes[gapEnd + 1]?.chapterStart === null) {
      gapEnd++;
    }

    const prevVol = i > 0 ? allVolumes[i - 1] : undefined;
    const nextVol = gapEnd < allVolumes.length - 1 ? allVolumes[gapEnd + 1] : undefined;

    // For the leading gap (volumes before first ranged volume), start from chapter 1
    const gapStart = prevVol?.chapterEnd !== null && prevVol?.chapterEnd !== undefined
      ? prevVol.chapterEnd + 1 : (i === 0 ? 1 : null);
    const gapEndCh = nextVol?.chapterStart !== null && nextVol?.chapterStart !== undefined
      ? nextVol.chapterStart - 1
      : (gapStart !== null ? maxChNum : null);

    if (gapStart === null || gapEndCh === null || gapEndCh < gapStart) {
      i = gapEnd + 1;
      continue;
    }

    const emptyCount = gapEnd - i + 1;
    const chaptersPerVol = Math.ceil((gapEndCh - gapStart + 1) / emptyCount);

    let chNum = gapStart;
    for (let j = i; j <= gapEnd && chNum <= gapEndCh; j++) {
      const emptyVol = allVolumes[j];
      if (!emptyVol) continue;
      const volStart = chNum;
      const volEnd = Math.min(chNum + chaptersPerVol - 1, gapEndCh);
      updates.push({
        id: emptyVol.id,
        volNumber: emptyVol.number,
        data: { chapterStart: volStart, chapterEnd: volEnd, totalChapters: volEnd - volStart + 1 },
      });
      chNum = volEnd + 1;
    }

    i = gapEnd + 1;
  }

  return updates;
}

/**
 * Correct chapter→volume assignments using Volume record ranges as ground truth.
 *
 * After all enrichment phases, some chapters may be assigned to the wrong volume
 * (e.g., Fandom's tab-based parsing lumps hundreds of chapters into vol 1 or vol 27).
 * Volume records from ComicVine have authoritative chapterStart/chapterEnd ranges.
 *
 * For each chapter:
 * - If assigned to the wrong volume but falls within a Volume's range → reassign
 * - If unassigned (null) and falls within a Volume's range → assign
 * - If unassigned and no Volume range covers it → leave null
 * - Volume 0 (Specials) is skipped entirely
 */
export async function correctVolumeAssignments(mangaId: number): Promise<void> {
  // 1. Get all Volume records with valid ranges (skip vol 0 = Specials)
  const volumesWithRanges = await prisma.volume.findMany({
    where: {
      mangaId,
      number: { gt: 0 },
      chapterStart: { not: null },
      chapterEnd: { not: null },
    },
    select: { id: true, number: true, chapterStart: true, chapterEnd: true, source: true },
    orderBy: { number: 'asc' },
  });

  // Guard: need at least 3 volumes with ranges to be confident
  if (volumesWithRanges.length < 3) return;

  // Tiered correction: multi-source cross-validated ranges are most reliable.
  // Single-source ranges can also be trusted if no anomaly is detected.
  const highConfidenceVols = volumesWithRanges.filter(v => v.source?.includes('+'));
  let isHighConfidence = highConfidenceVols.length >= volumesWithRanges.length * 0.5;

  // 2. Get all chapters with their current volume assignment
  const chapters = await prisma.chapter.findMany({
    where: { mangaId },
    select: { id: true, chapterNumber: true, volume: true, volumeId: true, filePath: true, fileName: true },
  });

  // Detect anomaly: if any single volume holds >3x the median chapter count,
  // existing assignments are clearly wrong and should be overridden regardless
  // of confidence level. This catches Fandom lumping 100+ chapters into one volume.
  if (!isHighConfidence) {
    const volumeChapterCounts = new Map<number, number>();
    for (const ch of chapters) {
      if (ch.volume !== null) {
        volumeChapterCounts.set(ch.volume, (volumeChapterCounts.get(ch.volume) ?? 0) + 1);
      }
    }
    const counts = [...volumeChapterCounts.values()].sort((a, b) => a - b);
    const median = counts[Math.floor(counts.length / 2)] ?? 0;
    const maxCount = counts[counts.length - 1] ?? 0;
    if (median > 0 && maxCount > median * 3) {
      logger.info(
        `[enrichmentPipeline] Volume anomaly detected for manga ${mangaId}: ` +
        `max=${maxCount} vs median=${median} — forcing high-confidence correction`,
      );
      isHighConfidence = true;
    }
  }

  // 3. Build lookup: for each chapter number, find which Volume record contains it
  const { chapterToVolume: chapterToCorrectVolume, volumeToId: volumeNumberToId } =
    buildVolumeLookups(volumesWithRanges);

  // 4. Classify chapters as needing correction, orphan unlinking, or no action
  const { corrections, orphanedChapterNumbers } = classifyChapterCorrections(
    chapters, chapterToCorrectVolume, volumeNumberToId, isHighConfidence,
  );

  if (corrections.size === 0 && orphanedChapterNumbers.length === 0) return;

  // 5. Batch update all corrections (set both volume number and volumeId foreign key)
  const updatePromises = [...corrections.entries()].map(([volNum, chNums]) => {
    const volId = volumeNumberToId.get(volNum);
    return prisma.chapter.updateMany({
      where: { mangaId, chapterNumber: { in: chNums } },
      data: { volume: volNum, ...(volId !== undefined ? { volumeId: volId } : {}) },
    });
  });

  // 6. Unlink orphaned chapters (stale volume assignments outside all volume ranges)
  if (orphanedChapterNumbers.length > 0) {
    updatePromises.push(
      prisma.chapter.updateMany({
        where: { mangaId, chapterNumber: { in: orphanedChapterNumbers } },
        data: { volume: null, volumeId: null },
      }),
    );
  }

  await Promise.all(updatePromises);

  const totalCorrected = [...corrections.values()].reduce((s, arr) => s + arr.length, 0);
  if (totalCorrected > 0) {
    logger.info(
      `[enrichmentPipeline] Volume correction reassigned ${totalCorrected} chapters across ` +
      `${corrections.size} volumes for manga ${mangaId} (${isHighConfidence ? 'high' : 'low'}-confidence, ` +
      `${highConfidenceVols.length}/${volumesWithRanges.length} multi-source)`,
    );
  }
  if (orphanedChapterNumbers.length > 0) {
    logger.info(
      `[enrichmentPipeline] Volume correction unlinked ${orphanedChapterNumbers.length} chapters ` +
      `with stale volume assignments for manga ${mangaId} (outside all volume ranges)`,
    );
  }
}

