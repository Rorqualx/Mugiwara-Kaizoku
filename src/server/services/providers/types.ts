/**
 * Provider Strategy Types
 * 
 * Type definitions for metadata provider strategies.
 */

export interface ProviderConfig {
  enabled: boolean;
  priority?: number;
  rateLimit?: {
    requestsPerSecond: number;
    burstLimit?: number;
  };
  cache?: {
    enabled: boolean;
    ttl: number;
  };
  timeout?: number;
  retries?: number;
}

export interface ProviderStrategy {
  name: string;
  
  /**
   * Search for content using this provider
   */
  search(query: string, options?: unknown): Promise<unknown>;
  
  /**
   * Get detailed metadata for a specific item
   */
  getMetadata(id: string, options?: unknown): Promise<unknown>;
  
  /**
   * Check if this provider can handle the given query or URL
   */
  canHandle?(query: string): boolean;
  
  /**
   * Get provider configuration
   */
  getConfig?(): ProviderConfig;
}