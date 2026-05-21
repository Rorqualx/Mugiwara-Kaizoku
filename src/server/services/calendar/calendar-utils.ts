/**
 * Calendar Utilities Module
 *
 * Shared types, interfaces, validation schemas, and helper functions
 * used across all Release Schedule Aggregator modules.
 *
 * Extracted from: ReleaseScheduleAggregator.ts (lines 1-57)
 */

import { z } from 'zod';

// ============================================================================
// Validation Schemas
// ============================================================================

/**
 * Schema for validating manga metadata with provider IDs
 */
export const MangaMetadataSchema = z.object({
  providers: z.record(z.object({
    id: z.string()
  }).passthrough()).optional()
}).passthrough();

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Aggregated release schedule from multiple providers
 */
export interface AggregatedReleaseSchedule {
  pattern: string;
  confidence: number;
  nextRelease?: Date;
  providers: string[];
  lastSynced?: Date;
  primary?: ProviderScheduleData;
  alternatives?: ProviderScheduleData[];
}

/**
 * Schedule data from a single provider
 */
export interface ProviderScheduleData extends Partial<ReleaseScheduleInfo> {
  provider: string;
  schedule?: unknown;
  confidence: number;
  lastUpdated?: Date;
  recentChapters?: unknown[];
  rawData?: unknown;
}

/**
 * Release schedule information
 */
export interface ReleaseScheduleInfo {
  pattern?: string;
  nextRelease?: Date;
  confidence?: number;
  dayOfWeek?: number;
}

/**
 * Configuration for schedule aggregator
 */
export interface ScheduleAggregatorConfig {
  providers?: string[];
  minimumConfidence?: number;
  consensusThreshold?: number;
  cacheEnabled?: boolean;
  cacheTTL?: number; // minutes
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert unknown error to Error instance
 */
export function handleError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  return new Error(String(error));
}

/**
 * Type guard for checking if value is a record
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
