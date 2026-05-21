/**
 * Pending Release Handler
 *
 * Listens for RELEASE_REJECTED pipeline events and stores temporarily
 * rejected releases in the PendingRelease table for later re-evaluation.
 *
 * Permanently rejected releases are ignored (they should never be retried).
 *
 * @module server/services/pipeline/handlers/pending-release-handler
 */

import { PendingReleaseService } from '@/server/services/pipeline/pending-release-service';
import { pipelineEventBus } from '@/server/services/pipeline/pipeline-event-bus';
import { PIPELINE_EVENTS } from '@/types/domain/pipeline-events';
import type { ReleaseRejectedEvent } from '@/types/domain/pipeline-events';
import { logger } from '@/utils/logger';

import type { PrismaClient } from '@prisma/client';

const TAG = '[PendingReleaseHandler]';

/**
 * Handle a single release-rejected event by persisting it
 */
async function handleRejectedRelease(
  service: PendingReleaseService,
  event: ReleaseRejectedEvent,
): Promise<void> {
  // Only store temporarily rejected releases
  if (event.rejectionType !== 'temporary') {
    return;
  }

  const result = await service.addPendingRelease({
    mangaId: event.mangaId,
    chapterId: event.chapterId,
    releaseTitle: event.releaseTitle,
    indexer: event.indexer,
    downloadUrl: event.downloadUrl,
    size: event.size,
    seeders: event.seeders,
    score: event.score,
    rejectionReason: event.rejectionReason,
    prowlarrResult: event.prowlarrResult,
  });

  if (result.status === 'error') {
    logger.warn(`${TAG} Failed to store pending release`, {
      releaseTitle: event.releaseTitle,
      error: result.error.message,
    });
  }
}

/**
 * Register the pending release handler on the pipeline event bus
 */
export function registerPendingReleaseHandler(prisma: PrismaClient): void {
  const service = new PendingReleaseService(prisma);

  pipelineEventBus.on(PIPELINE_EVENTS.RELEASE_REJECTED, (event) => {
    void handleRejectedRelease(service, event);
  });

  logger.debug(`${TAG} Pending release handler registered`);
}
