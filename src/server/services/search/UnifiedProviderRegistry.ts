/**
 * Unified Provider Registry
 *
 * This is the consolidated provider registry that replaces all previous registry systems.
 * It combines the best features from ProviderRegistry, searchProviderRegistry, and registerProviders
 * into a single, maintainable solution.
 *
 * Features:
 * - Singleton pattern with lazy initialization
 * - Optional ConfigService dependency (works without it)
 * - Built-in SearchResultValidator integration
 * - Provider state management
 * - Intelligent fallback mechanisms
 * - Simple API for wizard compatibility
 * - Full TypeScript type safety
 *
 * @module UnifiedProviderRegistry
 */



import { MetadataProvider } from '@prisma/client';

import type { SearchResponseWithErrors } from '@/types/search.types';
import { ValidationError } from '@/utils/errors';
import { logger } from '@/utils/logger';



import { anilistProvider } from './providers/AniListProvider';
import { comicvineProvider } from './providers/ComicVineProvider';
import { fandomProvider } from './providers/FandomProviderInstance';
import { mangadexProvider } from './providers/MangaDexProvider';
import { mangaupdatesProvider } from './providers/MangaUpdatesProvider';
import { wikipediaProvider } from './providers/WikipediaProvider';
import { getProvider, type ProviderLookupConfig } from './unified-registry/provider-lookup';
import {
  loadDefaultProvider,
  loadProviderStates,
  getProviderState
} from './unified-registry/provider-state-manager';
import {
  searchWithProvider,
  searchAllWithErrors,
  searchAll,
  getMetadata
} from './unified-registry/search-operations';

import type { SearchProvider, SearchResult, SearchOptions } from './types';
import type { ProviderState } from './unified-registry/registry-types';
import type { ConfigService } from '../config/configService';
import type { Logger } from 'pino';

/**
 * Unified Provider Registry Class
 *
 * This class manages all search providers in the application.
 * It provides a clean API for provider registration, search operations,
 * and configuration management.
 */
export class UnifiedProviderRegistry {
  private static instance: UnifiedProviderRegistry | null = null;
  private providers: Map<string, SearchProvider>;
  private providerStates: Map<string, ProviderState>;
  private defaultProvider: string;
  private configService?: ConfigService;
  private initialized: boolean;
  private initializationPromise?: Promise<void>;
  private readonly log = logger.child('UnifiedProviderRegistry');

  /**
   * Private constructor for singleton pattern
   */
  private constructor() {
    this.providers = new Map();
    this.providerStates = new Map();
    this.defaultProvider = MetadataProvider.ANILIST;
    this.initialized = false;

    // Register built-in providers immediately
    this.registerBuiltInProviders();
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): UnifiedProviderRegistry {
    UnifiedProviderRegistry.instance ??= new UnifiedProviderRegistry();
    return UnifiedProviderRegistry.instance;
  }

  /**
   * Register all built-in providers
   */
  private registerBuiltInProviders(): void {
    // Register all metadata providers with default states. Priority order is
    // manga-native first (anilist/mangadex/mangaupdates), then secondary
    // sources used for cover + romanization triangulation.
    this.registerProvider(anilistProvider as SearchProvider, { enabled: true, priority: 1 });
    this.registerProvider(mangadexProvider as SearchProvider, { enabled: true, priority: 2 });
    this.registerProvider(mangaupdatesProvider as SearchProvider, { enabled: true, priority: 3 });
    this.registerProvider(comicvineProvider as SearchProvider, { enabled: true, priority: 4 });
    this.registerProvider(fandomProvider as SearchProvider, { enabled: true, priority: 5 });
    this.registerProvider(wikipediaProvider as SearchProvider, { enabled: true, priority: 6 });

    this.log.info('Registered built-in providers', {
      count: this.providers.size,
      providers: Array.from(this.providers.keys())
    });
  }

  /**
   * Register a search provider
   */
  registerProvider(provider: SearchProvider, state?: Partial<ProviderState>): void {
    if (!provider["name"] || typeof provider.search !== 'function') {
      throw new ValidationError('Invalid provider: must have name and search function');
    }

    const providerWithType = provider as SearchProvider & { type?: string };
    const providerType = providerWithType.type ?? provider["name"];

    this.providers.set(providerType, provider);
    this.providerStates.set(providerType, {
      enabled: state?.enabled ?? true,
      priority: state?.priority ?? 99,
      ...(state?.lastError !== undefined ? { lastError: state.lastError } : {}),
      ...(state?.lastSuccess !== undefined ? { lastSuccess: state.lastSuccess } : {})
    });

    this.log.debug('Registered provider', {
      name: provider["name"],
      type: providerType,
      enabled: this.providerStates.get(providerType)?.enabled
    });
  }

  /**
   * Initialize with optional ConfigService
   */
  async initialize(configService?: ConfigService): Promise<void> {
    if (this.initializationPromise !== undefined) {
      return this.initializationPromise;
    }

    if (this.initialized) {
      return;
    }

    this.initializationPromise = this.doInitialize(configService);
    await this.initializationPromise;
    delete this.initializationPromise;
  }

  /**
   * Perform actual initialization
   */
  private async doInitialize(configService?: ConfigService): Promise<void> {
    try {
      if (configService !== undefined) {
        this.configService = configService;
      }

      if (configService !== undefined) {
        try {
          const defaultProvider = await loadDefaultProvider();
          if (defaultProvider !== null && this.providers.has(defaultProvider)) {
            this.defaultProvider = defaultProvider;
            this.log.info('Loaded default provider from config', { provider: defaultProvider });
          }

          await loadProviderStates(this.providerStates);
        } catch (error) {
          this.log.warn('Failed to load configuration, using defaults', { error });
        }
      }

      this.initialized = true;
      this.log.info('Registry initialized', {
        defaultProvider: this.defaultProvider,
        providers: this.getAvailableProviders(),
        hasConfig: configService !== undefined
      });
    } catch (error) {
      this.log.error('Failed to initialize registry', { error });
      this.initialized = true;
    }
  }

  /**
   * Get the state of a specific provider
   */
  getProviderState(type: string): ProviderState | undefined {
    return getProviderState(this.providerStates, type);
  }

  /**
   * Get a provider by type with fallback logic
   */
  async getProvider(type?: string): Promise<SearchProvider> {
    const config: ProviderLookupConfig = {
      providers: this.providers,
      providerStates: this.providerStates,
      defaultProvider: this.defaultProvider,
      log: this.log as unknown as Logger,
      ...(type !== undefined && { type }),
      initialized: this.initialized,
      ...(this.initializationPromise === undefined && { initialize: () => this.initialize() })
    };
    return getProvider(config);
  }

  /**
   * Search with a specific provider
   */
  async searchWithProvider(
    type: string,
    query: string,
    options?: SearchOptions
  ): Promise<SearchResult[]> {
    return searchWithProvider(
      await this.getProvider(type),
      this.providerStates,
      type,
      query,
      options
    );
  }

  /**
   * Search across all enabled providers with error tracking
   */
  async searchAllWithErrors(query: string, options?: SearchOptions): Promise<SearchResponseWithErrors> {
    return searchAllWithErrors(
      this.providers,
      this.providerStates,
      async (providerType: string) => this.searchWithProvider(providerType, query, options),
      query,
      options
    );
  }

  /**
   * Search across all enabled providers
   */
  async searchAll(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    return searchAll(
      this.providerStates,
      async (providerType: string) => this.searchWithProvider(providerType, query, options),
      query,
      options
    );
  }

  /**
   * Get metadata for a specific item
   */
  async getMetadata(type: string, id: string, title?: string): Promise<SearchResult> {
    const provider = await this.getProvider(type);
    return getMetadata(provider, type, id, title);
  }

  /**
   * Set the default provider
   */
  setDefaultProvider(type: string): Promise<void> {
    if (!this.providers.has(type)) {
      throw new ValidationError(`Provider '${type}' not found`);
    }

    this.defaultProvider = type;

    if (this.configService !== undefined) {
      try {
        this.log.info('Default provider updated', { provider: type });
      } catch (error) {
        this.log.error('Failed to persist default provider', { error });
      }
    }

    return Promise.resolve();
  }

  /**
   * Re-read per-provider enabled flags from the Config table. Settings UI
   * writes go through `trpc.settings.set`, which calls this so toggles take
   * effect without a process restart. Safe before initialization completes —
   * `loadProviderStates` only mutates entries that already exist in the map.
   */
  async reloadProviderStates(): Promise<void> {
    try {
      await loadProviderStates(this.providerStates);
      this.log.info('Reloaded provider states from Config table');
    } catch (error) {
      this.log.warn('Failed to reload provider states', { error });
    }
  }

  /**
   * Get all available provider types
   */
  getAvailableProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Get the current default provider
   */
  getDefaultProvider(): string {
    return this.defaultProvider;
  }

  /**
   * Check if a provider is enabled
   */
  isProviderEnabled(type: string): boolean {
    const state = this.providerStates.get(type);
    return state?.enabled ?? false;
  }

  /**
   * Enable or disable a provider
   */
  setProviderEnabled(type: string, enabled: boolean): void {
    const state = this.providerStates.get(type);
    if (state !== undefined) {
      state.enabled = enabled;
      this.log.info('Provider state updated', { provider: type, enabled });
    }
  }

  /**
   * Get a simple registry interface for backward compatibility
   */
  getSimpleRegistry(): {
    get: (name: string) => SearchProvider | undefined;
    getAll: () => Record<string, SearchProvider>;
    initialize: () => void;
    register: (provider: SearchProvider) => void;
  } {
    return {
      get: (name: string) => {
        try {
          const state = this.getProviderState(name);
          if (state !== undefined && !state.enabled) {
            this.log.debug(`Provider ${name} is disabled, not returning it`);
            return undefined;
          }

          const provider = this.providers.get(name);
          if (provider !== undefined) return provider;

          for (const [key, p] of this.providers) {
            if (key.toLowerCase() === name.toLowerCase()) {
              const keyState = this.providerStates.get(key);
              if (keyState?.enabled === true) {
                return p;
              }
            }
          }
          return undefined;
        } catch {
          return undefined;
        }
      },
      getAll: () => {
        const result: Record<string, SearchProvider> = {};
        for (const [key, provider] of this.providers) {
          const state = this.providerStates.get(key);
          if (state?.enabled === true) {
            result[key] = provider;
          }
        }
        return result;
      },
      initialize: () => {
        if (!this.initialized) {
          this.initialize().catch((error: unknown) => {
            this.log.error('Failed to initialize in compatibility mode', { error });
          });
        }
      },
      register: (provider: SearchProvider) => {
        this.registerProvider(provider);
      }
    };
  }

  /**
   * Reset the registry (mainly for testing)
   */
  reset(): void {
    this.providers.clear();
    this.providerStates.clear();
    this.defaultProvider = MetadataProvider.ANILIST;
    this.initialized = false;
    delete this.configService;
    this.registerBuiltInProviders();
  }
}

// Export singleton instance
export const unifiedProviderRegistry = UnifiedProviderRegistry.getInstance();

// Export simple registry interface for backward compatibility
export const searchProviderRegistry = unifiedProviderRegistry.getSimpleRegistry();
