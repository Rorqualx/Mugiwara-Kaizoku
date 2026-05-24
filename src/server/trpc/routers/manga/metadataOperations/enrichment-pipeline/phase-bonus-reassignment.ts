/**
 * Bonus Chapter Reassignment
 *
 * After volume corrections, bonus/extra/special chapters may be orphaned
 * (in Volume 0 or unassigned). This module reassigns them to their parent
 * volume using two strategies:
 *
 * 1. Title matching from ComicVine volume descriptions
 * 2. Proximity/pattern matching (decimal chapters, bonus-titled chapters)
 */

import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';

import { isBonusTitle } from './types';

import type { BonusChapterInfo } from './types';

// ============================================================================
// Parent Volume Finder
// ============================================================================

interface TypedVolume {
  id: number;
  number: number;
  chapterStart: number;
  chapterEnd: number;
}

/** Find the parent volume for a chapter number based on volume ranges */
function findParentVolume(
  chapterNum: number,
  volumes: TypedVolume[],
): { id: number; number: number } | null {
  // For decimal chapters, check if floor(chapterNum) falls within a volume
  if (!Number.isInteger(chapterNum)) {
    const floor = Math.floor(chapterNum);
    for (const vol of volumes) {
      if (floor >= vol.chapterStart && floor <= vol.chapterEnd) {
        return { id: vol.id, number: vol.number };
      }
    }
  }

  // For any chapter (integer bonus or decimal fallback), find the nearest
  // preceding volume (volume whose chapterEnd is closest and < chapterNum)
  let best: { id: number; number: number } | null = null;
  let bestDist = Infinity;
  for (const vol of volumes) {
    const dist = chapterNum - vol.chapterEnd;
    if (dist > 0 && dist < bestDist) {
      bestDist = dist;
      best = { id: vol.id, number: vol.number };
    }
  }

  // Only accept if the chapter is within 5 of the volume's end
  return bestDist <= 5 ? best : null;
}

// ============================================================================
// Title Matching Strategy
// ============================================================================

/** Check if a candidate chapter is near a volume's chapter range (within 5 chapters) */
function isNearVolumeRange(
  chapterNumber: number | null,
  vol: TypedVolume | undefined,
): boolean {
  if (chapterNumber === null || !vol) return true;
  const belowStart = vol.chapterStart - chapterNumber;
  const aboveEnd = chapterNumber - vol.chapterEnd;
  return belowStart <= 5 && aboveEnd <= 5;
}

interface BonusTitleMatchContext {
  volumeNumberToId: Map<number, number>;
  volumes: TypedVolume[];
  reassignments: Map<number, { volId: number; chapterIds: number[] }>;
  assignedIds: Set<number>;
}

/** Match bonus chapters by title from ComicVine volume descriptions.
 *  Includes a proximity check: the matched chapter's number must be within
 *  5 of the volume's range to prevent cross-volume misassignment. */
function matchBonusByTitle(
  bonusTitleMap: Map<number, BonusChapterInfo[]>,
  candidates: Array<{ id: number; chapterNumber: number | null; title: string; volume: number | null }>,
  ctx: BonusTitleMatchContext,
): void {
  const { volumeNumberToId, volumes, reassignments, assignedIds } = ctx;
  // Build a title→candidates lookup (lowercase for case-insensitive matching)
  const titleToCandidates = new Map<string, Array<{ id: number; chapterNumber: number | null }>>();
  for (const ch of candidates) {
    if (!ch.title) continue;
    const key = ch.title.toLowerCase().trim();
    const arr = titleToCandidates.get(key) ?? [];
    arr.push({ id: ch.id, chapterNumber: ch.chapterNumber });
    titleToCandidates.set(key, arr);
  }

  // Build a volume number → range lookup for proximity checks
  const volumeRangeMap = new Map(volumes.map(v => [v.number, v]));

  // Process volumes in order so when multiple candidates share a title,
  // lower volumes get lower-numbered chapters
  const sortedVolNums = [...bonusTitleMap.keys()].sort((a, b) => a - b);
  for (const volNum of sortedVolNums) {
    const volId = volumeNumberToId.get(volNum);
    if (volId === undefined) continue;

    const vol = volumeRangeMap.get(volNum);
    const bonusInfos = bonusTitleMap.get(volNum) ?? [];
    for (const info of bonusInfos) {
      const key = info.title.toLowerCase().trim();
      const matches = titleToCandidates.get(key);
      if (!matches || matches.length === 0) continue;

      // Pick the first unassigned match that passes proximity check
      matches.sort((a, b) => (a.chapterNumber ?? 0) - (b.chapterNumber ?? 0));
      const match = matches.find(m => !assignedIds.has(m.id) && isNearVolumeRange(m.chapterNumber, vol));
      if (!match) continue;

      const entry = reassignments.get(volNum) ?? { volId, chapterIds: [] };
      entry.chapterIds.push(match.id);
      reassignments.set(volNum, entry);
      assignedIds.add(match.id);
    }
  }
}

// ============================================================================
// Bonus Chapter Creation
// ============================================================================

/**
 * Create PENDING bonus chapters that don't yet exist in the database.
 * Uses decimal chapter numbers (e.g., 6.1, 6.2) computed from validated ranges.
 */
async function createMissingBonusChapters(
  mangaId: number,
  bonusTitleMap: Map<number, BonusChapterInfo[]>,
  volumeNumberToId: Map<number, number>,
): Promise<number> {
  const allBonusInfos = [...bonusTitleMap.values()].flat();
  if (allBonusInfos.length === 0) return 0;

  // Check which decimal chapter numbers already exist
  const existingChapters = await prisma.chapter.findMany({
    where: { mangaId },
    select: { chapterNumber: true, title: true, filePath: true },
  });
  const existingNumbers = new Set(
    existingChapters
      .filter((ch): ch is { chapterNumber: number; title: string; filePath: string | null } => ch.chapterNumber !== null)
      .map(ch => ch.chapterNumber),
  );
  // Skip creating a bonus stub when an existing file-attached row already
  // carries the same title (e.g. the user has the bonus chapter downloaded
  // at chapterNumber 21 instead of the canonical 20.1 — adding 20.1 would
  // create a duplicate-title pair that confuses the reader UI).
  const fileAttachedTitles = new Set(
    existingChapters
      .filter(ch => ch.filePath !== null && ch.title)
      .map(ch => ch.title.replace(/^\[Dup of ch [\d.]+\]\s*/, '').trim()),
  );

  const toCreate = allBonusInfos.filter(info =>
    !existingNumbers.has(info.chapterNumber) && !fileAttachedTitles.has(info.title.trim()),
  );
  if (toCreate.length === 0) return 0;

  // Get max index to continue from
  const maxIndexResult = await prisma.chapter.aggregate({
    where: { mangaId },
    _max: { index: true },
  });
  let nextIndex = (maxIndexResult._max.index ?? 0) + 1;

  const records = toCreate.map(info => {
    const volId = volumeNumberToId.get(info.volumeNumber) ?? null;
    return {
      mangaId,
      fileName: `c${info.chapterNumber.toFixed(1).replace('.', '_').padStart(7, '0')}.cbz`,
      index: nextIndex++,
      chapterNumber: info.chapterNumber,
      title: info.title,
      alternativeTitles: [] as string[],
      size: 0,
      downloadStatus: 'PENDING' as const,
      volume: info.volumeNumber,
      volumeId: volId,
      downloadUrl: null,
      coverImage: null,
      description: null,
      releaseDate: null,
      pageCount: null,
      pages: null,
      monitored: true,
      updatedAt: new Date(),
    };
  });

  await prisma.chapter.createMany({ data: records, skipDuplicates: true });
  logger.info(
    `[enrichmentPipeline] Created ${records.length} bonus chapters for manga ${mangaId}: ` +
    records.map(r => `ch ${r.chapterNumber} "${r.title}"`).join(', '),
  );
  return records.length;
}

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Reassign bonus/extra/special chapters to their parent volume.
 *
 * Uses two strategies:
 * 1. **Title matching** (from ComicVine descriptions): each volume's description
 *    lists its chapters including bonuses. Match bonus titles to DB chapters.
 * 2. **Proximity/pattern matching** (fallback): decimal chapters and bonus-titled
 *    chapters near a volume's range get assigned to the nearest volume.
 */
export async function reassignBonusChaptersToParentVolumes(
  mangaId: number,
  bonusTitleMap?: Map<number, BonusChapterInfo[]>,
): Promise<void> {
  const volumes = await prisma.volume.findMany({
    where: {
      mangaId,
      number: { gt: 0 },
      chapterStart: { not: null },
      chapterEnd: { not: null },
    },
    select: { id: true, number: true, chapterStart: true, chapterEnd: true },
    orderBy: { number: 'asc' },
  });

  if (volumes.length < 3) return;

  const typedVolumes = volumes.map(v => ({
    id: v.id,
    number: v.number,
    chapterStart: v.chapterStart as number,
    chapterEnd: v.chapterEnd as number,
  }));
  const volumeNumberToId = new Map(typedVolumes.map(v => [v.number, v.id]));

  // Find unassigned chapters that could be bonus chapters. Vol 0 is no
  // longer a synthetic "Specials" dumping ground — it's reserved for real
  // published prequel volumes (HxH "Kurapika's Memories", JJK 0) — so the
  // only "unplaced" signal we still check is volume IS NULL.
  const candidates = await prisma.chapter.findMany({
    where: {
      mangaId,
      volume: null,
      chapterNumber: { not: null },
    },
    select: { id: true, chapterNumber: true, title: true, volume: true },
  });

  const reassignments = new Map<number, { volId: number; chapterIds: number[] }>();
  const assignedIds = new Set<number>();

  // Strategy 1: Title matching from ComicVine volume descriptions
  if (bonusTitleMap && bonusTitleMap.size > 0) {
    matchBonusByTitle(bonusTitleMap, candidates, {
      volumeNumberToId, volumes: typedVolumes, reassignments, assignedIds,
    });
  }

  // Strategy 2: Proximity/pattern matching for remaining candidates
  for (const ch of candidates) {
    if (ch.chapterNumber === null || assignedIds.has(ch.id)) continue;
    const isDecimal = !Number.isInteger(ch.chapterNumber);
    const isBonus = isBonusTitle(ch.title);
    if (!isDecimal && !isBonus) continue;

    const parent = findParentVolume(ch.chapterNumber, typedVolumes);
    if (!parent) continue;

    const entry = reassignments.get(parent.number) ?? { volId: parent.id, chapterIds: [] };
    entry.chapterIds.push(ch.id);
    reassignments.set(parent.number, entry);
  }

  if (reassignments.size > 0) {
    await Promise.all(
      [...reassignments.entries()].map(([volNum, { volId, chapterIds }]) =>
        prisma.chapter.updateMany({
          where: { id: { in: chapterIds } },
          data: { volume: volNum, volumeId: volId },
        }),
      ),
    );

    const total = [...reassignments.values()].reduce((s, e) => s + e.chapterIds.length, 0);
    logger.info(
      `[enrichmentPipeline] Reassigned ${total} bonus/extra chapters to parent volumes ` +
      `across ${reassignments.size} volumes for manga ${mangaId}`,
    );
  }

  // Create missing bonus chapters that don't exist yet
  if (bonusTitleMap && bonusTitleMap.size > 0) {
    await createMissingBonusChapters(mangaId, bonusTitleMap, volumeNumberToId);
  }
}
