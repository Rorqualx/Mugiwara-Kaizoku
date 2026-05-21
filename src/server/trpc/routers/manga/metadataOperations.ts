/**
 * Metadata Operations Router - Main Aggregator
 *
 * Aggregates all metadata-related sub-routers into a unified router.
 * All procedures are exposed at the top level for backward compatibility.
 *
 * Architecture:
 * - metadataOperations/utils.ts - Shared utilities (0 procedures)
 * - metadataOperations/core.ts - Core operations (2 procedures)
 * - metadataOperations/provider-metadata.ts - Provider metadata (1 procedure)
 * - metadataOperations/refresh/index.ts - Refresh orchestrator (1 procedure)
 *
 * Total: 4 procedures across 3 routers
 *
 * Original: 1424 lines → Refactored: ~80 lines (94% reduction)
 */

import { router } from '@/server/trpc/trpc';

// Import all sub-routers
import { metadataCoreProcedures } from './metadataOperations/core';
import { metadataProviderProcedures } from './metadataOperations/provider-metadata';
import { metadataRefreshProcedures } from './metadataOperations/refresh';

/**
 * Main metadata router
 *
 * Procedures:
 *
 * Core Operations (2 procedures):
 * - updateMetadata: Update manga metadata fields
 * - updateProviderPreferences: Update provider preferences
 *
 * Provider Metadata (1 procedure):
 * - getProviderMetadata: Fetch metadata from specific provider
 *
 * Refresh Operations (1 procedure):
 * - refreshMetaData: Re-fetch metadata from all providers
 */
export const metadataRouter = router({
  ...metadataCoreProcedures._def.procedures,
  ...metadataProviderProcedures._def.procedures,
  ...metadataRefreshProcedures._def.procedures,
});
