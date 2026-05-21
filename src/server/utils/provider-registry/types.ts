/**
 * Provider Registry Types Module
 *
 * Foundation type definitions for the provider registry system.
 * All type definitions, interfaces, and enums for metadata providers.
 *
 * Extracted from: provider-registry.ts (lines 36-112, 357-360)
 */

import type { MangaSearchResult, MangaMetadata } from '@/types/search.types';
import type { AsyncResult } from '@/utils/async-result';

// ============================================================================
// Enums
// ============================================================================

/**
 * Provider status enum
 */
export enum ProviderStatus {
  REGISTERED = 'registered',
  INITIALIZING = 'initializing',
  READY = 'ready',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
  DISABLED = 'disabled',
  REMOVED = 'removed'
}

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Provider capability flags
 */
export interface ProviderCapabilities {
  search: boolean;
  metadata: boolean;
  chapters: boolean;
  covers: boolean;
  calendar: boolean;
  bulkOperations: boolean;
  authentication: boolean;
  rateLimit: boolean;
  caching: boolean;
  webhook: boolean;
}

/**
 * Provider health metrics
 */
export interface ProviderHealth {
  status: ProviderStatus;
  uptime: number;
  lastCheck: number;
  consecutiveFailures: number;
  averageResponseTime: number;
  errorRate: number;
  requestCount: number;
  lastError?: string;
  circuitBreakerOpen: boolean;
}

/**
 * Provider configuration
 */
export interface ProviderConfig {
  id: string;
  name: string;
  version: string;
  type: 'anilist' | 'mangadex' | 'comicvine' | 'fandom' | 'wikipedia' | 'custom';
  enabled: boolean;
  priority: number; // Higher priority = preferred
  timeout: number;
  retries: number;
  healthCheckInterval: number;
  circuitBreakerThreshold: number;
  customConfig?: Record<string, unknown>;
}

/**
 * Provider interface that all providers must implement
 */
export interface MetadataProviderInterface {
  // Identification
  id: string;
  name: string;
  version: string;
  capabilities: ProviderCapabilities;
  // Core methods
  initialize(config: ProviderConfig): Promise<void>;
  shutdown(): Promise<void>;
  // Search and metadata
  search(query: string, options?: unknown): Promise<AsyncResult<MangaSearchResult[], Error>>;
  getMetadata(id: string, options?: unknown): Promise<AsyncResult<MangaMetadata, Error>>;
  // Health
  healthCheck(): Promise<boolean>;
  getMetrics(): ProviderHealth;
}

// ============================================================================
// Type Aliases
// ============================================================================

/**
 * Provider middleware function type
 */
export type ProviderMiddleware = (
  provider: MetadataProviderInterface,
  next: () => Promise<unknown>
) => Promise<unknown>;
