/**
 * ConversionJob status helpers
 *
 * Free functions for the read-side and lifecycle-terminal operations on a
 * ConversionJob row. The class in FormatConversionService.ts wraps these so
 * existing callers (`service.cancelJob(...)`) keep working.
 */

import { prisma } from '@/server/db';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import type { AsyncResult } from '@/utils/async-result';
import { createSuccessResult, createErrorResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import type { ConversionStatus } from '@prisma/client';

export interface ConversionJobStatus {
  id: string;
  status: ConversionStatus;
  progress: number;
  attempts: number;
  errorMessage?: string;
  sourceFilePath: string;
  targetFilePath?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export interface ConversionStatistics {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  cancelled: number;
}

export async function getJobStatus(jobId: string): Promise<AsyncResult<ConversionJobStatus, Error>> {
  try {
    const job = await prisma.conversionJob.findUnique({ where: { id: jobId } });

    if (!job) {
      return createErrorResult(new Error(`Conversion job not found: ${jobId}`));
    }

    const status: ConversionJobStatus = {
      id: job.id,
      status: job.status,
      progress: job.progress,
      attempts: job.attempts,
      ...(job.errorMessage && { errorMessage: job.errorMessage }),
      sourceFilePath: job.sourceFilePath,
      ...(job.targetFilePath && { targetFilePath: job.targetFilePath }),
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      ...(job.completedAt && { completedAt: job.completedAt })
    };

    return createSuccessResult(status);
  } catch (error: unknown) {
    logger.error('[FormatConversionService] Failed to get job status', error);
    return createErrorResult(error instanceof Error ? error : new Error(String(error)));
  }
}

export async function cancelJob(jobId: string): Promise<AsyncResult<void, Error>> {
  try {
    await prisma.conversionJob.update({
      where: { id: jobId },
      data: { status: 'CANCELLED', updatedAt: new Date() }
    });

    logger.info('[FormatConversionService] Conversion job cancelled', { jobId });

    void realtimeEmitter.emitConversionJob({ jobId, status: 'cancelled' });

    return createSuccessResult(undefined);
  } catch (error: unknown) {
    logger.error('[FormatConversionService] Failed to cancel job', error);
    return createErrorResult(error instanceof Error ? error : new Error(String(error)));
  }
}

export async function failJob(jobId: string, errorMessage: string): Promise<void> {
  await prisma.conversionJob.update({
    where: { id: jobId },
    data: { status: 'FAILED', errorMessage, updatedAt: new Date() }
  });

  logger.error('[FormatConversionService] Conversion job failed', { jobId, errorMessage });

  void realtimeEmitter.emitConversionJob({ jobId, status: 'failed', error: errorMessage });
}

export async function getPendingJobs(limit: number = 10): Promise<AsyncResult<string[], Error>> {
  try {
    const jobs = await prisma.conversionJob.findMany({
      where: { status: 'PENDING' },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      take: limit,
      select: { id: true }
    });

    return createSuccessResult(jobs.map(job => job.id));
  } catch (error: unknown) {
    logger.error('[FormatConversionService] Failed to get pending jobs', error);
    return createErrorResult(error instanceof Error ? error : new Error(String(error)));
  }
}

export async function getStatistics(): Promise<ConversionStatistics> {
  try {
    const [total, pending, processing, completed, failed, cancelled] = await Promise.all([
      prisma.conversionJob.count(),
      prisma.conversionJob.count({ where: { status: 'PENDING' } }),
      prisma.conversionJob.count({ where: { status: 'PROCESSING' } }),
      prisma.conversionJob.count({ where: { status: 'COMPLETED' } }),
      prisma.conversionJob.count({ where: { status: 'FAILED' } }),
      prisma.conversionJob.count({ where: { status: 'CANCELLED' } })
    ]);

    return { total, pending, processing, completed, failed, cancelled };
  } catch (error: unknown) {
    logger.error('[FormatConversionService] Failed to get statistics', error);
    return { total: 0, pending: 0, processing: 0, completed: 0, failed: 0, cancelled: 0 };
  }
}
