/**
 * Pipeline Event Handlers - Registration Entry Point
 *
 * Registers all pipeline event handlers on the PipelineEventBus.
 * Called once at server startup via pipeline-setup.ts.
 *
 * Handler responsibilities:
 * - realtime-bridge: Forwards pipeline events to WebSocket clients
 * - pending-release: Stores temporarily rejected releases
 * - dismiss-pending: Auto-dismisses pending releases on success
 * - import-blocked: Notifies user when imports fail or are blocked
 *
 * @module server/services/pipeline/handlers
 */

import { pipelineEventBus } from '@/server/services/pipeline/pipeline-event-bus';
import { logger } from '@/utils/logger';


import { registerDismissPendingHandler } from './dismiss-pending-handler';
import { registerImportBlockedHandler } from './import-blocked-handler';
import { registerPendingReleaseHandler } from './pending-release-handler';
import { registerRealtimeBridgeHandler } from './realtime-bridge-handler';

import type { PrismaClient } from '@prisma/client';

const TAG = '[PipelineEventBus]';

/**
 * Register all pipeline event handlers.
 * Idempotent: if the bus is already initialized, registration is skipped.
 */
export function registerAllPipelineHandlers(prisma: PrismaClient): void {
  if (pipelineEventBus.isInitialized()) {
    logger.warn(`${TAG} Handlers already registered, skipping`);
    return;
  }

  registerRealtimeBridgeHandler();
  registerPendingReleaseHandler(prisma);
  registerDismissPendingHandler(prisma);
  registerImportBlockedHandler();

  pipelineEventBus.markInitialized();

  const stats = pipelineEventBus.getStats();
  logger.info(`${TAG} All handlers registered`, {
    totalHandlers: stats.totalHandlers,
    events: Object.keys(stats.handlersByEvent).length,
  });
}
