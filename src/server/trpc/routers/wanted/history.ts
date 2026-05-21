/**
 * `getHistory` query — paginated download history with summary stats.
 *
 * Stats are computed over the same filter set MINUS the status field, so the
 * Downloads page's success-rate widget stays meaningful even when the user
 * narrows the list to a single status.
 */

import { type Prisma, DownloadHistoryStatus } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { prisma } from '@/server/db';
import { EventSource } from '@/server/services/events/eventTypes';
import { protectedProcedure } from '@/server/trpc/procedures';
import { type DownloadHistoryEntry, type DownloadHistoryResponse } from '@/types/search.types';
import { logError } from '@/utils/system-event-logger';

import { downloadHistorySearchSchema, type PrismaWhereClause } from './schemas';

function buildHistoryWhere(input: z.infer<typeof downloadHistorySearchSchema>): PrismaWhereClause {
  const where: PrismaWhereClause = {};
  if (input.status?.length) where.status = { in: input.status };
  if (input.dateRange) {
    where.startTime = { gte: input.dateRange.start, lte: input.dateRange.end };
  }
  if (input.source?.length) where.source = { in: input.source };
  if (input.downloadClient?.length) where.downloadClient = { in: input.downloadClient };
  if (input.searchTerm) {
    where.OR = [
      { metadata: { path: ['mangaTitle'], string_contains: input.searchTerm } },
      { metadata: { path: ['chapterTitle'], string_contains: input.searchTerm } }
    ];
  }
  return where;
}

async function computeHistoryStats(statsWhere: Prisma.DownloadHistoryWhereInput): Promise<{
  totalDownloads: number;
  successfulDownloads: number;
  failedDownloads: number;
}> {
  const groups = await prisma.downloadHistory.groupBy({
    by: ['status'],
    where: statsWhere,
    _count: { _all: true }
  });
  const totalDownloads = groups.reduce((sum, g) => sum + g._count._all, 0);
  const successfulDownloads = groups.find(g => g.status === DownloadHistoryStatus.COMPLETED)?._count._all ?? 0;
  const failedDownloads = groups.find(g => g.status === DownloadHistoryStatus.FAILED)?._count._all ?? 0;
  return { totalDownloads, successfulDownloads, failedDownloads };
}

export const getHistory = protectedProcedure.input(downloadHistorySearchSchema).query(async ({ input }) => {
  try {
    const where = buildHistoryWhere(input);
    const statsWhere: PrismaWhereClause = { ...where };
    delete statsWhere.status;

    const [total, entries, stats] = await Promise.all([
      prisma.downloadHistory.count({ where: where as Prisma.DownloadHistoryWhereInput }),
      prisma.downloadHistory.findMany({
        where: where as Prisma.DownloadHistoryWhereInput,
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        orderBy: { startTime: 'desc' },
        include: {
          Manga: { include: { Metadata: true } },
          Chapter: true
        }
      }),
      computeHistoryStats(statsWhere as Prisma.DownloadHistoryWhereInput)
    ]);

    const response: DownloadHistoryResponse = {
      entries: entries.map(entry => entry as unknown as DownloadHistoryEntry),
      total,
      page: input.page,
      pageSize: input.pageSize,
      stats
    };
    return response;
  }
  catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    void logError('Failed to get download history', EventSource.SYSTEM, errorMessage, {
      details: { input }
    });
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to get download history'
    });
  }
});
