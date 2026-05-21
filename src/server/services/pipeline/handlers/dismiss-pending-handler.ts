/**
 * Dismiss Pending Handler
 *
 * Automatically dismisses pending releases when a download or import
 * succeeds for the same manga. This prevents stale pending releases
 * from cluttering the queue after a successful acquisition.
 *
 * @module server/services/pipeline/handlers/dismiss-pending-handler
 */

import { PendingReleaseService } from '@/server/services/pipeline/pending-release-service';
import { pipelineEventBus } from '@/server/services/pipeline/pipeline-event-bus';
import { PIPELINE_EVENTS } from '@/types/domain/pipeline-events';
import { logger } from '@/utils/logger';

import type { PrismaClient } from '@prisma/client';

const TAG = '[DismissPendingHandler]';

/**
 * Register handlers that dismiss pending releases on successful events
 */
export function registerDismissPendingHandler(prisma: PrismaClient): void {
  const service = new PendingReleaseService(prisma);

  pipelineEventBus.on(PIPELINE_EVENTS.DOWNLOAD_COMPLETED, (event) => {
    void service.dismissForManga(event.mangaId);
  });

  pipelineEventBus.on(PIPELINE_EVENTS.IMPORT_COMPLETED, (event) => {
    void service.dismissForManga(event.mangaId, event.chapterIds);
  });

  logger.debug(`${TAG} Dismiss pending handler registered`);
}
