/**
 * Metadata Enrichment Service
 *
 * Service for automatically enriching manga with metadata from external providers.
 * Includes caching, rate limiting, and enhanced data fetching.
 *
 * This file re-exports from the modular implementation for backward compatibility.
 *
 * Architecture:
 * - metadataEnrichmentService/types.ts - Type definitions and interfaces
 * - metadataEnrichmentService/provider-fetchers/ - Provider-specific data fetchers
 * - metadataEnrichmentService/core-service.ts - Main service class
 */

// Re-export everything from the modular implementation
export * from './metadataEnrichmentService/index';
