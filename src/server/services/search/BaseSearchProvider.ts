/**
 * Base Search Provider Abstract Class
 */

import { logger } from '@/utils/logger';

import type {
  SearchResult,
  SearchProviderConfig,
  SearchFilters
} from './types';

export abstract class BaseSearchProvider {
  protected config: SearchProviderConfig;
  protected log = logger.child(this.constructor["name"]);

  constructor(config?: SearchProviderConfig) {
    this.config = {
      name: config?.name ?? 'Unknown',
      identifier: config?.identifier ?? 'unknown',
      supportedTypes: config?.supportedTypes ?? ['manga'],
      rateLimit: config?.rateLimit ?? {
        requestsPerSecond: 5,
        burstLimit: 10
      },
      cache: config?.cache ?? {
        enabled: true,
        ttl: 3600
      },
      timeout: config?.timeout ?? 30000,
      retries: config?.retries ?? 3
    };
  }

  /**
   * Search for manga/content
   */
  abstract search(
    query: string,
    filters?: SearchFilters
  ): Promise<SearchResult[]>;

  /**
   * Get detailed information about a specific item
   */
  abstract getMangaDetails(
    identifier: string,
    hint?: string
  ): Promise<SearchResult | null>;

  /**
   * Validate provider functionality
   */
  abstract validate(): Promise<boolean>;

  /**
   * Get provider name
   */
  getName(): string {
    return this.config["name"] ?? 'Unknown';
  }

  /**
   * Get provider identifier
   */
  getIdentifier(): string {
    return this.config.identifier ?? 'unknown';
  }

  /**
   * Get supported types
   */
  getSupportedTypes(): string[] {
    return this.config.supportedTypes ?? [];
  }

  /**
   * Check if type is supported
   */
  supportsType(type: string): boolean {
    return this.getSupportedTypes().includes(type);
  }

  /**
   * Clean up resources
   */
  cleanup(): Promise<void> {
    this.log.info('Cleaning up provider resources');
    return Promise.resolve();
  }
}