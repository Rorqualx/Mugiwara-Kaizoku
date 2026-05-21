/**
 * Downloads Router - Main Aggregator
 *
 * This router aggregates all downloads-related sub-routers into a single
 * unified router. All procedures from the sub-routers are exposed at the
 * top level for backward compatibility.
 *
 * Architecture:
 * - downloads/utils.ts - Shared utilities, types, schemas (0 procedures)
 * - downloads/client-config.ts - Client configuration helpers (0 procedures)
 * - downloads/clients-router.ts - Client management (4 procedures)
 * - downloads/queue-router.ts - Queue operations & stats (8 procedures)
 *
 * Total: 12 procedures across 3 routers
 *
 * Original file: 590 lines -> Refactored: ~80 lines (86% reduction)
 */

import { router } from '@/server/trpc/trpc';

import { downloadsClientsRouter } from './downloads/clients-router';
import {
  downloadsQueueRouter,
  downloadsStatsRouter,
} from './downloads/queue-router';

/**
 * Main downloads router
 *
 * Merges all sub-routers to expose all procedures at the proper nesting level.
 * Maintains backward compatibility with existing API consumers.
 *
 * Procedures by Category:
 *
 * Client Management (4 procedures):
 * - clients.list: List available download clients
 * - clients.getConfig: Get current client configuration
 * - clients.updateConfig: Update client configuration
 * - clients.test: Test client connection
 *
 * Queue Operations (6 procedures):
 * - queue.add: Add download to queue
 * - queue.list: List downloads in queue
 * - queue.pause: Pause download
 * - queue.resume: Resume download
 * - queue.remove: Remove download
 * - queue.clearCompleted: Clear completed downloads
 *
 * Statistics (2 procedures):
 * - stats: Get download statistics
 * - history: Get download history
 */
export const downloadsRouter = router({
  // Client management procedures
  clients: downloadsClientsRouter,

  // Queue operations
  queue: downloadsQueueRouter,

  // Statistics and history (spread at top level for backward compatibility)
  ...downloadsStatsRouter._def.procedures,
});

/**
 * Type export for the downloads router
 */
export type DownloadsRouter = typeof downloadsRouter;
