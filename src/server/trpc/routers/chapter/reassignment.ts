/**
 * Chapter Router - Reassignment Operations
 *
 * Procedures for reassigning chapters to volumes:
 * - reassignToVolume: Manual reassignment of chapters to a volume
 * - previewAutoAssign: Preview what would be auto-assigned
 * - autoAssignToVolumes: Auto-assign based on volume chapter ranges
 *
 * @module server/trpc/routers/chapter/reassignment
 */

import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { prisma } from '@/server/db';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { protectedProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';
import { logger } from '@/utils/logger';

// ============================================================================
// Types
// ============================================================================

interface VolumeWithRange {
  id: number;
  number: number;
  title: string | null;
  chapterStart: number | null;
  chapterEnd: number | null;
}

interface ChapterForMatching {
  id: number;
  index: number;
  chapterNumber: number | null;
  title: string;
}

interface ChapterMatch {
  id: number;
  title: string;
  chapterNum: number;
}

interface VolumeAssignment {
  volumeNumber: number;
  volumeTitle: string | null;
  chapterRange: string | null;
  chapters: ChapterMatch[];
}

// ============================================================================
// Helper Functions
// ============================================================================

/** Check if a chapter number falls within a volume's range */
function isChapterInRange(chapterNum: number, start: number | null, end: number | null): boolean {
  const rangeStart = start ?? 0;
  const rangeEnd = end ?? Infinity;
  return chapterNum >= rangeStart && chapterNum <= rangeEnd;
}

/** Get the effective chapter number */
function getChapterNum(chapter: { index: number; chapterNumber: number | null }): number {
  return chapter.chapterNumber ?? chapter.index;
}

/** Format volume chapter range for display */
function formatRange(start: number | null, end: number | null): string | null {
  if (start === null && end === null) return null;
  const s = start ?? 0;
  return end !== null ? `Ch.${s}-${end}` : `Ch.${s}+`;
}

/** Check if volume has a defined range */
function hasRange(volume: VolumeWithRange): boolean {
  return volume.chapterStart !== null || volume.chapterEnd !== null;
}

/** Build OR conditions for matching chapters to a volume by number, volumeId, or chapter range */
function buildVolumeChapterMatchConditions(
  volumeNumber: number,
  volumeId: number,
  chapterStart: number | null,
  chapterEnd: number | null
): Array<Record<string, unknown>> {
  const conditions: Array<Record<string, unknown>> = [
    { volume: volumeNumber },
    { volumeId }
  ];

  // Add chapter range matching if the volume has defined ranges
  if (chapterStart !== null || chapterEnd !== null) {
    const rangeStart = chapterStart ?? 0;
    const rangeEnd = chapterEnd ?? 999999;

    // Match by chapterNumber within range
    conditions.push({ chapterNumber: { gte: rangeStart, lte: rangeEnd } });
    // Match by index within range (fallback when chapterNumber is null)
    conditions.push({ chapterNumber: null, index: { gte: rangeStart, lte: rangeEnd } });
  }

  return conditions;
}

/** Match a chapter to a volume */
function matchChapterToVolume(
  chapter: ChapterForMatching,
  volumes: VolumeWithRange[]
): VolumeWithRange | undefined {
  const chapterNum = getChapterNum(chapter);
  return volumes.find(v => hasRange(v) && isChapterInRange(chapterNum, v.chapterStart, v.chapterEnd));
}

/** Build matches for all volumes */
function buildAllVolumeMatches(
  volumes: VolumeWithRange[],
  chapters: ChapterForMatching[]
): { assignments: VolumeAssignment[]; assignedIds: Set<number> } {
  const assignedIds = new Set<number>();
  const volumeMatchMap = new Map<number, ChapterMatch[]>();

  // Initialize map for all volumes
  for (const v of volumes) {
    volumeMatchMap.set(v.number, []);
  }

  // Match chapters to volumes with ranges
  for (const chapter of chapters) {
    const match = matchChapterToVolume(chapter, volumes);
    if (match) {
      const matches = volumeMatchMap.get(match.number) ?? [];
      matches.push({ id: chapter.id, title: chapter.title, chapterNum: getChapterNum(chapter) });
      assignedIds.add(chapter.id);
    }
  }

  // Build assignments array (includes volumes without matches for manual assignment)
  const assignments: VolumeAssignment[] = volumes.map(v => ({
    volumeNumber: v.number,
    volumeTitle: v.title,
    chapterRange: formatRange(v.chapterStart, v.chapterEnd),
    chapters: (volumeMatchMap.get(v.number) ?? []).sort((a, b) => a.chapterNum - b.chapterNum)
  }));

  return { assignments, assignedIds };
}

// ============================================================================
// Router
// ============================================================================

export const chapterReassignmentRouter = router({
  /**
   * Reassign chapters to a volume (manual assignment)
   */
  reassignToVolume: protectedProcedure
    .input(z.object({
      chapterIds: z.array(z.number().int().positive()),
      volumeNumber: z.number().int().nullable(),
      mangaId: z.number().int().positive()
    }))
    .mutation(async ({ input }): Promise<{ updated: number; message: string }> => {
      const { chapterIds, volumeNumber, mangaId } = input;

      if (chapterIds.length === 0) {
        return { updated: 0, message: 'No chapters to reassign' };
      }

      const manga = await prisma.manga.findUnique({
        where: { id: mangaId },
        select: { id: true, title: true }
      });

      if (!manga) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Manga not found' });
      }

      // Allow Volume 0 for prequels (e.g., JJK 0), only treat negative as null
      const effectiveVolNum = volumeNumber === null || volumeNumber < 0 ? null : volumeNumber;

      // Volume lookup + chapter write in one transaction so a concurrent
      // writer (e.g. enrichment re-homing chapters mid-refresh) can't slip
      // between the volumeId resolution and the update and leave the
      // volume/volumeId pair pointing at different volumes.
      const result = await prisma.$transaction(async (tx) => {
        let volumeId: number | null = null;
        if (effectiveVolNum !== null) {
          const volume = await tx.volume.findUnique({
            where: { mangaId_number: { mangaId, number: effectiveVolNum } }
          });
          volumeId = volume?.id ?? null;
        }
        return tx.chapter.updateMany({
          where: { id: { in: chapterIds }, mangaId },
          data: { volume: effectiveVolNum, volumeId }
        });
      });

      logger.info(`Reassigned ${result.count} chapters to volume ${effectiveVolNum ?? 'unassigned'} for: ${manga.title}`);

      void realtimeEmitter.emitMangaUpdate({
        mangaId,
        action: 'updated',
        data: { chaptersReassigned: result.count, volumeNumber: effectiveVolNum }
      });

      const target = effectiveVolNum !== null ? `Volume ${effectiveVolNum}` : 'Unassigned';
      return {
        updated: result.count,
        message: `Reassigned ${result.count} chapter${result.count !== 1 ? 's' : ''} to ${target}`
      };
    }),

  /**
   * Preview auto-assignment (includes all volumes for manual selection)
   */
  previewAutoAssign: protectedProcedure
    .input(z.object({ mangaId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const { mangaId } = input;

      const manga = await prisma.manga.findUnique({
        where: { id: mangaId },
        select: { id: true, title: true }
      });

      if (!manga) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Manga not found' });
      }

      // Get ALL volumes (not just those with ranges) for manual assignment
      const volumes = await prisma.volume.findMany({
        where: { mangaId },
        select: { id: true, number: true, title: true, chapterStart: true, chapterEnd: true },
        orderBy: { number: 'asc' }
      });

      const unassignedChapters = await prisma.chapter.findMany({
        where: { mangaId, OR: [{ volume: null }, { volume: -1 }] },
        select: { id: true, index: true, chapterNumber: true, title: true },
        orderBy: { index: 'asc' }
      });

      const { assignments, assignedIds } = buildAllVolumeMatches(volumes, unassignedChapters);
      const volumesWithRanges = volumes.filter(hasRange).length;

      const unmatched = unassignedChapters
        .filter(ch => !assignedIds.has(ch.id))
        .map(ch => ({ id: ch.id, title: ch.title, chapterNum: getChapterNum(ch) }))
        .sort((a, b) => a.chapterNum - b.chapterNum);

      return {
        totalUnassigned: unassignedChapters.length,
        wouldAssign: assignedIds.size,
        wouldRemainUnassigned: unmatched.length,
        volumesWithRanges,
        totalVolumes: volumes.length,
        assignments,
        unmatched
      };
    }),

  /**
   * Auto-assign unassigned chapters to volumes based on chapter ranges
   */
  autoAssignToVolumes: protectedProcedure
    .input(z.object({ mangaId: z.number().int().positive() }))
    .mutation(async ({ input }): Promise<{ assigned: number; unassigned: number; message: string }> => {
      const { mangaId } = input;

      const manga = await prisma.manga.findUnique({
        where: { id: mangaId },
        select: { id: true, title: true }
      });

      if (!manga) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Manga not found' });
      }

      // Only get volumes with ranges for auto-assignment
      const volumes = await prisma.volume.findMany({
        where: {
          mangaId,
          OR: [{ chapterStart: { not: null } }, { chapterEnd: { not: null } }]
        },
        select: { id: true, number: true, chapterStart: true, chapterEnd: true },
        orderBy: { number: 'asc' }
      });

      if (volumes.length === 0) {
        return {
          assigned: 0,
          unassigned: 0,
          message: 'No volumes with chapter ranges. Use manual assignment or set ranges on volumes.'
        };
      }

      const unassignedChapters = await prisma.chapter.findMany({
        where: { mangaId, OR: [{ volume: null }, { volume: -1 }] },
        select: { id: true, index: true, chapterNumber: true }
      });

      if (unassignedChapters.length === 0) {
        return { assigned: 0, unassigned: 0, message: 'No unassigned chapters found' };
      }

      // Build update list
      const updates: Array<{ id: number; volume: number; volumeId: number }> = [];
      for (const chapter of unassignedChapters) {
        const chapterNum = getChapterNum(chapter);
        const match = volumes.find(v => isChapterInRange(chapterNum, v.chapterStart, v.chapterEnd));
        if (match) {
          updates.push({ id: chapter.id, volume: match.number, volumeId: match.id });
        }
      }

      if (updates.length > 0) {
        await prisma.$transaction(
          updates.map(u => prisma.chapter.update({
            where: { id: u.id },
            data: { volume: u.volume, volumeId: u.volumeId }
          }))
        );
      }

      const stillUnassigned = unassignedChapters.length - updates.length;
      logger.info(`Auto-assigned ${updates.length} chapters for: ${manga.title} (${stillUnassigned} unassigned)`);

      void realtimeEmitter.emitMangaUpdate({
        mangaId,
        action: 'updated',
        data: { autoAssigned: updates.length, stillUnassigned }
      });

      const msg = updates.length > 0
        ? `Assigned ${updates.length} chapter${updates.length !== 1 ? 's' : ''}${stillUnassigned > 0 ? ` (${stillUnassigned} unmatched)` : ''}`
        : 'No chapters matched volume ranges. Use manual assignment.';

      return { assigned: updates.length, unassigned: stillUnassigned, message: msg };
    }),

  /**
   * Convert a chapter to a volume (when user asserts file is a volume, not a chapter)
   * Creates Volume record if needed and associates the chapter with it
   * Also updates all chapters in that volume to use the volume file
   */
  convertChapterToVolume: protectedProcedure
    .input(z.object({
      chapterId: z.number().int().positive(),
      volumeNumber: z.number().int().positive(),
      mangaId: z.number().int().positive()
    }))
    .mutation(async ({ input }): Promise<{
      volumeId: number;
      volumeNumber: number;
      chaptersUpdated: number;
      message: string;
    }> => {
      const { chapterId, volumeNumber, mangaId } = input;

      const chapter = await prisma.chapter.findUnique({
        where: { id: chapterId },
        select: {
          id: true,
          title: true,
          fileName: true,
          filePath: true,
          fileFormat: true,
          size: true,
          pageCount: true,
          hash: true,
          mimeType: true,
          mangaId: true
        }
      });

      if (chapter?.mangaId !== mangaId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Chapter not found' });
      }

      // The whole convert sequence (find-or-create volume → re-home source
      // chapter → bulk-link siblings → delete the placeholder) runs in one
      // transaction. A mid-sequence failure previously stranded a
      // half-converted state: volume created and source chapter re-homed,
      // but sibling chapters never linked and the placeholder never deleted.
      const { volume, updateResult } = await prisma.$transaction(async (tx) => {
        // Find or create Volume record
        let vol = await tx.volume.findUnique({
          where: { mangaId_number: { mangaId, number: volumeNumber } }
        });

        if (!vol) {
          vol = await tx.volume.create({
            data: {
              mangaId,
              number: volumeNumber,
              title: `Volume ${volumeNumber}`,
              pageCount: chapter.pageCount
            }
          });
          logger.info(`Created Volume ${volumeNumber} for manga ${mangaId}`);
        }

        // Update the source chapter to be associated with this volume (as volume file)
        await tx.chapter.update({
          where: { id: chapterId },
          data: { volume: volumeNumber, volumeId: vol.id, chapterNumber: null }
        });

        // Build match conditions from the volume's chapter range
        const orConditions = buildVolumeChapterMatchConditions(
          volumeNumber, vol.id, vol.chapterStart ?? null, vol.chapterEnd ?? null
        );

        // Update all other chapters in this volume to use the volume file
        // Note: Do NOT update fileName or title - preserve chapter metadata, only set file location
        // Force-update ALL chapters in this volume - user is explicitly saying "use this file"
        const updated = await tx.chapter.updateMany({
          where: {
            mangaId,
            id: { not: chapterId },
            OR: orConditions
          },
          data: {
            filePath: chapter.filePath, fileFormat: chapter.fileFormat,
            size: chapter.size, mimeType: chapter.mimeType, downloadStatus: 'COMPLETED',
            volumeId: vol.id, volume: volumeNumber
          }
        });

        // Delete the source chapter - it was just a file placeholder, now linked to volume
        await tx.chapter.delete({ where: { id: chapterId } });

        return { volume: vol, updateResult: updated };
      });

      logger.info(`Converted file "${chapter.fileName}" to Volume ${volumeNumber}, updated ${updateResult.count} chapters`);

      void realtimeEmitter.emitMangaUpdate({
        mangaId,
        action: 'updated',
        data: { convertedToVolume: volumeNumber, chapterId, chaptersUpdated: updateResult.count }
      });

      return {
        volumeId: volume.id,
        volumeNumber,
        chaptersUpdated: updateResult.count,
        message: `Converted "${chapter.fileName}" to Volume ${volumeNumber} (${updateResult.count} chapters updated)`
      };
    }),

  /**
   * Link a file to an existing chapter (merge file data from unassigned to existing chapter)
   * This copies file info from source chapter to target chapter and deletes the source
   */
  linkFileToChapter: protectedProcedure
    .input(z.object({
      sourceChapterId: z.number().int().positive(),
      targetChapterId: z.number().int().positive(),
      mangaId: z.number().int().positive()
    }))
    .mutation(async ({ input }): Promise<{ targetChapterId: number; message: string }> => {
      const { sourceChapterId, targetChapterId, mangaId } = input;

      // Get source chapter (the unassigned file)
      const source = await prisma.chapter.findUnique({
        where: { id: sourceChapterId },
        select: {
          id: true,
          mangaId: true,
          fileName: true,
          filePath: true,
          fileFormat: true,
          size: true,
          pageCount: true,
          hash: true,
          mimeType: true,
          downloadStatus: true
        }
      });

      if (source?.mangaId !== mangaId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Source chapter not found' });
      }

      // Get target chapter (existing metadata)
      const target = await prisma.chapter.findUnique({
        where: { id: targetChapterId },
        select: { id: true, mangaId: true, title: true, chapterNumber: true, index: true }
      });

      if (target?.mangaId !== mangaId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Target chapter not found' });
      }

      // Copy file data from source to target and delete source in a transaction
      await prisma.$transaction([
        // Update target with file data
        prisma.chapter.update({
          where: { id: targetChapterId },
          data: {
            fileName: source.fileName,
            filePath: source.filePath,
            fileFormat: source.fileFormat,
            size: source.size,
            pageCount: source.pageCount,
            hash: source.hash,
            mimeType: source.mimeType,
            downloadStatus: 'COMPLETED'
          }
        }),
        // Delete source chapter
        prisma.chapter.delete({
          where: { id: sourceChapterId }
        })
      ]);

      const chapterNum = target.chapterNumber ?? target.index;
      logger.info(`Linked file "${source.fileName}" to Chapter ${chapterNum}: ${target.title}`);

      void realtimeEmitter.emitMangaUpdate({
        mangaId,
        action: 'updated',
        data: { linkedFile: source.fileName, targetChapter: chapterNum }
      });

      return {
        targetChapterId,
        message: `Linked "${source.fileName}" to Chapter ${chapterNum}`
      };
    })
});
