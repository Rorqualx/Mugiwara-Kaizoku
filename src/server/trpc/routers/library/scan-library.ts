import fs from 'fs/promises';

import { JobType } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { prisma } from '@/server/db';
import { queueManager } from '@/server/queue/queueManager';
import { eventEmitter } from '@/server/services/eventEmitter';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { protectedProcedure } from '@/server/trpc/procedures';
import { logger } from '@/utils/logger';

export const scanLibraryProcedure = protectedProcedure
  .input(z.object({
    libraryId: z.number(),
    path: z.string().optional(),
    options: z.object({
      fullScan: z.boolean().optional().default(false),
      autoMatch: z.boolean().optional().default(true),
      skipExisting: z.boolean().optional().default(true),
      preview: z.boolean().optional().default(true)
    }).optional()
  }))
  .mutation(async ({ input }): Promise<{ jobId: string; message: string; libraryName: string }> => {
    const { libraryId, options } = input;

    const library = await prisma.library.findUnique({
      where: { id: libraryId }
    });

    if (!library) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: `Library with ID ${libraryId} not found`
      });
    }

    const scanPath = input.path ?? library.path;

    try {
      await fs.access(scanPath);
    } catch {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Scan path is not accessible: ${scanPath}`
      });
    }

    logger.info(`Enqueueing library scan for "${library.name}"`, {
      libraryId,
      scanPath,
      options
    });

    const jobId = await queueManager.enqueue(JobType.library_scan, {
      libraryId,
      path: scanPath,
      fullScan: options?.fullScan ?? false,
      autoMatch: options?.autoMatch ?? true,
      skipExisting: options?.skipExisting ?? true,
      preview: options?.preview ?? true
    });

    await eventEmitter.emit('library:scan:started', {
      libraryId,
      libraryName: library.name,
      path: scanPath
    });

    void realtimeEmitter.emitLibraryScanProgress({
      libraryId,
      status: 'started',
      progress: 0
    });

    logger.info('Library scan job enqueued', {
      jobId: jobId.toString(),
      libraryId,
      libraryName: library.name
    });

    return {
      jobId: jobId.toString(),
      message: `Scan started for library "${library.name}"`,
      libraryName: library.name
    };
  });
