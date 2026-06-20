import fs from 'fs/promises';

import { JobType } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { prisma } from '@/server/db';
import { queueManager } from '@/server/queue/queueManager';
import { eventEmitter } from '@/server/services/eventEmitter';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { protectedProcedure } from '@/server/trpc/procedures';
import { requireUserId, requireLibraryOwner } from '@/server/trpc/routers/_shared/library-access';
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
  .mutation(async ({ input, ctx }): Promise<{ jobId: string; message: string; libraryName: string }> => {
    const { libraryId, options } = input;
    const userId = requireUserId(ctx);

    const library = await requireLibraryOwner(prisma, userId, libraryId);

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
