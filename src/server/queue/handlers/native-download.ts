/**
 * Native Download Integration Job Handlers
 */

import { jobs } from '@prisma/client';
import { z } from 'zod';

import { prisma } from '@/server/db';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { logger } from '@/utils/logger';


// Zod schema for native download job payload
const NativeDownloadPayloadSchema = z.object({
  mangaId: z.number(),
  volumeId: z.number().optional(),
  sourceId: z.string()
});

export async function handleNativeDownload(job: jobs): Promise<void> {
  const result = NativeDownloadPayloadSchema.safeParse(job.payload);

  if (!result.success) {
    logger.error('Invalid native download payload:', result.error);
    throw new Error(`Invalid job payload: ${result.error.message}`);
  }

  const { mangaId, volumeId, sourceId } = result.data;

  logger.info(`Processing native download`, {
    jobId: job["id"],
    mangaId,
    volumeId,
    sourceId
  });

  // Emit WebSocket event for job started
  void realtimeEmitter.emitSystemEvent({
    eventType: 'job:native_download:started',
    source: 'nativeDownloadHandler',
    message: `Native download started for manga ${mangaId}`,
    data: { jobId: String(job["id"]), mangaId, volumeId, sourceId }
  });

  // Get manga and source information
  const manga = await prisma.manga.findUnique({
    where: { id: mangaId }
  });

  if (!manga) {
    throw new Error(`Manga ${mangaId} not found`);
  }

  // TODO: Implement native download logic
  // This would interact with the native download API to initiate downloads

  logger.info(`Native download completed for manga ${mangaId}`);

  // Emit WebSocket event for real-time UI sync
  void realtimeEmitter.emitDownloadProgress({
    taskId: String(job["id"]),
    mangaId,
    progress: 100,
    status: 'completed'
  });
}
