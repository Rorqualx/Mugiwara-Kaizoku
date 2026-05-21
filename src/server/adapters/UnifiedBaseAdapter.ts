/**
 * Unified Base Adapter
 * 
 * Consolidates BaseMetadataAdapter and BaseIntegrationAdapter functionality
 * to provide a single, comprehensive base class for all adapters.
 * 
 * Features:
 * - Unified interface for all adapter types
 * - Common functionality extraction
 * - Built-in validation and error handling
 * - AsyncResult pattern throughout
 * - Caching support
 * - Rate limiting support
 * - Retry logic
 * - Confidence scoring
 */

import type { MetadataSourceInfo } from '@/types/adapters/native-download-types';
import type {
  MangaSearchResult,
  SearchOptions,
  PartialUnifiedMetadata
} from '@/types/search.types';
import type { AsyncResult} from '@/utils/async-result';
import { createSuccessResult, createErrorResult} from '@/utils/async-result';
import { logger } from '@/utils/logger';

import { configService } from '../services/config/configService';

/**
 * Unified adapter configuration
 */
export interface UnifiedAdapterConfig {
  // Basic configuration
  enabled: boolean;
  priority?: number;
  
  // API configuration
  apiUrl?: string;
  apiEndpoint?: string;
  apiKey?: string;
  
  // Performance configuration
  timeout?: number;
  rateLimit?: number;
  retryAttempts?: number;
  cacheEnabled?: boolean;
  cacheTTL?: number;
  
  // Feature flags
  supportsBatchOperations?: boolean;
  supportsMetadataUpdate?: boolean;
  supportsChapterFetch?: boolean;
  
  // Custom configuration
  [key: string]: unknown;
}

/**
 * Adapter capabilities interface
 */
export interface AdapterCapabilities {
  search: boolean;
  metadata: boolean;
  chapters: boolean;
  batchOperations: boolean;
  caching: boolean;
  rateLimit: boolean;
}

/**
 * Unified base adapter class
 * 
 * @template TRawData - Type of raw data from the provider
 * @template TConfig - Type of adapter configuration
 */
export abstract class UnifiedBaseAdapter<
  TRawData = unknown,
  TConfig extends UnifiedAdapterConfig = UnifiedAdapterConfig
> {
  // ============================================================================
  // Abstract Properties - Must be implemented by subclasses
  // ============================================================================
  
  /**
   * Unique adapter name
   */
  abstract readonly adapterName: string;
  
  /**
   * Adapter type (metadata, integration, hybrid)
   */
  abstract readonly adapterType: 'metadata' | 'integration' | 'hybrid';
  
  /**
   * Provider/source name
   */
  abstract readonly providerName: string;
  
  /**
   * Base confidence score for this adapter (0-1)
   */
  abstract readonly baseConfidence: number;
  
  /**
   * Adapter capabilities
   */
  abstract readonly capabilities: AdapterCapabilities;
  
  // ============================================================================
  // Protected Properties
  // ============================================================================
  
  /**
   * Adapter configuration
   */
  protected config: TConfig;
  
  /**
   * Logger instance
   */
  protected logger: typeof logger;
  
  /**
   * Request cache
   */
  protected cache: Map<string, { data: unknown; timestamp: number }> = new Map();
  
  /**
   * Rate limit tracking
   */
  protected rateLimitTracker: {
    requests: number;
    resetTime: number;
  } = { requests: 0, resetTime: Date.now() };
  
  // ============================================================================
  // Constructor
  // ============================================================================
  
  constructor(config: TConfig) {
    this.config = config;
    this.logger = logger;
    
    // Logger initialization will be done in subclasses after adapterName is set
  }
  
  // ============================================================================
  // Abstract Methods - Must be implemented by subclasses
  // ============================================================================
  
  /**
   * Transform raw provider data to unified format
   */
  abstract transform(rawData: TRawData): Promise<AsyncResult<PartialUnifiedMetadata, Error>>;
  
  /**
   * Validate raw provider data
   */
  abstract validateRawData(data: unknown): data is TRawData;
  
  /**
   * Search for manga
   */
  abstract search(
    query: string, 
    options?: SearchOptions
  ): Promise<AsyncResult<MangaSearchResult[], Error>>;
  
  // ============================================================================
  // Public Methods - Common functionality
  // ============================================================================
  
  /**
   * Check if adapter is enabled
   */
  public isEnabled(): boolean {
    return this.config.enabled === true;
  }
  
  /**
   * Get adapter configuration
   */
  public getConfig(): TConfig {
    return { ...this.config };
  }
  
  /**
   * Update adapter configuration
   */
  public configure(config: Partial<TConfig>): void {
    this.config = { ...this.config, ...config };
    this.logger.info(`[${this.adapterName}] Configuration updated`);
  }
  
  /**
   * Get source information
   */
  public getSourceInfo(): MetadataSourceInfo {
    return {
      id: this.adapterName,
      name: this.providerName,
      type: this.adapterType,
      isActive: this.isEnabled()
    };
  }
  
  /**
   * Get adapter status
   */
  public getStatus(): Promise<AsyncResult<{ status: 'ok' | 'error'; message?: string }, Error>> {
    try {
      if (!this.isEnabled()) {
        return Promise.resolve(createSuccessResult({
          status: 'error',
          message: `${this.adapterName} is disabled`
        }));
      }

      // Subclasses can override for specific health checks
      return Promise.resolve(createSuccessResult({
        status: 'ok',
        message: `${this.adapterName} is operational`
      }));
    } catch (error: unknown) {
      return Promise.resolve(createErrorResult(
        error instanceof Error ? error : new Error(String(error))
      ));
    }
  }
  
  /**
   * Dispose of adapter resources
   */
  public dispose(): void {
    this.cache.clear();
    this.logger.info(`[${this.adapterName}] Adapter disposed`);
  }
  
  // ============================================================================
  // Protected Helper Methods
  // ============================================================================
  
  /**
   * Check and enforce rate limits
   */
  protected checkRateLimit(): Promise<boolean> {
    if (!this.config.rateLimit || !this.capabilities.rateLimit) {
      return Promise.resolve(true);
    }

    const now = Date.now();
    const windowMs = 60000; // 1 minute window

    if (now > this.rateLimitTracker.resetTime) {
      this.rateLimitTracker = {
        requests: 0,
        resetTime: now + windowMs
      };
    }

    if (this.rateLimitTracker.requests >= this.config.rateLimit) {
      const waitTime = this.rateLimitTracker.resetTime - now;
      this.logger.warn(`[${this.adapterName}] Rate limit reached. Wait ${waitTime}ms`);
      return Promise.resolve(false);
    }

    this.rateLimitTracker.requests++;
    return Promise.resolve(true);
  }
  
  /**
   * Get cached data if available and valid
   */
  protected getCached<T>(key: string): T | null {
    if (!this.config.cacheEnabled || !this.capabilities.caching) {
      return null;
    }
    
    const cached = this.cache.get(key);
    if (!cached) return null;

    const ttl = this.config.cacheTTL ?? 300000; // 5 minutes default
    if (Date.now() - cached.timestamp > ttl) {
      this.cache.delete(key);
      return null;
    }
    
    this.logger.debug(`[${this.adapterName}] Cache hit for key: ${key}`);
    return cached.data as T;
  }
  
  /**
   * Set cached data
   */
  protected setCached<T>(key: string, data: T): void {
    if (!this.config.cacheEnabled || !this.capabilities.caching) {
      return;
    }
    
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
    
    // Limit cache size
    if (this.cache.size > 100) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
  }
  
  /**
   * Execute with retry logic
   *
   * Retry attempt priority (highest to lowest):
   * 1. Parameter `retries` (call-specific override)
   * 2. Adapter config `this.config.retryAttempts` (adapter-specific setting)
   * 3. Global config `download.retryAttempts` (user's global preference)
   * 4. Hardcoded default `3` (fallback)
   */
  protected async executeWithRetry<T>(
    operation: () => Promise<T>,
    retries?: number
  ): Promise<T> {
    // Get global config retry attempts with fallback to 3
    const globalRetryAttempts = await configService.get<number>('download.retryAttempts', 3);

    // Priority chain: parameter → adapter config → global config → hardcoded default
    const maxRetries = retries ?? this.config.retryAttempts ?? globalRetryAttempts;
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // eslint-disable-next-line no-await-in-loop -- Retry logic requires sequential execution
        return await operation();
      } catch (error: unknown) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          this.logger.warn(
            `[${this.adapterName}] Attempt ${attempt} failed, retrying in ${delay}ms...`,
            lastError
          );
          // eslint-disable-next-line no-await-in-loop -- Retry delay requires sequential execution
          await new Promise(resolve => {setTimeout(resolve, delay)});
        }
      }
    }

    throw lastError ?? new Error('Operation failed after retries');
  }
  
  /**
   * Normalize and clean text
   */
  protected normalizeText(text?: string | null): string {
    if (!text) return '';
    
    return text
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/<[^>]*>/g, ''); // Remove HTML tags
  }
  
  /**
   * Clean and validate URL
   */
  protected cleanUrl(url?: string | null, baseUrl?: string): string {
    if (!url) return '';

    // Remove common tracking parameters
    const cleanedUrl = url.split('?')[0] ?? '';
    if (!cleanedUrl) return '';

    // Handle relative URLs
    if (baseUrl && !cleanedUrl.startsWith('http')) {
      if (cleanedUrl.startsWith('//')) {
        return 'https:' + cleanedUrl;
      }
      if (cleanedUrl.startsWith('/')) {
        const base = new URL(baseUrl);
        return base.origin + cleanedUrl;
      }
      return baseUrl + '/' + cleanedUrl;
    }

    return cleanedUrl;
  }
  
  /**
   * Calculate confidence score for results
   */
  protected calculateConfidence(
    query: string,
    result: unknown,
    additionalFactors: Record<string, number> = {}
  ): number {
    let confidence = this.baseConfidence;

    // Title similarity
    const resultObj = result as { title?: string };
    if (resultObj.title) {
      const titleLower = resultObj.title.toLowerCase();
      const queryLower = query.toLowerCase();
      
      if (titleLower === queryLower) {
        confidence *= 1.2;
      } else if (titleLower.includes(queryLower) || queryLower.includes(titleLower)) {
        confidence *= 1.1;
      }
    }
    
    // Apply additional factors
    Object.values(additionalFactors).forEach(factor => {
      confidence *= factor;
    });
    
    // Clamp to 0-1 range
    return Math.min(Math.max(confidence, 0), 1);
  }
  
  /**
   * Create a standardized error result
   */
  protected createError(message: string, cause?: Error): AsyncResult<unknown, Error> {
    const error = new Error(`[${this.adapterName}] ${message}`);
    if (cause) {
      (error as Error & { cause: Error }).cause = cause;
    }
    
    this.logger.error((error instanceof Error ? error.message : String(error)), cause);
    return createErrorResult(error);
  }
  
  /**
   * Log deprecation warning
   */
  protected logDeprecation(oldMethod: string, newMethod: string): void {
    this.logger.warn(
      `[${this.adapterName}] DEPRECATED: ${oldMethod} is deprecated. Use ${newMethod} instead.`
    );
  }
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if an adapter is a metadata adapter
 */
export function isMetadataAdapter(
  adapter: UnifiedBaseAdapter
): adapter is UnifiedBaseAdapter & { searchManga: (...args: unknown[]) => unknown } {
  return adapter.adapterType === 'metadata' || adapter.adapterType === 'hybrid';
}

/**
 * Check if an adapter is an integration adapter
 */
export function isIntegrationAdapter(
  adapter: UnifiedBaseAdapter
): adapter is UnifiedBaseAdapter & { getChapters: (...args: unknown[]) => unknown } {
  return adapter.adapterType === 'integration' || adapter.adapterType === 'hybrid';
}

// ============================================================================
// Exports
// ============================================================================

export default UnifiedBaseAdapter;