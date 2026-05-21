/**
 * Conversion job retry / failure / metrics helpers
 *
 * Free functions for ConversionJobWorker so the class stays a thin
 * orchestrator. recoverStaleJobs + getQueueMetrics also live here so the
 * worker file doesn't carry static-method bodies in addition to the
 * instance loop.
 */

import { ConversionStatus } from '@prisma/client';

import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';

import { hasConversionJobModel } from './worker-claim';

export interface FailureOutcome {
  shouldRetry: boolean;
  newAttempts: number;
}

export async function persistJobFailure(
  jobId: string,
  attempts: number,
  maxAttempts: number,
  errorMessage: string
): Promise<FailureOutcome> {
  const newAttempts = attempts + 1;
  const shouldRetry = newAttempts < maxAttempts;

  if (!hasConversionJobModel(prisma)) {
    return { shouldRetry, newAttempts };
  }

  const data = {
    status: shouldRetry ? ConversionStatus.PENDING : ConversionStatus.FAILED,
    errorMessage,
    attempts: newAttempts,
    updatedAt: new Date(),
    ...(shouldRetry ? {} : { completedAt: new Date() })
  };

  await prisma.conversionJob.update({ where: { id: jobId }, data });

  return { shouldRetry, newAttempts };
}

export async function recoverStaleJobs(staleThresholdMinutes = 30): Promise<number> {
  try {
    if (!hasConversionJobModel(prisma)) {
      logger.debug('[ConversionWorker] ConversionJob model not available, skipping stale job recovery');
      return 0;
    }

    const staleThreshold = new Date(Date.now() - staleThresholdMinutes * 60 * 1000);

    const result = await prisma.conversionJob.updateMany({
      where: {
        status: ConversionStatus.PROCESSING,
        updatedAt: { lt: staleThreshold }
      },
      data: { status: ConversionStatus.PENDING, updatedAt: new Date() }
    });

    if (result.count > 0) {
      logger.info(`[ConversionWorker] Recovered ${result.count} stale conversion jobs`);
    }

    return result.count;
  } catch (error: unknown) {
    logger.error('[ConversionWorker] Failed to recover stale jobs:', error);
    return 0;
  }
}

export interface QueueMetrics {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  cancelled: number;
}

const STATUS_BUCKETS: Array<[ConversionStatus, keyof QueueMetrics]> = [
  [ConversionStatus.PENDING, 'pending'],
  [ConversionStatus.PROCESSING, 'processing'],
  [ConversionStatus.COMPLETED, 'completed'],
  [ConversionStatus.FAILED, 'failed'],
  [ConversionStatus.CANCELLED, 'cancelled']
];

function emptyMetrics(): QueueMetrics {
  return { pending: 0, processing: 0, completed: 0, failed: 0, cancelled: 0 };
}

function bucketFor(status: ConversionStatus): keyof QueueMetrics | null {
  const match = STATUS_BUCKETS.find(([s]) => s === status);
  return match ? match[1] : null;
}

export async function getQueueMetrics(): Promise<QueueMetrics> {
  if (!hasConversionJobModel(prisma)) {
    logger.debug('[ConversionWorker] ConversionJob model not available, returning empty metrics');
    return emptyMetrics();
  }

  const stats = await prisma.conversionJob.groupBy({
    by: ['status'],
    _count: { _all: true }
  });

  const result = emptyMetrics();
  for (const stat of stats) {
    const bucket = bucketFor(stat.status);
    if (bucket === null) {
      logger.warn(`[ConversionWorker] Unknown conversion status: ${String(stat.status)}`);
      continue;
    }
    result[bucket] = stat._count._all;
  }

  return result;
}
