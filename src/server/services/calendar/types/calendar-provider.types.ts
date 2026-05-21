/**
 * Calendar Provider Types
 *
 * Type definitions and interfaces for calendar providers.
 * Includes provider configuration, health status, and registration interfaces.
 *
 * @module server/services/calendar/types/calendar-provider
 */

import type { AsyncResult } from '@/utils/async-result';

// ============================================================================
// Provider Status Types
// ============================================================================

/**
 * Health status of a calendar provider
 */
export type ProviderHealthStatus = 'healthy' | 'unhealthy' | 'degraded' | 'unknown';

/**
 * Provider health information
 */
export interface ProviderHealthInfo {
  status: ProviderHealthStatus;
  lastCheck: Date;
  consecutiveFailures: number;
  responseTime: number | null;
  lastSuccessTime: Date | null;
  errorMessage?: string;
}

// ============================================================================
// Provider Configuration Types
// ============================================================================

/**
 * Provider priority configuration
 * Higher priority providers take precedence when data conflicts
 */
export interface ProviderPriorityConfig {
  /** Provider name */
  name: string;
  /** Priority value (higher = more important) */
  priority: number;
  /** Weight multiplier for confidence scores */
  weight: number;
  /** Whether this provider is enabled */
  enabled: boolean;
}

/**
 * Default provider priorities
 */
export const DEFAULT_PROVIDER_PRIORITIES: Record<string, ProviderPriorityConfig> = {
  manual_override: { name: 'manual_override', priority: 100, weight: 1.5, enabled: true },
  mangadex: { name: 'mangadex', priority: 80, weight: 1.2, enabled: true },
  anilist: { name: 'anilist', priority: 70, weight: 1.1, enabled: true },
  detected: { name: 'detected', priority: 50, weight: 1.0, enabled: true },
};

/**
 * Calendar provider configuration
 */
export interface CalendarProviderConfig {
  /** Provider name */
  name: string;
  /** Whether provider is enabled */
  enabled: boolean;
  /** Rate limit (requests per minute) */
  rateLimit: number;
  /** Cache TTL in milliseconds */
  cacheTTL: number;
  /** Priority for conflict resolution */
  priority: number;
  /** Weight for confidence calculations */
  weight: number;
  /** Provider-specific options */
  options?: Record<string, unknown>;
}

// ============================================================================
// Provider Interface Types
// ============================================================================

/**
 * Release schedule data returned by providers
 */
export interface ProviderReleaseData {
  mangaId: string | number;
  pattern?: string;
  dayOfWeek?: number;
  dayOfMonth?: number;
  releaseTime?: string;
  timezone?: string;
  confidence: number;
  nextRelease?: Date;
  source: string;
  rawData?: unknown;
}

/**
 * Recent release information from provider
 */
export interface ProviderRecentRelease {
  chapterNumber: string;
  releaseDate: Date;
  title?: string;
  url?: string;
}

/**
 * Calendar provider interface
 */
export interface ICalendarProvider {
  /** Provider name */
  readonly name: string;

  /** Get release schedule for a manga */
  getSchedule(mangaId: string | number): Promise<AsyncResult<ProviderReleaseData | null, Error>>;

  /** Get recent releases for a manga */
  getRecentReleases(
    mangaId: string | number,
    limit?: number
  ): Promise<AsyncResult<ProviderRecentRelease[], Error>>;

  /** Check if provider supports a specific manga */
  supports(mangaId: string | number): Promise<boolean>;

  /** Get provider health status */
  getHealth(): ProviderHealthInfo;

  /** Initialize the provider */
  initialize(): Promise<AsyncResult<void, Error>>;

  /** Cleanup provider resources */
  cleanup(): Promise<void>;
}

// ============================================================================
// Provider Registry Types
// ============================================================================

/**
 * Provider registration entry
 */
export interface ProviderRegistryEntry {
  provider: ICalendarProvider;
  config: CalendarProviderConfig;
  health: ProviderHealthInfo;
}

/**
 * Provider factory function type
 */
export type ProviderFactory = (config: CalendarProviderConfig) => ICalendarProvider;

/**
 * Provider registry interface
 */
export interface IProviderRegistry {
  /** Register a provider */
  register(name: string, factory: ProviderFactory, config: CalendarProviderConfig): void;

  /** Get a provider by name */
  get(name: string): ProviderRegistryEntry | undefined;

  /** Get all registered providers */
  getAll(): ProviderRegistryEntry[];

  /** Get enabled providers sorted by priority */
  getEnabled(): ProviderRegistryEntry[];

  /** Remove a provider */
  remove(name: string): boolean;

  /** Check if a provider is registered */
  has(name: string): boolean;
}

// ============================================================================
// Provider Event Types
// ============================================================================

/**
 * Provider event types for health monitoring
 */
export type ProviderEventType =
  | 'provider:initialized'
  | 'provider:healthy'
  | 'provider:unhealthy'
  | 'provider:degraded'
  | 'provider:error'
  | 'provider:recovered';

/**
 * Provider event payload
 */
export interface ProviderEvent {
  type: ProviderEventType;
  provider: string;
  timestamp: Date;
  health: ProviderHealthInfo;
  details?: unknown;
}

/**
 * Provider event handler function
 */
export type ProviderEventHandler = (event: ProviderEvent) => void;
