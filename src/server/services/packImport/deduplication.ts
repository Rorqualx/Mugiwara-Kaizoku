/**
 * Pack Deduplication Service
 *
 * Prevents downloading duplicate multi-volume packs by checking existing downloads.
 * Ensures users don't download the same pack twice.
 */

import { prisma } from '@/server/db';
import type { PackDeduplicationResult, VolumeRange } from '@/types/pack-download-types';
import type { AsyncResult } from '@/utils/async-result';
import { createSuccessResult, createErrorResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import type { PrismaClient } from '@prisma/client';

export class PackDeduplicationService {
  constructor(private prismaClient: PrismaClient = prisma) {}

  /**
   * Check if a pack download already exists for the given volume range
   *
   * @param mangaId - Manga ID
   * @param volumeRange - Volume range to check (null for series packs)
   * @returns Deduplication result with existing pack info if found
   */
  async checkDuplicate(
    mangaId: number,
    volumeRange: VolumeRange | null
  ): Promise<AsyncResult<PackDeduplicationResult, Error>> {
    try {
      // Query for existing pack downloads that overlap with requested range
      // Only consider packs that actually completed — DOWNLOADING packs may be
      // stale/failed and should not block new download attempts
      const existingPacks = await this.prismaClient.packDownload.findMany({
        where: {
          mangaId,
          status: {
            in: ['COMPLETED', 'IMPORTING', 'IMPORTED']
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      // If no volume range specified (series pack), check for any existing series packs
      if (!volumeRange) {
        const seriesPack = existingPacks.find((pack: typeof existingPacks[number]) =>
          pack.volumeStart === null && pack.volumeEnd === null
        );

        if (seriesPack) {
          logger.info(`[PackDeduplication] Found existing series pack: ${seriesPack.releaseTitle}`);
          return createSuccessResult({
            isDuplicate: true,
            existingPack: {
              ...seriesPack,
              id: Number(seriesPack.id),
              jobId: seriesPack.jobId,
              fileSize: seriesPack.fileSize
            },
            reason: `Full series pack already downloaded: "${seriesPack.releaseTitle}" (Job #${seriesPack.jobId})`,
            coveredVolumes: []
          });
        }

        return createSuccessResult({
          isDuplicate: false
        });
      }

      // Check if any existing pack overlaps with requested range
      for (const pack of existingPacks) {
        // Series pack covers everything
        if (pack.volumeStart === null && pack.volumeEnd === null) {
          logger.info(`[PackDeduplication] Existing series pack covers requested volumes: ${pack.releaseTitle}`);
          return createSuccessResult({
            isDuplicate: true,
            existingPack: {
              ...pack,
              id: Number(pack.id),
              jobId: pack.jobId,
              fileSize: pack.fileSize
            },
            reason: `Full series pack already exists: "${pack.releaseTitle}" (Job #${pack.jobId})`,
            coveredVolumes: this.generateVolumeList(1, 999) // Assume series pack covers all
          });
        }

        // Check if pack ranges overlap
        if (pack.volumeStart !== null && pack.volumeEnd !== null) {
          const overlap = this.checkOverlap(
            volumeRange.start,
            volumeRange.end,
            pack.volumeStart,
            pack.volumeEnd
          );

          if (overlap.hasOverlap) {
            const coveredVolumes = this.generateVolumeList(pack.volumeStart, pack.volumeEnd);
            logger.info(
              `[PackDeduplication] Found overlapping pack: ${pack.releaseTitle} (v${pack.volumeStart}-v${pack.volumeEnd}) overlaps with requested v${volumeRange.start}-v${volumeRange.end}`
            );

            return createSuccessResult({
              isDuplicate: true,
              existingPack: {
                ...pack,
                id: Number(pack.id),
                jobId: pack.jobId,
                fileSize: pack.fileSize
              },
              reason: `Pack "${pack.releaseTitle}" (v${pack.volumeStart}-v${pack.volumeEnd}) already covers ${overlap.overlapDescription} (Job #${pack.jobId})`,
              coveredVolumes
            });
          }
        }
      }

      // No duplicates found
      logger.info(`[PackDeduplication] No duplicate packs found for manga ${mangaId}, volumes ${volumeRange.start}-${volumeRange.end}`);
      return createSuccessResult({
        isDuplicate: false
      });

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Pack deduplication check failed';
      logger.error(`[PackDeduplication] Error checking duplicates:`, error);
      return createErrorResult(new Error(errorMessage));
    }
  }

  /**
   * Get all volumes covered by existing pack downloads for a manga
   *
   * @param mangaId - Manga ID
   * @returns Set of volume numbers that are already covered
   */
  async getCoveredVolumes(mangaId: number): Promise<AsyncResult<Set<number>, Error>> {
    try {
      // Only consider packs that actually completed — DOWNLOADING packs may be
      // stale/failed and should not block new download attempts
      const existingPacks = await this.prismaClient.packDownload.findMany({
        where: {
          mangaId,
          status: {
            in: ['COMPLETED', 'IMPORTING', 'IMPORTED']
          }
        }
      });

      const coveredVolumes = new Set<number>();

      for (const pack of existingPacks) {
        // Packs with null volume range: only treat as "series pack" if IMPORTED
        // (they actually have files on disk). Otherwise skip — the range is unknown.
        if (pack.volumeStart === null && pack.volumeEnd === null) {
          if (pack.status === 'IMPORTED') {
            logger.info(`[PackDeduplication] IMPORTED series pack covers all volumes: ${pack.releaseTitle}`);
            // eslint-disable-next-line max-depth -- depth 5 is the bulk volume-range fill inside the IMPORTED-series-pack short-circuit; flattening would lose the early `break`
            for (let i = 1; i <= 1000; i++) {
              coveredVolumes.add(i);
            }
            break;
          }
          logger.warn(`[PackDeduplication] Pack "${pack.releaseTitle}" has no volume range — skipping coverage`);
          continue;
        }

        // Add all volumes in this pack's range
        if (pack.volumeStart !== null && pack.volumeEnd !== null) {
          for (let vol = pack.volumeStart; vol <= pack.volumeEnd; vol++) {
            coveredVolumes.add(vol);
          }
        }
      }

      logger.info(`[PackDeduplication] Covered volumes for manga ${mangaId}: ${Array.from(coveredVolumes).join(', ')}`);
      return createSuccessResult(coveredVolumes);

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get covered volumes';
      logger.error(`[PackDeduplication] Error getting covered volumes:`, error);
      return createErrorResult(new Error(errorMessage));
    }
  }

  /**
   * Check if two volume ranges overlap
   */
  private checkOverlap(
    start1: number,
    end1: number,
    start2: number,
    end2: number
  ): { hasOverlap: boolean; overlapDescription: string } {
    // No overlap if ranges don't intersect
    if (end1 < start2 || end2 < start1) {
      return { hasOverlap: false, overlapDescription: '' };
    }

    // Calculate overlap range
    const overlapStart = Math.max(start1, start2);
    const overlapEnd = Math.min(end1, end2);

    // Full coverage
    if (overlapStart === start1 && overlapEnd === end1) {
      return {
        hasOverlap: true,
        overlapDescription: `volumes ${start1}-${end1} (full coverage)`
      };
    }

    // Partial overlap
    if (overlapStart === overlapEnd) {
      return {
        hasOverlap: true,
        overlapDescription: `volume ${overlapStart}`
      };
    }

    return {
      hasOverlap: true,
      overlapDescription: `volumes ${overlapStart}-${overlapEnd}`
    };
  }

  /**
   * Generate list of volume numbers from start to end (inclusive)
   */
  private generateVolumeList(start: number, end: number): number[] {
    const volumes: number[] = [];
    for (let i = start; i <= end; i++) {
      volumes.push(i);
    }
    return volumes;
  }

  /**
   * Clean up old failed pack downloads
   *
   * Removes FAILED or CANCELLED packs older than the specified days
   *
   * @param daysOld - Age threshold in days (default: 7)
   * @returns Number of records deleted
   */
  async cleanupOldPacks(daysOld: number = 7): Promise<AsyncResult<number, Error>> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const deleted = await this.prismaClient.packDownload.deleteMany({
        where: {
          status: {
            in: ['FAILED', 'CANCELLED']
          },
          createdAt: {
            lt: cutoffDate
          }
        }
      });

      logger.info(`[PackDeduplication] Cleaned up ${deleted.count} old failed/cancelled pack downloads`);
      return createSuccessResult(deleted.count);

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to cleanup old packs';
      logger.error(`[PackDeduplication] Error cleaning up old packs:`, error);
      return createErrorResult(new Error(errorMessage));
    }
  }
}

/**
 * Factory function to create PackDeduplicationService instance
 */
export function createPackDeduplicationService(prismaClient?: PrismaClient): PackDeduplicationService {
  return new PackDeduplicationService(prismaClient);
}
