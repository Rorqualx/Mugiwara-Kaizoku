/**
 * Calendar Provider Integration - Types & Utilities
 *
 * Foundation module containing all type definitions, interfaces,
 * and helper functions used across calendar provider integration.
 *
 * This module has NO runtime dependencies on other service modules,
 * making it safe for all other modules to import from.
 *
 * Extracted from: CalendarProviderIntegrationService.ts (lines 1-75)
 */

// ============================================================================
// External Imports
// ============================================================================


// ============================================================================
// Internal Imports
// ============================================================================

import { CalendarEventType, EventStatus } from '@prisma/client';

import { isCalendarSupportedProvider } from '@/server/base/CalendarSupportedProvider';
import type {
  CalendarSupportedProvider,
  ReleaseFallbackStrategy
} from '@/server/base/CalendarSupportedProvider';
import type {
  RecentRelease as SearchRecentRelease,
  ProviderReleaseSchedule as SearchProviderReleaseSchedule
} from '@/types/search.types';


import type { PrismaClient, ReleaseType } from '@prisma/client';

// ============================================================================
// Re-exported Types
// ============================================================================

/**
 * Recent release data from providers
 * Re-exported from search.types for convenience
 */
export type RecentRelease = SearchRecentRelease;

/**
 * Provider release schedule information
 * Re-exported from search.types for convenience
 */
export type ProviderReleaseSchedule = SearchProviderReleaseSchedule;

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if value is a Record object
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// ============================================================================
// Configuration Interfaces
// ============================================================================

/**
 * Configuration for the provider integration service
 */
export interface ProviderIntegrationConfig {
  /** Available calendar-supporting providers */
  providers: Map<string, CalendarSupportedProvider>;
  /** Prisma client for database operations */
  prisma: PrismaClient;
  /** Fallback strategy configuration */
  fallbackStrategy: ReleaseFallbackStrategy;
  /** Default timezone for schedules */
  defaultTimezone: string;
  /** Maximum concurrent provider requests */
  maxConcurrentRequests: number;
}

// ============================================================================
// Internal Result Types
// ============================================================================

/**
 * Result from syncing a single manga's schedule
 */
export interface MangaSyncResult {
  /** Whether a release schedule was detected */
  scheduleDetected: boolean;
  /** Number of recent releases fetched */
  releasesFetched: number;
}

// ============================================================================
// Re-exported Enums & Constants
// ============================================================================

export { CalendarEventType, EventStatus, isCalendarSupportedProvider };
export type { ReleaseType };
