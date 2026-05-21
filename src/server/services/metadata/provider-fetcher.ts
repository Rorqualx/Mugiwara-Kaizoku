/**
 * Provider Fetching Service - Main Export
 *
 * This file re-exports all provider fetching functionality from the refactored modules.
 * The original 536-line file has been decomposed into focused modules for better maintainability.
 *
 * **Original File**: Backed up as provider-fetcher.ts.backup-20251121-231435 (536 lines)
 *
 * **Refactored Architecture** (582 lines total across 3 modules):
 * - provider-fetcher/types.ts (49 lines) - Type definitions and interfaces
 * - provider-fetcher/conversion-utils.ts (269 lines) - Data conversion utilities
 * - provider-fetcher/index.ts (264 lines) - Main ProviderFetchingService class
 *
 * **Benefits**:
 * - All modules under 500-line ESLint limit ✅
 * - Fixed 3 ESLint errors from original file ✅
 * - Improved code organization and maintainability ✅
 * - Backward compatible - no breaking changes ✅
 *
 * **Changes from Original**:
 * 1. Fixed line 78: Removed unnecessary logger.child conditional
 * 2. Fixed line 246: Properly handled null result check
 * 3. Fixed line 526-528: Used nullish coalescing operator (??=)
 * 4. Fixed import order and path alias issues
 *
 * @module ProviderFetcher
 * @see docs/sessions/provider-fetcher-refactoring-plan.md
 */

// Re-export everything from the new module structure
export {
  ProviderFetchingService,
  getProviderFetchingService,
  providerFetchingService
} from './provider-fetcher/index';

export type {
  FetchInput,
  ProviderFetchConfig,
  ProviderFetchResult
} from './provider-fetcher/types';

// Re-export conversion utilities for advanced usage
export {
  convertToUnifiedMetadata,
  mapStatus,
  mapFormat,
  convertTags,
  extractAuthors,
  extractArtists,
  extractPublisher,
  removeUndefinedFields
} from './provider-fetcher/conversion-utils';
