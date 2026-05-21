/**
 * Provider Registry Module
 *
 * Main registry class for managing metadata providers with plugin-like architecture.
 * Provides discovery, registration, health monitoring, and lifecycle management.
 *
 * Features:
 * - Dynamic provider registration and discovery
 * - Health monitoring and circuit breaking
 * - Provider capabilities and feature detection
 * - Load balancing and failover
 * - Middleware support for cross-cutting concerns
 * - Event-driven architecture for provider lifecycle
 *
 * Extracted from: provider-registry.ts (lines 364-635, 705-709)
 * ESLint Fix: Line 621 - no-await-in-loop (with justification comment)
 */

import { EventEmitter } from 'events';

import { type AsyncResult, createErrorResult, isError } from '@/utils/async-result';
import { logger } from '@/utils/logging';

import { LoadBalancer } from './load-balancer';
import { ProviderWrapper } from './provider-wrapper';
import { ProviderStatus } from './types';

import type {
  MetadataProviderInterface,
  ProviderConfig,
  ProviderHealth,
  ProviderCapabilities,
  ProviderMiddleware
} from './types';

/**
 * Provider Registry implementation
 *
 * Central registry for managing metadata providers with plugin-like architecture.
 * Handles registration, health monitoring, load balancing, and failover.
 */
export class ProviderRegistry extends EventEmitter {
  private providers: Map<string, ProviderWrapper> = new Map();
  private middleware: ProviderMiddleware[] = [];
  private defaultProvider?: string;
  private loadBalancer?: LoadBalancer;

  constructor() {
    super();
    logger.info('ProviderRegistry initialized');
  }

  /**
   * Register a new provider
   */
  async register(
    provider: MetadataProviderInterface,
    config: ProviderConfig
  ): Promise<void> {
    if (this.providers.has(config.id)) {
      throw new Error(`Provider ${config.id} already registered`);
    }

    const wrapper = new ProviderWrapper(provider, config);
    try {
      await wrapper.initialize();
      this.providers.set(config.id, wrapper);
      // Set as default if first provider or higher priority
      if (!this.defaultProvider || this.shouldBeDefault(config)) {
        this.defaultProvider = config.id;
      }

      this.emit('provider-registered', {
        id: config.id,
        name: config.name,
        capabilities: provider.capabilities
      });
      logger.info(`Provider ${config.name} registered successfully`, {
        id: config.id,
        version: provider.version,
        capabilities: provider.capabilities
      });
    } catch (error: unknown) {
      logger.error(`Failed to register provider ${config.name}:`, error);
      throw error;
    }
  }

  /**
   * Unregister a provider
   */
  async unregister(providerId: string): Promise<void> {
    const wrapper = this.providers.get(providerId);
    if (!wrapper) {
      throw new Error(`Provider ${providerId} not found`);
    }

    await wrapper.shutdown();
    this.providers.delete(providerId);
    // Update default provider if needed
    if (this.defaultProvider === providerId) {
      this.selectNewDefault();
    }

    this.emit('provider-unregistered', { id: providerId });
    logger.info(`Provider ${providerId} unregistered`);
  }

  /**
   * Get a provider by ID
   */
  getProvider(providerId: string): MetadataProviderInterface | null {
    const wrapper = this.providers.get(providerId);
    return wrapper?.getProvider() ?? null;
  }

  /**
   * Get all registered providers
   */
  getAllProviders(): Map<string, MetadataProviderInterface> {
    const result = new Map<string, MetadataProviderInterface>();
    for (const [id, wrapper] of this.providers) {
      result.set(id, wrapper.getProvider());
    }

    return result;
  }

  /**
   * Get providers by capability
   */
  getProvidersByCapability(
    capability: keyof ProviderCapabilities
  ): MetadataProviderInterface[] {
    const result: MetadataProviderInterface[] = [];
    for (const wrapper of this.providers.values()) {
      const provider = wrapper.getProvider();
      if (provider.capabilities[capability]) {
        result.push(provider);
      }
    }

    // Sort by priority
    result.sort((a, b) => {
      const configA = this.getProviderConfig(a.id);
      const configB = this.getProviderConfig(b.id);
      return (configB?.priority ?? 0) - (configA?.priority ?? 0);
    });
    return result;
  }

  /**
   * Execute operation on default provider
   */
  async execute<T>(
    operation: (provider: MetadataProviderInterface) => Promise<AsyncResult<T, Error>>,
    options?: {
      providerId?: string;
      fallback?: boolean;
      parallel?: boolean;
    }
  ): Promise<AsyncResult<T, Error>> {
    const providerId = options?.providerId ?? this.defaultProvider;
    if (!providerId) {
      return createErrorResult(
        new Error('No provider available')
      );
    }

    const wrapper = this.providers.get(providerId);
    if (!wrapper) {
      return createErrorResult(
        new Error(`Provider ${providerId} not found`)
      );
    }

    // Execute with wrapper (includes health checks, rate limiting, etc.)
    const result = await wrapper.execute(
      () => operation(wrapper.getProvider()),
      'operation'
    );
    // If failed and fallback enabled, try other providers
    if (options?.fallback && isError(result)) {
      return this.executeWithFallback(operation, providerId);
    }

    return result;
  }

  /**
   * Execute operation on all providers in parallel
   */
  async executeParallel<T>(
    operation: (provider: MetadataProviderInterface) => Promise<AsyncResult<T, Error>>
  ): Promise<Map<string, AsyncResult<T, Error>>> {
    const results = new Map<string, AsyncResult<T, Error>>();
    const promises: Promise<void>[] = [];
    for (const [id, wrapper] of this.providers) {
      if (wrapper.getHealth().status === ProviderStatus.READY) {
        promises.push(
          wrapper.execute(
            () => operation(wrapper.getProvider()),
            'parallel-operation'
          ).then(result => {
            results.set(id, result);
          })
        );
      }
    }

    await Promise.all(promises);
    return results;
  }

  /**
   * Get health status of all providers
   */
  getHealthStatus(): Map<string, ProviderHealth> {
    const status = new Map<string, ProviderHealth>();
    for (const [id, wrapper] of this.providers) {
      status.set(id, wrapper.getHealth());
    }

    return status;
  }

  /**
   * Add middleware
   */
  use(middleware: ProviderMiddleware): void {
    this.middleware.push(middleware);
  }

  /**
   * Enable load balancing
   */
  enableLoadBalancing(strategy: 'round-robin' | 'least-connections' | 'weighted' = 'round-robin'): void {
    this.loadBalancer = new LoadBalancer(strategy);
  }

  /**
   * Shutdown all providers
   */
  async shutdown(): Promise<void> {
    const promises: Promise<void>[] = [];
    for (const wrapper of this.providers.values()) {
      promises.push(wrapper.shutdown());
    }

    await Promise.all(promises);
    this.providers.clear();
    logger.info('ProviderRegistry shutdown complete');
  }

  // Private methods

  private shouldBeDefault(config: ProviderConfig): boolean {
    if (!this.defaultProvider) return true;
    const currentWrapper = this.providers.get(this.defaultProvider);
    if (!currentWrapper) return true;
    const currentConfig = currentWrapper.getConfig();
    return config.priority > currentConfig.priority;
  }

  private selectNewDefault(): void {
    let highest = -1;
    let newDefault: string | undefined;
    for (const [id, wrapper] of this.providers) {
      const config = wrapper.getConfig();
      if (config.enabled && config.priority > highest) {
        highest = config.priority;
        newDefault = id;
      }
    }

    if (newDefault !== undefined) {
      this.defaultProvider = newDefault;
    } else {
      delete (this as unknown as { defaultProvider?: string }).defaultProvider;
    }
  }

  private getProviderConfig(providerId: string): ProviderConfig | null {
    const wrapper = this.providers.get(providerId);
    return wrapper?.getConfig() ?? null;
  }

  private async executeWithFallback<T>(
    operation: (provider: MetadataProviderInterface) => Promise<AsyncResult<T, Error>>,
    skipProviderId: string
  ): Promise<AsyncResult<T, Error>> {
    // Get all healthy providers sorted by priority
    const providers = Array.from(this.providers.values())
      .filter(w =>
        w.getConfig().id !== skipProviderId &&
        w.getHealth().status === ProviderStatus.READY
      )
      .sort((a, b) => b.getConfig().priority - a.getConfig().priority);

    for (const wrapper of providers) {
      // eslint-disable-next-line no-await-in-loop -- Intentional sequential fallback: try providers in priority order, stop at first success
      const result = await wrapper.execute(
        () => operation(wrapper.getProvider()),
        'fallback-operation'
      );
      if (result.status === 'success') {
        logger.info(`Fallback successful with provider ${wrapper.getConfig().name}`);
        return result;
      }
    }

    return createErrorResult(
      new Error('All providers failed')
    );
  }
}

// Create a singleton registry instance
export const providerRegistry = new ProviderRegistry();
