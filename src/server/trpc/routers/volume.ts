/**
 * Volume Router - Main Aggregator
 *
 * This router aggregates all volume-related sub-routers into a single
 * unified router. All procedures from the sub-routers are exposed at the
 * top level for backward compatibility.
 *
 * Architecture:
 * - volume/utils.ts - Shared utilities, types, Zod schemas (0 procedures)
 * - volume/crud.ts - CRUD operations (4 procedures)
 * - volume/queries.ts - Query operations (6 procedures)
 * - volume/progress.ts - Progress tracking (5 procedures)
 *
 * Total: 15 procedures across 3 routers
 *
 * @module server/trpc/routers/volume
 */

import { router } from '../trpc';

// Import all sub-routers
import { volumeCrudRouter } from './volume/crud';
import { volumeProgressRouter } from './volume/progress';
import { volumeQueriesRouter } from './volume/queries';

/**
 * Main volume router
 *
 * Merges all sub-routers to expose all procedures at the top level.
 *
 * Procedures by Category:
 *
 * CRUD Operations (4 procedures):
 * - create: Create a new volume
 * - update: Update volume metadata
 * - delete: Delete a volume
 * - upsertBatch: Batch upsert volumes from provider
 *
 * Query Operations (6 procedures):
 * - list: List volumes for a manga
 * - get: Get single volume by ID
 * - getWithChapters: Get volume with linked chapters
 * - getByIsbn: Find volume by ISBN
 * - search: Search volumes
 * - getCount: Get volume count for a manga
 *
 * Progress Tracking (5 procedures):
 * - updateProgress: Update volume reading progress
 * - getProgress: Get progress for a specific volume
 * - getMangaVolumeProgress: Get all volume progress for a manga
 * - syncFromChapters: Compute and sync progress from chapter progress
 * - markComplete: Mark volume as complete
 */
export const volumeRouter = router({
  // Merge all sub-routers using tRPC's procedure spreading
  ...volumeCrudRouter._def.procedures,
  ...volumeQueriesRouter._def.procedures,
  ...volumeProgressRouter._def.procedures,
});
