/**
 * Conversion job claim helpers
 *
 * Implements the SKIP LOCKED row-claim against ConversionJob. Extracted from
 * ConversionJobWorker.ts so the worker class stays under the project file
 * size cap.
 */

import { ConversionStatus } from '@prisma/client';

import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';

export interface ClaimedJob {
  id: string;
  mangaId: number;
  chapterId: number;
  sourceFilePath: string;
  targetFilePath: string | null;
  sourceFormat: string;
  targetFormat: string;
  attempts: number;
  maxAttempts: number;
}

interface PrismaWithConversionJob {
  conversionJob?: unknown;
}

export function hasConversionJobModel(client: typeof prisma): boolean {
  return 'conversionJob' in (client as PrismaWithConversionJob);
}

export async function claimJobs(batchSize: number, workerId: string): Promise<ClaimedJob[]> {
  try {
    if (!hasConversionJobModel(prisma)) {
      logger.debug('[ConversionWorker] ConversionJob model not available, skipping job claim');
      return [];
    }

    const result = await prisma.$queryRaw<ClaimedJob[]>`
      WITH claimed_jobs AS (
        SELECT id
        FROM "ConversionJob"
        WHERE status = 'PENDING'::"ConversionStatus"
        ORDER BY priority DESC, "createdAt" ASC
        LIMIT ${batchSize}
        FOR UPDATE SKIP LOCKED
      )
      UPDATE "ConversionJob" j
      SET
        status = ${ConversionStatus.PROCESSING}::"ConversionStatus",
        "updatedAt" = NOW()
      FROM claimed_jobs c
      WHERE j.id = c.id
      RETURNING j.id, j."mangaId", j."chapterId", j."sourceFilePath", j."targetFilePath",
                j."sourceFormat", j."targetFormat", j.attempts, j."maxAttempts"
    `;

    if (result.length > 0) {
      logger.debug(`[ConversionWorker] Worker ${workerId} claimed ${result.length} jobs`);
    }

    return result;
  } catch (error: unknown) {
    logger.error('[ConversionWorker] Failed to claim jobs:', error);
    return [];
  }
}
