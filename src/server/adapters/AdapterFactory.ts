/**
 * Adapter Factory
 * 
 * Factory pattern implementation for creating and managing adapters.
 * Provides centralized adapter creation with configuration validation,
 * singleton management, and dependency injection.
 */


import { MetadataProvider } from '@prisma/client';

import type { IntegrationAdapter } from '@/utils/integration-adapter';
import { logger } from '@/utils/logger';


import { WebsiteProviderAdapter } from './metadata/websiteProviderAdapter';
import { WikipediaAdapter } from './metadata/wikipediaAdapter';
import { SuwayomiSourceAdapter } from './suwayomi/SuwayomiSourceAdapter';
import { UnifiedAniListAdapter } from './unified-anilist-adapter';
import { UnifiedComicVineAdapter } from './unified-comicvine-adapter';

import type { UnifiedBaseAdapter, UnifiedAdapterConfig } from './UnifiedBaseAdapter';

/**
 * Adapter types that can be created
 */
export type AdapterType =
  | 'anilist'
  | 'comicvine'
  | 'wikipedia'
  | 'fandom'
  | 'suwayomi'
  | 'native_download'
  | 'website'
  | string; // Allow custom adapter types

/**
 * Adapter constructor type
 */
type AdapterConstructor<T extends UnifiedAdapterConfig = UnifiedAdapterConfig> = 
  new (config: T) => UnifiedBaseAdapter<unknown, T> | IntegrationAdapter<T>;

/**
 * Registry entry for adapter types
 */
interface AdapterRegistryEntry {
  constructor: AdapterConstructor;
  defaultConfig: UnifiedAdapterConfig;
  singleton?: boolean;
  instance?: UnifiedBaseAdapter | IntegrationAdapter | undefined;
}

/**
 * Factory options for adapter creation
 */
export interface AdapterFactoryOptions {
  /** Use singleton pattern for this adapter */
  singleton?: boolean;
  /** Override default configuration */
  config?: Partial<UnifiedAdapterConfig>;
  /** Force new instance even if singleton exists */
  forceNew?: boolean;
}

/**
 * Adapter Factory Class
 * 
 * Manages creation and lifecycle of all adapters in the system
 */
export class AdapterFactory {
  private static instance?: AdapterFactory;
  private registry: Map<AdapterType, AdapterRegistryEntry> = new Map();
  private logger = logger;
  
  /**
   * Private constructor for singleton pattern
   */
  private constructor() {
    this.registerDefaultAdapters();
  }
  
  /**
   * Get factory singleton instance
   */
  public static getInstance(): AdapterFactory {
    AdapterFactory.instance ??= new AdapterFactory();
    return AdapterFactory.instance;
  }
  
  /**
   * Register default adapters
   */
  private registerDefaultAdapters(): void {
    // Register AniList adapter
    this.registerAdapter('anilist', UnifiedAniListAdapter as unknown as AdapterConstructor, {
      enabled: true,
      priority: 1,
      apiUrl: 'https://graphql.anilist.co',
      timeout: 30000,
      cacheEnabled: true,
      cacheTTL: 300000, // 5 minutes
      supportsBatchOperations: true,
      supportsMetadataUpdate: true
    });

    // Register ComicVine adapter
    this.registerAdapter('comicvine', UnifiedComicVineAdapter as unknown as AdapterConstructor, {
      enabled: false, // Disabled by default (requires API key)
      priority: 2,
      apiUrl: 'https://comicvine.gamespot.com/api',
      timeout: 30000,
      rateLimit: 200, // 200 requests per hour
      cacheEnabled: true,
      cacheTTL: 600000, // 10 minutes
      supportsMetadataUpdate: true
    });

    // Register Wikipedia adapter
    this.registerAdapter('wikipedia', WikipediaAdapter as unknown as AdapterConstructor, {
      enabled: true,
      priority: 4,
      apiUrl: 'https://en.wikipedia.org/api',
      timeout: 30000,
      cacheEnabled: true,
      cacheTTL: 3600000, // 1 hour
      supportsMetadataUpdate: false
    });

    // Register Suwayomi Source adapter (GraphQL-based)
    this.registerAdapter('suwayomi-v2', SuwayomiSourceAdapter as unknown as AdapterConstructor, {
      enabled: false, // Disabled by default (requires server)
      priority: 3,
      host: 'localhost',
      port: 4567,
      useGraphQL: true,
      timeout: 30000,
      supportsChapterFetch: true,
      supportsBatchOperations: true
    });

    // Register Native Download/Website adapter
    this.registerAdapter('website', WebsiteProviderAdapter as unknown as AdapterConstructor, {
      enabled: true,
      priority: 5,
      timeout: 30000,
      cacheEnabled: true,
      supportsMetadataUpdate: false
    });

    this.logger.info(`[AdapterFactory] Registered ${this.registry.size} default adapters`);
  }
  
  /**
   * Register a new adapter type
   */
  public registerAdapter(
    type: AdapterType,
    constructor: AdapterConstructor,
    defaultConfig: UnifiedAdapterConfig,
    singleton: boolean = true
  ): void {
    if (this.registry.has(type)) {
      this.logger.warn(`[AdapterFactory] Overwriting existing adapter type: ${type}`);
    }
    
    this.registry.set(type, {
      constructor,
      defaultConfig,
      singleton
    });
    
    this.logger.info(`[AdapterFactory] Registered adapter: ${type}`);
  }
  
  /**
   * Create or get an adapter instance
   */
  public createAdapter<T extends UnifiedAdapterConfig = UnifiedAdapterConfig>(
    type: AdapterType,
    options: AdapterFactoryOptions = {}
  ): UnifiedBaseAdapter<unknown, T> | IntegrationAdapter<T> | null {
    const entry = this.registry.get(type);
    
    if (!entry) {
      this.logger.error(`[AdapterFactory] Unknown adapter type: ${type}`);
      return null;
    }
    
    // Check for existing singleton
    if (entry.singleton && entry.instance && !options.forceNew) {
      this.logger.debug(`[AdapterFactory] Returning singleton instance for: ${type}`);

      // Update configuration if provided
      if (options.config) {
        const instance = entry.instance as UnifiedBaseAdapter | IntegrationAdapter;
        if ('configure' in instance && typeof instance.configure === 'function') {
          instance.configure(options.config);
        }
      }

      return entry.instance as UnifiedBaseAdapter<unknown, T> | IntegrationAdapter<T>;
    }
    
    // Create new instance
    try {
      const config: T = {
        ...entry.defaultConfig,
        ...options.config
      } as T;
      
      const instance = new entry.constructor(config);
      
      // Store singleton if applicable
      if (entry.singleton && !options.forceNew) {
        entry.instance = instance as UnifiedBaseAdapter | IntegrationAdapter;
      }

      this.logger.info(`[AdapterFactory] Created new ${type} adapter instance`);
      return instance as UnifiedBaseAdapter<unknown, T> | IntegrationAdapter<T>;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`[AdapterFactory] Failed to create ${type} adapter:`, errorMessage);
      return null;
    }
  }
  
  /**
   * Create adapter by provider enum
   */
  public createByProvider(
    provider: MetadataProvider,
    options: AdapterFactoryOptions = {}
  ): UnifiedBaseAdapter | IntegrationAdapter | null {
    const typeMap: Partial<Record<MetadataProvider, AdapterType>> = {
      [MetadataProvider.ANILIST]: 'anilist',
      [MetadataProvider.COMICVINE]: 'comicvine',
      [MetadataProvider.WIKIPEDIA]: 'wikipedia',
      [MetadataProvider.FANDOM]: 'fandom',
      [MetadataProvider.PROWLARR]: 'prowlarr',
      [MetadataProvider.NATIVE_DOWNLOAD]: 'native_download',
      [MetadataProvider.SUWAYOMI]: 'suwayomi-v2'
    };
    
    const type = typeMap[provider];
    if (!type) {
      this.logger.error(`[AdapterFactory] No adapter mapping for provider: ${provider}`);
      return null;
    }
    
    return this.createAdapter(type, options);
  }
  
  /**
   * Get all registered adapter types
   */
  public getRegisteredTypes(): AdapterType[] {
    return Array.from(this.registry.keys());
  }
  
  /**
   * Check if an adapter type is registered
   */
  public hasAdapter(type: AdapterType): boolean {
    return this.registry.has(type);
  }
  
  /**
   * Get configuration for an adapter type
   */
  public getAdapterConfig(type: AdapterType): UnifiedAdapterConfig | null {
    const entry = this.registry.get(type);
    return entry ? { ...entry.defaultConfig } : null;
  }
  
  /**
   * Update default configuration for an adapter type
   */
  public updateDefaultConfig(
    type: AdapterType,
    config: Partial<UnifiedAdapterConfig>
  ): boolean {
    const entry = this.registry.get(type);
    
    if (!entry) {
      this.logger.error(`[AdapterFactory] Cannot update config for unknown type: ${type}`);
      return false;
    }
    
    entry.defaultConfig = {
      ...entry.defaultConfig,
      ...config
    };

    // Update singleton instance if it exists
    if (entry.instance) {
      const instance = entry.instance as UnifiedBaseAdapter | IntegrationAdapter;
      if ('configure' in instance && typeof instance.configure === 'function') {
        instance.configure(config);
      }
    }
    
    this.logger.info(`[AdapterFactory] Updated default config for: ${type}`);
    return true;
  }
  
  /**
   * Dispose of all singleton instances
   */
  public disposeAll(): void {
    let disposed = 0;
    
    this.registry.forEach((entry, type) => {
      if (entry.instance) {
        try {
          const instance = entry.instance as UnifiedBaseAdapter | IntegrationAdapter;
          if ('dispose' in instance && typeof instance.dispose === 'function') {
            instance.dispose();
          }
          // Clear the singleton instance reference
          // eslint-disable-next-line no-param-reassign -- Intentional: clearing instance in disposeAll()
          entry.instance = undefined;
          disposed++;
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          this.logger.error(`[AdapterFactory] Error disposing ${type} adapter:`, errorMessage);
        }
      }
    });
    
    this.logger.info(`[AdapterFactory] Disposed ${disposed} adapter instances`);
  }
  
  /**
   * Create multiple adapters at once
   */
  public createMultiple(
    configs: Array<{ type: AdapterType; options?: AdapterFactoryOptions }>
  ): Map<AdapterType, UnifiedBaseAdapter | IntegrationAdapter | null> {
    const adapters = new Map<AdapterType, UnifiedBaseAdapter | IntegrationAdapter | null>();
    
    for (const { type, options } of configs) {
      adapters.set(type, this.createAdapter(type, options));
    }
    
    return adapters;
  }
  
  /**
   * Get all enabled adapters
   */
  public getEnabledAdapters(): Array<{
    type: AdapterType;
    adapter: UnifiedBaseAdapter | IntegrationAdapter;
  }> {
    const enabled: Array<{
      type: AdapterType;
      adapter: UnifiedBaseAdapter | IntegrationAdapter;
    }> = [];
    
    this.registry.forEach((entry, type) => {
      if (entry.defaultConfig.enabled) {
        const adapter = this.createAdapter(type);
        if (adapter?.isEnabled()) {
          enabled.push({ type, adapter });
        }
      }
    });
    
    return enabled;
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Get the global adapter factory instance
 */
export function getAdapterFactory(): AdapterFactory {
  return AdapterFactory.getInstance();
}

/**
 * Quick adapter creation helper
 */
export function createAdapter<T extends UnifiedAdapterConfig = UnifiedAdapterConfig>(
  type: AdapterType,
  config?: Partial<T>
): UnifiedBaseAdapter<unknown, T> | IntegrationAdapter<T> | null {
  const options: AdapterFactoryOptions = {};
  if (config !== undefined) {
    options.config = config;
  }
  return getAdapterFactory().createAdapter<T>(type, options);
}

/**
 * Quick adapter creation by provider
 */
export function createAdapterByProvider(
  provider: MetadataProvider,
  config?: Partial<UnifiedAdapterConfig>
): UnifiedBaseAdapter | IntegrationAdapter | null {
  const options: AdapterFactoryOptions = {};
  if (config !== undefined) {
    options.config = config;
  }
  return getAdapterFactory().createByProvider(provider, options);
}

// ============================================================================
// Exports
// ============================================================================

export default AdapterFactory;