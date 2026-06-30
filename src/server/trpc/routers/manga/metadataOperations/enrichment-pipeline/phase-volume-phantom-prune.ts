/**
 * Phantom Out-of-Range Pruners (volumes + loose chapters)
 *
 * Two finalize-stage backstops sharing one gate (resolveRealExtent):
 *   - pruneOutOfRangeVolumes: empty/non-file-backed volumes whose range is beyond
 *     the real extent.
 *   - pruneOutOfRangeChapters: loose (volumeId=NULL) or otherwise-unbucketed
 *     generic phantom chapters beyond the real extent that the volume pass misses.
 *
 * pruneOutOfRangeVolumes deletes volumes whose declared chapter range lies entirely beyond the manga's
 * real chapters AND which have zero linked Chapter rows. These are provider
 * numbering artifacts — e.g. ComicVine listing volumes 11-13 as chapters 91-117
 * for a series whose real chapters stop at 58. Such a volume can never gain a
 * chapter from this library and renders as an empty "0/0 chapters · 0 B" phantom
 * row in the volume browser.
 *
 * This is the finalize-stage backstop for the cross-validation discontinuity
 * guard (constraint-validation.ts): it cleans rows already persisted by an
 * earlier run and any provider path that bypasses cross-validation.
 *
 * Conservative on two axes so legitimate data is never touched:
 *   1. Only fires for finished series — publicationStatus COMPLETED / CANCELLED,
 *      OR a populated metadata endDate (an authoritative "publication ended"
 *      signal that survives a stale ONGOING status). An ongoing manga may have a
 *      not-yet-populated trailing volume; a finished series has all its chapters,
 *      so an empty out-of-range volume is provably spurious.
 *   2. Requires BOTH zero FILE-BACKED chapters AND chapterStart beyond the
 *      series' real extent. Any volume that holds a real downloaded chapter is
 *      always preserved.
 *
 * "Real extent" = max(trusted Metadata.chapters, highest file-backed chapter). A
 * trusted chapter scalar is REQUIRED — bounding by downloads alone is
 * catastrophic for a sparsely-downloaded finished series (JJK has 271 real
 * chapters but only 4 downloaded; a file-backed-only basis treated chapters
 * 5-271 as out-of-range and deleted 265 real rows). The file-backed max only
 * extends the ceiling upward, never shrinks it; and if a download sits beyond the
 * scalar, the scalar undercounts (wrong/stale match) so the prune is skipped.
 * Within a phantom volume the pruner deletes the never-downloadable rows so no
 * orphans remain (the FK is SET NULL, which would otherwise re-inflate counts).
 * This basis also avoids the self-protection trap where fabricated chapters
 * (AoT 140/141 past 139) inflate a raw MAX(chapterNumber) so the phantom volume
 * never reads as "beyond" its own rows.
 *
 * Leaves the "Specials" volume 0 alone (number > 0 filter).
 */

import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';

import { classifyPhantomChapters, isFileBackedChapter, normalizeChapterTitle } from './types';

import type { MangaPublicationStatus } from '@prisma/client';

function isTerminalStatus(status: MangaPublicationStatus | null | undefined): boolean {
  return status === 'COMPLETED' || status === 'CANCELLED';
}

/** The trusted "real extent" of a finished series and the inputs behind it. */
interface RealExtent {
  /** Known final chapter scalar (Metadata.chapters), always > 0. */
  metaCeiling: number;
  /** Highest file-backed (downloaded) chapter, <= metaCeiling. */
  maxFileBacked: number;
  /** max(metaCeiling, maxFileBacked) — the boundary past which rows are phantom. */
  realExtent: number;
}

/**
 * Resolve the trusted real extent for the phantom pruners, applying the shared
 * safety gates. Returns null (do not prune) unless the series is finished AND has
 * a plausible chapter scalar:
 *   - finished = terminal publicationStatus, OR a populated Metadata.endDate (an
 *     authoritative "publication ended" signal that survives a stale ONGOING
 *     status — JJK/Berserk both carry one while still flagged ONGOING).
 *   - the real extent is Metadata.chapters (a trusted scalar is REQUIRED — bounding
 *     by downloads alone deleted 265 real, un-downloaded JJK chapters). The
 *     file-backed max only extends the ceiling upward; if a download sits beyond
 *     the scalar, the scalar undercounts (wrong/stale match) so we skip.
 */
async function resolveRealExtent(mangaId: number): Promise<RealExtent | null> {
  const manga = await prisma.manga.findUnique({
    where: { id: mangaId },
    select: { publicationStatus: true, Metadata: { select: { endDate: true, chapters: true } } },
  });
  const hasEndDate = Boolean(manga?.Metadata?.endDate);
  if (!isTerminalStatus(manga?.publicationStatus) && !hasEndDate) return null;

  const metaCeiling = manga?.Metadata?.chapters ?? 0;
  if (metaCeiling <= 0) return null;

  const maxChResult = await prisma.chapter.aggregate({
    where: { mangaId, chapterNumber: { not: null }, downloadStatus: 'COMPLETED', pageCount: { gt: 0 } },
    _max: { chapterNumber: true },
  });
  const maxFileBacked = maxChResult._max.chapterNumber ?? 0;
  if (maxFileBacked > metaCeiling) return null;
  return { metaCeiling, maxFileBacked, realExtent: Math.max(metaCeiling, maxFileBacked) };
}

export async function pruneOutOfRangeVolumes(mangaId: number): Promise<number> {
  const extent = await resolveRealExtent(mangaId);
  if (!extent) return 0;
  const { realExtent, metaCeiling, maxFileBacked } = extent;

  // Numbered volumes whose declared start is beyond the real extent.
  const candidates = await prisma.volume.findMany({
    where: {
      mangaId,
      number: { gt: 0 },
      chapterStart: { gt: realExtent },
    },
    select: {
      id: true,
      chapters: {
        select: { id: true, downloadStatus: true, pageCount: true, filePath: true },
      },
    },
  });

  const isFileBacked = (c: { downloadStatus: string; pageCount: number | null; filePath: string | null }): boolean =>
    c.downloadStatus === 'COMPLETED' && (c.pageCount ?? 0) > 0 && c.filePath !== null;

  // A candidate is phantom when NONE of its linked chapters are file-backed.
  const phantomVolumes = candidates.filter(v => !v.chapters.some(isFileBacked));
  if (phantomVolumes.length === 0) return 0;

  const phantomIds = phantomVolumes.map(v => v.id);
  // Never-downloadable rows the phantom volumes held — delete so they don't
  // survive as orphans (FK is SET NULL) re-inflating the count on the next run.
  const phantomChapterIds = phantomVolumes.flatMap(v => v.chapters.filter(c => !isFileBacked(c)).map(c => c.id));

  await prisma.$transaction([
    ...(phantomChapterIds.length > 0
      ? [prisma.chapter.deleteMany({ where: { id: { in: phantomChapterIds } } })]
      : []),
    prisma.volume.deleteMany({ where: { id: { in: phantomIds } } }),
  ]);

  logger.info(
    `[enrichmentPipeline] Pruned ${phantomIds.length} phantom out-of-range volume(s) and ` +
    `${phantomChapterIds.length} never-downloadable chapter row(s) for manga ${mangaId} ` +
    `(declared start beyond real extent ${realExtent} = max(metadata chapters ${metaCeiling}, file-backed ${maxFileBacked}))`,
  );
  return phantomIds.length;
}

/**
 * Chapter-level companion to {@link pruneOutOfRangeVolumes}.
 *
 * The volume pruner only walks chapters that belong to out-of-range *volumes*, so
 * it cannot see LOOSE phantoms (`volumeId = NULL`). A reidentify of a finished-
 * but-AniList-ongoing series exposes exactly this: live AniList returns Berserk as
 * RELEASING (no chapters/endDate), so the merge cap doesn't fire and the provider
 * source list persists loose generic chapters 386-441 past the stored final
 * chapter — none of them attached to a volume. This pass sweeps them.
 *
 * Same finished+plausible-scalar gate as the volume pruner (via resolveRealExtent),
 * then runs the shared, title-aware {@link classifyPhantomChapters}: only
 * non-file-backed INTEGER rows that are generic-titled or duplicate an in-range
 * title are dropped. Decimals, downloads, and distinct-titled rows (real recent
 * chapters like Berserk 384/385) are always kept, and the whole title is skipped
 * if more than DISTINCT_REAL_TOLERANCE distinct-real-titled rows sit beyond the
 * ceiling (the scalar is then untrustworthy).
 */
export async function pruneOutOfRangeChapters(mangaId: number): Promise<number> {
  const extent = await resolveRealExtent(mangaId);
  if (!extent) return 0;
  const { realExtent, metaCeiling } = extent;

  const all = await prisma.chapter.findMany({
    where: { mangaId },
    select: { id: true, chapterNumber: true, title: true, pageCount: true, filePath: true },
  });
  const beyond = all.filter(c => c.chapterNumber !== null && c.chapterNumber > realExtent);
  if (beyond.length === 0) return 0;

  const inRangeTitles = new Set(
    all.filter(c => c.chapterNumber !== null && c.chapterNumber <= metaCeiling)
      .map(c => normalizeChapterTitle(c.title)),
  );
  const maxFileBacked = all.filter(isFileBackedChapter).reduce((mx, c) => Math.max(mx, c.chapterNumber ?? 0), 0);

  const droppable = classifyPhantomChapters(beyond, inRangeTitles, maxFileBacked, metaCeiling);
  if (droppable.length === 0) return 0;

  await prisma.chapter.deleteMany({ where: { id: { in: droppable.map(c => c.id) } } });
  logger.info(
    `[enrichmentPipeline] Pruned ${droppable.length} loose/generic phantom chapter row(s) ` +
    `for manga ${mangaId} (beyond real extent ${realExtent}, metadata chapters ${metaCeiling})`,
  );
  return droppable.length;
}

/**
 * Remove EMPTY phantom volumes a finished series should not have: placeholder-
 * titled volumes, or volumes numbered beyond the trusted volume count. This
 * complements pruneOutOfRangeVolumes, which keys off chapterStart (chapter
 * position) and so misses an empty "Vol 39" of a 38-volume series whose declared
 * start happens to fall inside the real chapter range. Only EMPTY volumes (zero
 * linked chapters) are touched, so a volume holding any real chapter is preserved.
 */
export async function removeEmptyPhantomVolumes(mangaId: number): Promise<number> {
  const manga = await prisma.manga.findUnique({
    where: { id: mangaId },
    select: { publicationStatus: true, Metadata: { select: { endDate: true, volumes: true } } },
  });
  const finished = isTerminalStatus(manga?.publicationStatus) || Boolean(manga?.Metadata?.endDate);
  if (!finished) return 0;
  const volumeCeiling = manga?.Metadata?.volumes ?? 0;

  const empties = await prisma.volume.findMany({
    where: { mangaId, number: { gt: 0 }, chapters: { none: {} } },
    select: { id: true, number: true, title: true },
  });
  const phantomIds = empties
    .filter(v =>
      (v.title ?? '').toLowerCase().includes('placeholder') ||
      (volumeCeiling > 0 && v.number > volumeCeiling),
    )
    .map(v => v.id);
  if (phantomIds.length === 0) return 0;

  await prisma.volume.deleteMany({ where: { id: { in: phantomIds } } });
  logger.info(
    `[enrichmentPipeline] Removed ${phantomIds.length} empty phantom volume(s) for manga ${mangaId} ` +
    `(placeholder-titled or numbered beyond volume ceiling ${volumeCeiling})`,
  );
  return phantomIds.length;
}

/** Aggregate count of phantom artifacts removed by a single sweep. */
export interface PhantomRemovalResult {
  /** Out-of-range volumes deleted (chapterStart beyond real extent). */
  outOfRangeVolumes: number;
  /** Loose/generic over-ceiling chapters deleted. */
  chapters: number;
  /** Empty placeholder / beyond-volume-ceiling volumes deleted. */
  emptyVolumes: number;
}

/**
 * Run every end-of-series phantom sweep for a manga and report what was removed.
 * Idempotent and safe to call after the enrichment pipeline (which already runs
 * the same sweeps) — a second pass simply finds nothing. Used as the explicit
 * phantom-removal step of a metadata reidentify so the DB (and, after the
 * client refetch, the UI) is left phantom-free.
 */
export async function removePhantomArtifacts(mangaId: number): Promise<PhantomRemovalResult> {
  const outOfRangeVolumes = await pruneOutOfRangeVolumes(mangaId);
  const chapters = await pruneOutOfRangeChapters(mangaId);
  const emptyVolumes = await removeEmptyPhantomVolumes(mangaId);
  return { outOfRangeVolumes, chapters, emptyVolumes };
}
