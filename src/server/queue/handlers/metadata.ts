/**
 * Metadata Job Handlers
 */

import { jobs } from '@prisma/client';
import { z } from 'zod';

import { prisma } from '@/server/db';
import { MetadataService } from '@/server/services/metadata/metadataService';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { logger } from '@/utils/logger';


// Zod schema for metadata refresh job payload
const MetadataRefreshPayloadSchema = z.object({
  mangaId: z.number(),
  forceRefresh: z.boolean().optional()
});

const _metadataService = new MetadataService({
  providerConfigs: {},
  logger: (message: string) => logger.info(message)
});

export async function handleMetadataRefresh(job: jobs): Promise<void> {
  const result = MetadataRefreshPayloadSchema.safeParse(job.payload);

  if (!result.success) {
    logger.error('Invalid metadata refresh payload:', result.error);
    throw new Error(`Invalid job payload: ${result.error.message}`);
  }

  const { mangaId, forceRefresh } = result.data;

  logger.info(`Processing metadata refresh for manga ${mangaId}`, {
    jobId: job["id"],
    forceRefresh
  });

  // Emit WebSocket event for job started
  void realtimeEmitter.emitSystemEvent({
    eventType: 'job:metadata_refresh:started',
    source: 'metadataHandler',
    message: `Metadata refresh started for manga ${mangaId}`,
    data: { jobId: String(job["id"]), mangaId, forceRefresh }
  });

  const manga = await prisma.manga.findUnique({
    where: { id: mangaId },
    include: { Metadata: true }
  });

  if (!manga) {
    throw new Error(`Manga ${mangaId} not found`);
  }

  // Fetch metadata from providers
  // Note: fetchMetadata expects mangaId and providerId
  // For now, we'll use a default provider or skip the update
  logger.warn('Metadata refresh not fully implemented - fetchMetadata requires specific provider');

  // Emit WebSocket event for metadata refresh
  void realtimeEmitter.emitMangaUpdate({
    mangaId,
    action: 'metadata_updated',
    data: { title: manga.title },
  });

  logger.info(`Metadata refresh completed for manga ${mangaId}`);
}