/**
 * Provider Registry Core
 *
 * Core registry management for metadata providers.
 * Handles singleton instance, initialization, and provider registration/management.
 *
 * Extracted from: registry.ts (lines 59-240)
 */

import { logger } from '@/utils/logger';

import {
  loadFandomStrategy,
  loadWikipediaStrategy,
  loadAniListStrategy,
  loadComicVineStrategy,
  loadMangaDexStrategy,
  loadMangaUpdatesStrategy
} from './loaders';

import type { ProviderConfig, ProviderStrategy, ProviderRegistryOptions } from './types';
import type { MetadataProvider } from '@prisma/client';


// ============================================================================
// Provider Registry Core Class
// ============================================================================

/**
 * Provider Registry
 *
 * Singleton registry for managing metadata provider strategies.
 * Handles provider lifecycle, configuration, and queries.
 */
export class ProviderRegistry {
  private static instance: ProviderRegistry | undefined;
  protected providers: Map<MetadataProvider, ProviderStrategy> = new Map();
  protected configs: Map<MetadataProvider, ProviderConfig> = new Map();
  protected options: ProviderRegistryOptions;
  private initializePromise?: Promise<void>;

  protected constructor(options: ProviderRegistryOptions = {}) {
    this.options = {
      enableFallback: true,
      maxRetries: 3,
      cacheResults: true,
      performanceTracking: false,
      ...options
    };
  }

  /**
   * Get singleton instance
   */
  public static getInstance(options?: ProviderRegistryOptions): ProviderRegistry {
    if (!ProviderRegistry.instance) {
      ProviderRegistry.instance = new ProviderRegistry(options);
      // Auto-initialize the registry when first accessed
      ProviderRegistry.instance.initialize().catch(error => {
        logger.error('Failed to auto-initialize provider registry:', error);
      });
    }
    return ProviderRegistry.instance;
  }

  /**
   * Initialize all providers
   */
  public async initialize(): Promise<void> {
    if (this.initializePromise) {
      return this.initializePromise;
    }

    this.initializePromise = this.doInitialize();
    return this.initializePromise;
  }

  private async doInitialize(): Promise<void> {
    logger.info('Initializing provider registry');

    try {
      // Dynamically import and register providers
      await this.registerDefaultProviders();

      logger.info(`Provider registry initialized with ${this.providers.size} providers`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to initialize provider registry:', errorMessage);
      throw new Error(errorMessage);
    }
  }

  /**
   * Register default providers
   */
  private async registerDefaultProviders(): Promise<void> {
    // Import provider strategies using loader functions
    const strategies = await Promise.all([
      loadFandomStrategy(),
      loadWikipediaStrategy(),
      loadAniListStrategy(),
      loadComicVineStrategy(),
      loadMangaDexStrategy(),
      loadMangaUpdatesStrategy()
    ]);

    // Register each successfully loaded strategy
    strategies.forEach(strategy => {
      if (strategy) {
        this.registerProvider(strategy);
      }
    });
  }

  /**
   * Register a provider strategy
   */
  public registerProvider(strategy: ProviderStrategy): void {
    this.providers.set(strategy.type, strategy);
    this.configs.set(strategy.type, strategy.getConfig());

    logger.info(`Registered provider: ${strategy.name} (${strategy.type})`);
  }

  /**
   * Unregister a provider
   */
  public unregisterProvider(type: MetadataProvider): void {
    this.providers.delete(type);
    this.configs.delete(type);

    logger.info(`Unregistered provider: ${type}`);
  }

  /**
   * Get a provider by type
   */
  public getProvider(type: MetadataProvider): ProviderStrategy | undefined {
    return this.providers.get(type);
  }

  /**
   * Get all registered providers
   */
  public getAllProviders(): ProviderStrategy[] {
    return Array.from(this.providers.values());
  }

  /**
   * Get enabled providers sorted by priority
   */
  public async getEnabledProviders(): Promise<ProviderStrategy[]> {
    const providers = await Promise.all(
      this.getAllProviders().map(async provider => {
        const enabled = await provider.isEnabled();
        return enabled ? provider : null;
      })
    );

    return providers
      .filter((p): p is ProviderStrategy => p !== null)
      .sort((a, b) => {
        const configA = this.configs.get(a.type);
        const configB = this.configs.get(b.type);
        return (configA?.priority ?? 999) - (configB?.priority ?? 999);
      });
  }
}
