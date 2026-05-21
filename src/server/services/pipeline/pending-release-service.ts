/**
 * Pending Release Service
 *
 * Manages temporarily rejected releases that may be re-evaluated later.
 * When the scoring algorithm rejects a release for a transient reason
 * (e.g. low seeders, temporary size issue) the release is stored here
 * so the user can manually approve it or it can be reconsidered.
 *
 * MIGRATION REQUIRED: This service depends on the PendingRelease model
 * being added to prisma/schema.prisma and a migration being run.
 * Until the migration is applied, all operations will return safe
 * error results instead of crashing.
 *
 * @module server/services/pipeline/pending-release-service
 */

import type { ProwlarrSearchResult } from '@/types/prowlarr';
import type { AsyncResult } from '@/utils/async-result';
import { createSuccessResult, createErrorResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import type { PrismaClient } from '@prisma/client';

// ============================================================================
// Types
// ============================================================================

/** Parameters for adding a new pending release */
export interface AddPendingReleaseParams {
  mangaId: number;
  chapterId?: number | undefined;
  releaseTitle: string;
  indexer: string;
  downloadUrl: string;
  size?: number | undefined;
  seeders?: number | undefined;
  score: number;
  rejectionReason: string;
  prowlarrResult: ProwlarrSearchResult;
  expiresInDays?: number;
}

/** Shape of a PendingRelease row (before Prisma model exists) */
export interface PendingReleaseRow {
  id: number;
  mangaId: number;
  chapterId: number | null;
  releaseTitle: string;
  indexer: string;
  downloadUrl: string;
  size: bigint | null;
  seeders: number | null;
  score: number;
  rejectionReason: string;
  prowlarrResult: unknown;
  addedAt: Date;
  expiresAt: Date;
  status: string;
}

/** Temporary type for PrismaClient until the PendingRelease model is generated */
interface PendingReleaseDelegate {
  create: (args: {
    data: Record<string, unknown>;
  }) => Promise<{ id: number }>;
  findMany: (args: {
    where: Record<string, unknown>;
    orderBy?: Record<string, unknown>;
  }) => Promise<unknown[]>;
  updateMany: (args: {
    where: Record<string, unknown>;
    data: Record<string, unknown>;
  }) => Promise<{ count: number }>;
  update: (args: {
    where: Record<string, unknown>;
    data: Record<string, unknown>;
  }) => Promise<unknown>;
  count: (args: { where: Record<string, unknown> }) => Promise<number>;
}

// ============================================================================
// Constants & helpers
// ============================================================================

const DEFAULT_EXPIRY_DAYS = 7;
const TAG = '[PendingReleaseService]';

function getDelegate(prisma: PrismaClient): PendingReleaseDelegate {
  return (prisma as unknown as { pendingRelease: PendingReleaseDelegate })
    .pendingRelease;
}

function buildCreateData(
  params: AddPendingReleaseParams,
  expiresAt: Date,
): Record<string, unknown> {
  return {
    mangaId: params.mangaId,
    ...(params.chapterId !== undefined ? { chapterId: params.chapterId } : {}),
    releaseTitle: params.releaseTitle,
    indexer: params.indexer,
    downloadUrl: params.downloadUrl,
    ...(params.size !== undefined ? { size: BigInt(params.size) } : {}),
    ...(params.seeders !== undefined ? { seeders: params.seeders } : {}),
    score: params.score,
    rejectionReason: params.rejectionReason,
    prowlarrResult: params.prowlarrResult as unknown as Record<string, unknown>,
    expiresAt,
  };
}

function buildDismissWhere(
  mangaId: number,
  chapterIds?: number[],
): Record<string, unknown> {
  const where: Record<string, unknown> = { mangaId, status: 'PENDING' };
  const hasChapterIds = chapterIds !== undefined && chapterIds.length > 0;
  if (hasChapterIds) {
    where['chapterId'] = { in: chapterIds };
  }
  return where;
}

function buildCountWhere(mangaId?: number): Record<string, unknown> {
  const where: Record<string, unknown> = {
    status: 'PENDING',
    expiresAt: { gt: new Date() },
  };
  if (mangaId !== undefined) {
    where['mangaId'] = mangaId;
  }
  return where;
}

function isTableMissingError(message: string): boolean {
  return (
    message.includes('does not exist') ||
    message.includes('P2021') ||
    message.includes('pendingRelease')
  );
}

function toPrismaError<T>(method: string, error: unknown): AsyncResult<T, Error> {
  const message = error instanceof Error ? error.message : String(error);
  if (isTableMissingError(message)) {
    logger.warn(`${TAG} PendingRelease table not available. ${method} skipped.`);
    return createErrorResult(new Error('PendingRelease table not available - run prisma migration'));
  }
  logger.error(`${TAG} ${method} failed`, { error: message });
  return createErrorResult(error instanceof Error ? error : new Error(message));
}

function logDismissed(count: number, mangaId: number, chapterIds?: number[]): void {
  if (count > 0) {
    logger.info(`${TAG} Dismissed ${count} pending releases`, { mangaId, chapterIds });
  }
}

function logExpired(count: number): void {
  if (count > 0) {
    logger.info(`${TAG} Expired ${count} old pending releases`);
  }
}

function computeExpiresAt(days?: number): Date {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + (days ?? DEFAULT_EXPIRY_DAYS));
  return expiresAt;
}

// ============================================================================
// Service
// ============================================================================

export class PendingReleaseService {
  constructor(private prisma: PrismaClient) {}

  /** Store a temporarily rejected release for later re-evaluation */
  async addPendingRelease(
    params: AddPendingReleaseParams,
  ): Promise<AsyncResult<{ id: number }, Error>> {
    try {
      const expiresAt = computeExpiresAt(params.expiresInDays);
      const delegate = getDelegate(this.prisma);
      const record = await delegate.create({ data: buildCreateData(params, expiresAt) });

      logger.info(`${TAG} Added pending release`, {
        id: record.id, releaseTitle: params.releaseTitle,
        mangaId: params.mangaId, reason: params.rejectionReason,
      });
      return createSuccessResult({ id: record.id });
    } catch (error: unknown) {
      return toPrismaError('addPendingRelease', error);
    }
  }

  /** Get all pending releases for a manga, ordered by score descending */
  async getPendingReleases(mangaId: number): Promise<AsyncResult<PendingReleaseRow[], Error>> {
    try {
      const delegate = getDelegate(this.prisma);
      const releases = await delegate.findMany({
        where: { mangaId, status: 'PENDING', expiresAt: { gt: new Date() } },
        orderBy: { score: 'desc' },
      });
      return createSuccessResult(releases as PendingReleaseRow[]);
    } catch (error: unknown) {
      return toPrismaError('getPendingReleases', error);
    }
  }

  /** Dismiss pending releases when a download succeeds for the same manga */
  async dismissForManga(mangaId: number, chapterIds?: number[]): Promise<AsyncResult<number, Error>> {
    try {
      const delegate = getDelegate(this.prisma);
      const result = await delegate.updateMany({
        where: buildDismissWhere(mangaId, chapterIds),
        data: { status: 'DISMISSED' },
      });
      logDismissed(result.count, mangaId, chapterIds);
      return createSuccessResult(result.count);
    } catch (error: unknown) {
      return toPrismaError('dismissForManga', error);
    }
  }

  /** Approve a pending release (mark as APPROVED for downstream processing) */
  async approveRelease(id: number): Promise<AsyncResult<void, Error>> {
    try {
      const delegate = getDelegate(this.prisma);
      await delegate.update({ where: { id }, data: { status: 'APPROVED' } });
      logger.info(`${TAG} Approved pending release`, { id });
      return createSuccessResult(undefined);
    } catch (error: unknown) {
      return toPrismaError('approveRelease', error);
    }
  }

  /** Expire old pending releases past their expiresAt date */
  async expireOldReleases(): Promise<AsyncResult<number, Error>> {
    try {
      const delegate = getDelegate(this.prisma);
      const result = await delegate.updateMany({
        where: { status: 'PENDING', expiresAt: { lte: new Date() } },
        data: { status: 'EXPIRED' },
      });
      logExpired(result.count);
      return createSuccessResult(result.count);
    } catch (error: unknown) {
      return toPrismaError('expireOldReleases', error);
    }
  }

  /** Get count of pending releases, optionally scoped to a manga */
  async getPendingCount(mangaId?: number): Promise<AsyncResult<number, Error>> {
    try {
      const delegate = getDelegate(this.prisma);
      const count = await delegate.count({ where: buildCountWhere(mangaId) });
      return createSuccessResult(count);
    } catch (error: unknown) {
      return toPrismaError('getPendingCount', error);
    }
  }
}
