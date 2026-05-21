/**
 * Provider Operations Router - Main Aggregator
 *
 * This router aggregates all provider operation sub-routers into a single
 * unified router. All procedures from the sub-routers are exposed at the
 * top level for backward compatibility.
 *
 * Architecture:
 * - provider-operations/utils.ts - Shared utilities, types, schemas (0 procedures)
 * - provider-operations/search-across.ts - Basic provider search (1 procedure)
 * - provider-operations/confirmation-search.ts - Enhanced search with enrichment (1 procedure)
 * - provider-operations/binding.ts - Provider binding operations (2 procedures)
 * - provider-operations/merge.ts - Metadata merge operations (2 procedures)
 * - provider-operations/metadata.ts - Provider metadata fetch (1 procedure)
 *
 * Total: 7 procedures across 5 routers
 *
 * Original file: 847 lines -> Refactored: ~80 lines (91% reduction)
 */

import { router } from '@/server/trpc/trpc';

// Import all sub-routers
import { bindingRouter } from './provider-operations/binding';
import { providerConfirmationSearchRouter } from './provider-operations/confirmation-search';
import { providerMergeRouter } from './provider-operations/merge';
import { providerMetadataRouter } from './provider-operations/metadata';
import { searchAcrossRouter } from './provider-operations/search-across';

/**
 * Main provider operations router
 *
 * Merges all sub-routers to expose all 7 procedures at the top level.
 * Maintains backward compatibility with existing API consumers.
 *
 * Procedures:
 *
 * Search Operations:
 * - searchAcrossProviders: Basic multi-provider search
 * - searchProviderConfirmation: Enhanced search with metadata enrichment
 *
 * Binding Operations:
 * - bindProvider: Bind manga to generic provider
 * - bind: Legacy AniList binding
 *
 * Merge Operations:
 * - updateProviderPreferences: Update provider preferences
 * - mergeMetadataFromProviders: Merge selected fields from providers
 *
 * Metadata Operations:
 * - getProviderMetadata: Get cached or fetch fresh metadata
 */
export const providerRouter = router({
  // Merge all sub-routers using tRPC's procedure spreading
  ...searchAcrossRouter._def.procedures,
  ...providerConfirmationSearchRouter._def.procedures,
  ...bindingRouter._def.procedures,
  ...providerMergeRouter._def.procedures,
  ...providerMetadataRouter._def.procedures,
});
