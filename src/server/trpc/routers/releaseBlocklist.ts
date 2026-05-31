import { ReleaseBlocklistReason } from '@prisma/client';
import { z } from 'zod';

/**
 * Release Blocklist Router
 *
 * tRPC router for managing release blocklist operations.
 * Provides procedures for checking, adding, removing, and searching blocked releases.
 *
 * @module server/trpc/routers/releaseBlocklist
 */

import { prisma } from '@/server/db';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { getReleaseBlocklistService } from '@/server/services/releaseBlocklistService';
import type { AddReleaseBlocklistInput } from '@/server/services/releaseBlocklistService';
import { isSuccess, isError } from '@/utils/async-result';
import { ValidationError } from '@/utils/errors';


import { protectedProcedure } from '../procedures';
import { router } from '../trpc';
// Input schemas
const releaseIdentifierSchema = z.object({
  releaseTitle: z.string(),
  releaseHash: z.string().optional(),
  indexerId: z.string().optional(),
  mangaId: z.number().optional(),
  chapterNumber: z.string().optional(),
  source: z.string().optional()
});
const addBlocklistSchema = z.object({
  release: releaseIdentifierSchema,
  reason: z.nativeEnum(ReleaseBlocklistReason),
  reasonDetails: z.string().optional(),
  blockPattern: z.string().optional(),
  releaseGroup: z.string().optional(),
  expiryDays: z.number().optional()
});
const searchBlocklistSchema = z.object({
  searchTerm: z.string().optional(),
  reason: z.array(z.nativeEnum(ReleaseBlocklistReason)).optional(),
  includeInactive: z.boolean().optional(),
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0)
});
export const releaseBlocklistRouter = router({
  /**
   * Check if a release is blocked
   */
  check: protectedProcedure.input(releaseIdentifierSchema).query(async ({ input }) => {
    const service = getReleaseBlocklistService(prisma);
    // Transform input to match ReleaseIdentifier with exactOptionalPropertyTypes
    const releaseIdentifier = {
      releaseTitle: input.releaseTitle,
      ...(input.releaseHash !== undefined ? { releaseHash: input.releaseHash } : {}),
      ...(input.indexerId !== undefined ? { indexerId: input.indexerId } : {}),
      ...(input.mangaId !== undefined ? { mangaId: input.mangaId } : {}),
      ...(input.chapterNumber !== undefined ? { chapterNumber: Number(input.chapterNumber) } : {}),
      ...(input.source !== undefined ? { source: input.source } : {})
    };
    const result = await service.checkRelease(releaseIdentifier);
    if (isError(result)) {
      throw result.error;
    }
    if (isSuccess(result)) {
      return result.data;
    }
    throw new ValidationError('Unknown result state');
  }),
  /**
   * Block a release
   */
  block: protectedProcedure.input(addBlocklistSchema).mutation(async ({ input, ctx }) => {
    const service = getReleaseBlocklistService(prisma);
    const userId = ctx.user.id;
    // blocklist-manager validates `input.release`, so the identifier must be
    // nested — a flat shape silently fails with "Invalid release identifier"
    // and the cancel-and-blocklist jobs action drops the block on the floor.
    const blocklistInput: AddReleaseBlocklistInput = {
      release: {
        releaseTitle: input.release.releaseTitle,
        ...(input.release.releaseHash !== undefined ? { releaseHash: input.release.releaseHash } : {}),
        ...(input.release.indexerId !== undefined ? { indexerId: input.release.indexerId } : {}),
        ...(input.release.mangaId !== undefined ? { mangaId: input.release.mangaId } : {}),
        ...(input.release.chapterNumber !== undefined ? { chapterNumber: Number(input.release.chapterNumber) } : {}),
        ...(input.release.source !== undefined ? { source: input.release.source } : {}),
      },
      reason: input.reason,
      ...(input.reasonDetails !== undefined ? { reasonDetails: input.reasonDetails } : {}),
      ...(input.blockPattern !== undefined ? { blockPattern: input.blockPattern } : {}),
      ...(input.releaseGroup !== undefined ? { releaseGroup: input.releaseGroup } : {}),
    };
    const result = await service.blockRelease(blocklistInput, userId);
    if (isError(result)) {
      throw result.error;
    }
    // Emit WebSocket event for real-time sync
    void realtimeEmitter.emitSystemEvent({
      eventType: 'blocklist:blocked',
      source: 'releaseBlocklist-router',
      message: `Release blocked: ${input.release.releaseTitle}`,
      data: { releaseTitle: input.release.releaseTitle, reason: input.reason },
    });
    return {
      success: true
    };
  }),
  /**
   * Remove a release from blocklist
   */
  remove: protectedProcedure.input(z.object({
    id: z.string()
  })).mutation(async ({ input }) => {
    // Mark as inactive instead of deleting
    await prisma.releaseBlocklist.update({
      where: {
        id: input["id"]
      },
      data: {
        isActive: false
      }
    });
    // Emit WebSocket event for real-time sync
    void realtimeEmitter.emitSystemEvent({
      eventType: 'blocklist:removed',
      source: 'releaseBlocklist-router',
      message: 'Release removed from blocklist',
      data: { id: input.id },
    });
    return {
      success: true
    };
  }),
  /**
   * Count active blocklist entries scoped to a single manga. Drives the
   * visibility of the manga-header "Clear blocklist" action — we don't want
   * to render the icon when there's nothing to clear.
   */
  countForManga: protectedProcedure.input(z.object({
    mangaId: z.number()
  })).query(async ({ input }) => {
    const count = await prisma.releaseBlocklist.count({
      where: { mangaId: input.mangaId, isActive: true }
    });
    return { count };
  }),

  /**
   * Bulk-clear all active blocklist entries for a single manga. Used by the
   * manga-header "Clear blocklist" action when the dispatcher gets starved
   * by auto-blocklisted releases (typical after multiple cancelled torrents
   * with no peers). Soft-clears via isActive=false to mirror {@link remove},
   * preserving history.
   */
  clearForManga: protectedProcedure.input(z.object({
    mangaId: z.number()
  })).mutation(async ({ input }) => {
    const updated = await prisma.releaseBlocklist.updateMany({
      where: { mangaId: input.mangaId, isActive: true },
      data: { isActive: false }
    });
    void realtimeEmitter.emitSystemEvent({
      eventType: 'blocklist:cleared',
      source: 'releaseBlocklist-router',
      message: `Cleared ${updated.count} blocklist entries for manga ${input.mangaId}`,
      data: { mangaId: input.mangaId, clearedCount: updated.count },
    });
    return {
      success: true,
      clearedCount: updated.count,
    };
  }),

  /**
   * Search blocklist entries
   */
  search: protectedProcedure.input(searchBlocklistSchema).query(async ({ input }) => {
    const where: Record<string, unknown> = {
      isActive: input.includeInactive ? undefined : true
    };
    if (input.searchTerm) {
      where["OR"] = [{
        releaseTitle: {
          contains: input.searchTerm,
          mode: 'insensitive'
        }
      }, {
        releaseGroup: {
          contains: input.searchTerm,
          mode: 'insensitive'
        }
      }, {
        reasonDetails: {
          contains: input.searchTerm,
          mode: 'insensitive'
        }
      }];
    }
    if (input.reason && input.reason.length > 0) {
      where['reason'] = {
        in: input.reason
      };
    }
    const [entries, total] = await Promise.all([prisma.releaseBlocklist.findMany({
      where,
      skip: input.offset,
      take: input.limit,
      orderBy: {
        dateAdded: 'desc'
      },
      include: {
        manga: {
          select: {
            title: true
          }
        }
      }
    }), prisma.releaseBlocklist.count({
      where
    })]);
    return {
      entries,
      total,
      hasMore: total > input.offset + input.limit
    };
  }),
  /**
   * Get blocklist statistics
   */
  getStatistics: protectedProcedure.query(async () => {
    const service = getReleaseBlocklistService(prisma);
    const result = await service.getStatistics();
    if (isError(result)) {
      throw result.error;
    }
    if (isSuccess(result)) {
      return result.data;
    }
    throw new ValidationError('Unknown result state');
  }),
  /**
   * Get blocked release groups
   */
  getBlockedGroups: protectedProcedure.query(async () => {
    const groups = await prisma.releaseBlocklist.groupBy({
      by: ['group'],
      where: {
        group: {
          not: null
        },
        isActive: true
      },
      _count: {
        group: true
      }
    });
    return groups
      .filter((g): g is typeof g & { group: string } => g.group !== null)
      .map((g) => ({
        name: g.group,
        count: g._count.group
      }));
  }),
  /**
   * Get block patterns
   */
  getPatterns: protectedProcedure.query(async () => {
    const patterns = await prisma.releaseBlocklist.findMany({
      where: {
        pattern: {
          not: null
        },
        isActive: true
      },
      select: {
        id: true,
        pattern: true,
        reason: true,
        details: true,
        dateAdded: true
      }
    });
    return patterns;
  })
});