/**
 * Pipeline Event Bus Startup
 *
 * Initializes the pipeline event bus and registers all handlers
 * during server startup. Called from src/server/index.ts.
 *
 * @module server/startup/pipeline-setup
 */

import { prisma } from '@/server/db';
import { registerAllPipelineHandlers } from '@/server/services/pipeline/handlers';
import { logger } from '@/utils/logger';

/**
 * Initialize the pipeline event bus and register all handlers
 */
export function initializePipelineEventBus(): void {
  registerAllPipelineHandlers(prisma);
  logger.info('[Startup] Pipeline event bus initialized');
}
