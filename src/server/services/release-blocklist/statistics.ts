/**
 * Release Blocklist Statistics
 *
 * Provides statistics and metrics for blocklist entries.
 *
 * Extracted from: releaseBlocklistService.ts (lines 436-545)
 */

import type { AsyncResult } from '@/utils/async-result';
import { createSuccessResult, createErrorResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import {
  ReleaseBlocklistReason,
  isValidBlocklistReason
} from './types';

import type {
  BlocklistStatistics
} from './types';
import type { PrismaClient } from '@prisma/client';

/**
 * Get blocklist statistics
 *
 * @param prisma - Prisma client
 * @returns AsyncResult with statistics
 */
export async function getStatistics(
  prisma: PrismaClient
): Promise<AsyncResult<BlocklistStatistics, Error>> {
  try {
    const [total, _active, _expired, byReason, autoBlocked] = await Promise.all([
      prisma.releaseBlocklist.count(),
      prisma.releaseBlocklist.count({
        where: {
          isActive: true,
          OR: [
            { expiryDate: null },
            { expiryDate: { gt: new Date() } }
          ]
        }
      }),
      prisma.releaseBlocklist.count({
        where: {
          expiryDate: { lt: new Date() }
        }
      }),
      prisma.releaseBlocklist.groupBy({
        by: ['reason'],
        _count: true
      }),
      prisma.releaseBlocklist.count({
        where: { autoBlocked: true }
      })
    ]);

    // Convert reason counts to record
    const reasonCounts: Record<ReleaseBlocklistReason, number> = Object.fromEntries(
      Object.values(ReleaseBlocklistReason).map(reason => [reason, 0])
    ) as Record<ReleaseBlocklistReason, number>;

    for (const item of byReason) {
      if (isValidBlocklistReason(item.reason)) {
        reasonCounts[item.reason as ReleaseBlocklistReason] = item._count;
      }
    }

    // Get most blocked sources
    const sourceCounts = await prisma.releaseBlocklist.groupBy({
      by: ['group'],
      where: {
        group: { not: null }
      },
      _count: true,
      orderBy: {
        _count: {
          group: 'desc'
        }
      },
      take: 5
    });

    const mostBlockedSources = sourceCounts.map(item => ({
      source: item.group ?? 'Unknown',
      count: item._count
    }));

    // Get recently blocked
    const recentlyBlocked = await prisma.releaseBlocklist.findMany({
      take: 10,
      orderBy: {
        dateAdded: 'desc'
      },
      select: {
        id: true,
        title: true,
        reason: true,
        details: true,
        dateAdded: true,
        autoBlocked: true,
        hash: true,
        pattern: true,
        group: true,
        mangaId: true
      }
    });

    return createSuccessResult<BlocklistStatistics>({
      totalBlocked: total,
      autoBlocked,
      reasonCounts,
      mostBlockedSources,
      recentlyBlocked: recentlyBlocked.map(entry => ({
        id: entry.id,
        releaseTitle: entry.title ?? '',
        reason: entry.reason,
        createdAt: entry.dateAdded,
        updatedAt: entry.dateAdded,
        autoBlocked: entry.autoBlocked,
        // FIX line 615: Use nullish coalescing and optional properties
        ...(entry.details && { details: entry.details }),
        ...(entry.group && { source: entry.group }),
        ...(entry.mangaId && { mangaId: entry.mangaId })
      }))
    });
  } catch (error: unknown) {
    logger.error('Error getting blocklist statistics', {
      error: error instanceof Error ? error.message : String(error)
    });
    return createErrorResult(
      error instanceof Error ? error : new Error('Failed to get blocklist statistics')
    );
  }
}
