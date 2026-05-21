/**
 * Provider Registry - Main Aggregator
 *
 * Central registry for all metadata providers. Manages provider instances,
 * configurations, and provides a unified interface for provider operations.
 *
 * Architecture:
 * - registry/types.ts - Type definitions (3 interfaces)
 * - registry/loaders.ts - Provider loading (4 functions)
 * - registry/core.ts - Core management (base class, 10 methods)
 * - registry/search.ts - Search operations (2 functions)
 * - registry/metadata.ts - Metadata operations (1 function, ESLint fixed)
 * - registry/utils.ts - Config/metrics (3 functions)
 *
 * Total: 6 focused modules
 * Original: 426 lines → Refactored: ~200 lines aggregator (52% reduction in main file)
 */

import type { SearchResult, MangaMetadata } from '@/types/search.types';
import type { AsyncResult } from '@/utils/async-result';


import { ProviderRegistry as ProviderRegistryCore } from './registry/core';
import { getMetadataWithFallback as getMetadataWithFallbackImpl } from './registry/metadata';
import { searchAll as searchAllImpl, searchWithProvider as searchWithProviderImpl } from './registry/search';
import { updateProviderConfig as updateProviderConfigImpl, getMetrics as getMetricsImpl, clearRegistry as clearRegistryImpl } from './registry/utils';

import type { ProviderConfig, ProviderStrategy } from './registry/types';
import type { MetadataProvider } from '@prisma/client';

// ============================================================================
// Type Definitions (Re-exported)
// ============================================================================

export type {
  ProviderConfig,
  ProviderStrategy,
  ProviderRegistryOptions
} from './registry/types';

// ============================================================================
// Singleton Instance
// ============================================================================

/**
 * Singleton instance of the core provider registry
 */
const coreRegistry = ProviderRegistryCore.getInstance();

// ============================================================================
// Main Provider Registry Class
// ============================================================================

/**
 * Main provider registry class
 *
 * Wraps the core registry with search and metadata operations.
 * Maintains backward compatibility with existing API consumers.
 */
export class ProviderRegistry {
  private static instance: ProviderRegistry | undefined;

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): ProviderRegistry {
    ProviderRegistry.instance ??= new ProviderRegistry();
    return ProviderRegistry.instance;
  }

  // ============================================================================
  // Core Registry Methods (Delegated)
  // ============================================================================

  /**
   * Initialize all providers
   */
  public async initialize(): Promise<void> {
    return coreRegistry.initialize();
  }

  /**
   * Register a provider strategy
   */
  public registerProvider(strategy: ProviderStrategy): void {
    return coreRegistry.registerProvider(strategy);
  }

  /**
   * Unregister a provider
   */
  public unregisterProvider(type: MetadataProvider): void {
    return coreRegistry.unregisterProvider(type);
  }

  /**
   * Get a provider by type
   */
  public getProvider(type: MetadataProvider): ProviderStrategy | undefined {
    return coreRegistry.getProvider(type);
  }

  /**
   * Get all registered providers
   */
  public getAllProviders(): ProviderStrategy[] {
    return coreRegistry.getAllProviders();
  }

  /**
   * Get enabled providers sorted by priority
   */
  public async getEnabledProviders(): Promise<ProviderStrategy[]> {
    return coreRegistry.getEnabledProviders();
  }

  // ============================================================================
  // Search Operations
  // ============================================================================

  /**
   * Search across all enabled providers
   */
  public async searchAll(
    query: string,
    options?: unknown
  ): Promise<AsyncResult<SearchResult[], Error>> {
    return searchAllImpl(
      () => coreRegistry.getEnabledProviders(),
      coreRegistry['options'].performanceTracking ?? false,
      query,
      options
    );
  }

  /**
   * Search with a specific provider
   */
  public async searchWithProvider(
    type: MetadataProvider,
    query: string,
    options?: unknown
  ): Promise<AsyncResult<SearchResult[], Error>> {
    return searchWithProviderImpl(
      () => coreRegistry.initialize(),
      (t) => coreRegistry.getProvider(t),
      type,
      query,
      options
    );
  }

  // ============================================================================
  // Metadata Operations
  // ============================================================================

  /**
   * Get metadata with fallback provider support
   */
  public async getMetadataWithFallback(
    type: MetadataProvider,
    id: string,
    options?: unknown
  ): Promise<AsyncResult<MangaMetadata, Error>> {
    return getMetadataWithFallbackImpl({
      initialize: () => coreRegistry.initialize(),
      getProvider: (t) => coreRegistry.getProvider(t),
      getConfig: (t) => coreRegistry['configs'].get(t),
      enableFallback: coreRegistry['options'].enableFallback ?? true,
      type,
      id,
      options,
    });
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Update provider configuration
   */
  public updateProviderConfig(
    type: MetadataProvider,
    config: Partial<ProviderConfig>
  ): void {
    const provider = coreRegistry.getProvider(type);
    if (provider) {
      updateProviderConfigImpl(provider, coreRegistry['configs'], config);
    }
  }

  /**
   * Get provider metrics
   */
  public getMetrics(): Record<string, unknown> {
    return getMetricsImpl(coreRegistry['providers'], coreRegistry['configs']);
  }

  /**
   * Clear all providers
   */
  public clear(): void {
    clearRegistryImpl(coreRegistry['providers'], coreRegistry['configs']);
  }
}

// ============================================================================
// Singleton Instance & Exports
// ============================================================================

/**
 * Singleton instance of the provider registry
 */
export const providerRegistry = ProviderRegistry.getInstance();

// ============================================================================
// Convenience Functions (Backward Compatibility)
// ============================================================================

/**
 * Search across all enabled providers
 */
export async function searchAll(
  query: string,
  options?: unknown
): Promise<AsyncResult<SearchResult[], Error>> {
  return providerRegistry.searchAll(query, options);
}

/**
 * Search with a specific provider
 */
export async function searchWithProvider(
  type: MetadataProvider,
  query: string,
  options?: unknown
): Promise<AsyncResult<SearchResult[], Error>> {
  return providerRegistry.searchWithProvider(type, query, options);
}

/**
 * Get metadata with fallback provider support
 */
export async function getMetadataWithFallback(
  type: MetadataProvider,
  id: string,
  options?: unknown
): Promise<AsyncResult<MangaMetadata, Error>> {
  return providerRegistry.getMetadataWithFallback(type, id, options);
}

/**
 * Register a new provider strategy
 */
export function registerProvider(strategy: ProviderStrategy): void {
  return providerRegistry.registerProvider(strategy);
}

/**
 * Get a registered provider by type
 */
export function getProvider(type: MetadataProvider): ProviderStrategy | undefined {
  return providerRegistry.getProvider(type);
}

/**
 * Get all enabled providers sorted by priority
 */
export async function getEnabledProviders(): Promise<ProviderStrategy[]> {
  return providerRegistry.getEnabledProviders();
}

// ============================================================================
// Default Export
// ============================================================================

export default providerRegistry;
