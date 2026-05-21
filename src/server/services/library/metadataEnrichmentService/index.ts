/**
 * Metadata Enrichment Service
 *
 * Service for automatically enriching manga with metadata from external providers.
 * Includes caching, rate limiting, and enhanced data fetching.
 *
 * Architecture:
 * - types.ts - Type definitions and interfaces

 * - provider-fetchers/ - Provider-specific data fetchers
 * - core-service.ts - Main service class
 *
 * Original: metadataEnrichmentService.ts (1001 lines)
 * Refactored: 8 modules
 */

// Re-export types
export type {
  EnrichmentOptions,
  ProviderMatch,
  EnrichmentResult,
  EnhancedEnrichmentResult,
  ProviderMutations,
  Mutation
} from './types';
export { isMutation } from './types';


// Re-export service class and singleton from core-service
export {
  MetadataEnrichmentService,
  metadataEnrichmentService,
  createMetadataEnrichmentService
} from './core-service';

// Re-export EnrichmentLevel for convenience
export { EnrichmentLevel } from '@/utils/metadata-cache';
