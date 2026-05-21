/**
 * Metadata Merger Utilities
 *
 * Shared type guards, interfaces, schemas, and utility functions
 * used across all metadata merger modules.
 *
 * Extracted from: metadataMerger.ts
 */

import { ChapterStatus, MangaPublicationStatus, MangaFormat } from '@prisma/client';
import { z } from 'zod';

import { logger } from '@/utils/logger';
import { getUnknownProperty } from '@/utils/type-guards/safe-access';


// Re-export for convenience
export { getUnknownProperty };
export { MangaPublicationStatus, MangaFormat, ChapterStatus };

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if a value is a record object
 *
 * @param value - Value to check
 * @returns True if value is a non-null object
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// ============================================================================
// Interfaces
// ============================================================================

/**
 * MetadataConflict model interface (optional model that might not exist in all schema versions)
 */
export interface MetadataConflict {
  id: number;
  mangaId: number;
  fieldName: string;
  values: Record<string, unknown>;
  resolved: boolean;
  resolution?: string;
  resolutionProvider?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Interface for PrismaClient with potential dynamic model access
 */
export interface ExtendedPrismaClient {
  // Standard Prisma models that we know exist
  manga: unknown;
  // Optional models that might not exist in all schema versions
  metadataConflict?: {
    findMany: (args: unknown) => Promise<MetadataConflict[]>;
    deleteMany: (args: unknown) => Promise<{ count: number }>;
    createMany: (args: unknown) => Promise<{ count: number }>;
  };
}

/**
 * Interface for tracking metadata values from different providers
 * for conflict detection
 */
export interface MetadataValues {
  [field: string]: {
    [provider: string]: unknown;
  };
}

/**
 * Interface for metadata update events
 */
export interface MetadataUpdateEvent {
  mangaId: number;
  stage: 'initializing' | 'fetching' | 'fetched' | 'processing' | 'saving' | 'complete' | 'error';
  provider?: string;
  message?: string;
  error?: string;
  timestamp: number;
}

/**
 * Interface for extended provider metadata
 */
export interface ExtendedProviderMetadata extends Record<string, unknown> {
  id: string;
  preferences?: unknown;
  metadataProvenance?: unknown;
  rawMetadata?: unknown;
  lastFetched?: unknown;
}

// ============================================================================
// Zod Schemas
// ============================================================================

/**
 * Schema for validating provider metadata as a record of unknown values
 */
export const ProviderMetadataSchema = z.record(z.unknown());

/**
 * Schema for raw provider data with optional providerMetadata
 */
export const RawProviderDataSchema = z.object({
  providerMetadata: ProviderMetadataSchema.optional()
}).passthrough();

/**
 * Schema for stored metadata with optional importProfile
 */
export const StoredMetadataSchema = z.object({
  importProfile: z.unknown().optional()
}).passthrough();

// ============================================================================
// Mapper Functions
// ============================================================================

/**
 * Maps domain ChapterStatus to Prisma ChapterStatus
 *
 * @param status - Domain ChapterStatus value
 * @returns Corresponding Prisma ChapterStatus value
 */
export function mapDomainToPrismaChapterStatus(status: ChapterStatus): ChapterStatus {
  // Since we're using Prisma types directly, no mapping needed
  return status;
}

/**
 * Maps Prisma ChapterStatus to domain ChapterStatus
 *
 * @param status - Prisma ChapterStatus value
 * @returns Corresponding domain ChapterStatus value
 */
export function mapPrismaToDomainChapterStatus(status: ChapterStatus): ChapterStatus {
  // Since we're using Prisma types directly, no mapping needed
  return status;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Validates if a value is a reasonable count for volumes/chapters
 * Prevents dates (years) from being used as counts
 *
 * @param value - Value to validate
 * @returns True if the value is a valid count
 */
export function isValidCount(value: unknown): boolean {
  if (typeof value !== 'number' || !isFinite(value)) {
    return false;
  }
  // Check if value might be a year (between 1900 and 2100)
  if (value >= 1900 && value <= 2100) {
    logger.warn(`Suspicious count value ${value} detected - might be a year`);
    return false;
  }
  // Check for reasonable manga counts
  if (value < 0 || value > 10000) {
    logger.warn(`Unreasonable count value ${value} detected`);
    return false;
  }
  return true;
}

/**
 * Normalizes status values from different providers to a consistent format
 *
 * @param status - Status value from a provider
 * @returns Normalized status string or null if empty
 */
export function normalizeStatus(status: unknown): string | null {
  if (!status) {
    return null;
  }
  const statusStr = String(status).toUpperCase();
  // Map various status formats to our standard ones
  if (statusStr.includes('ONGOING') || statusStr.includes('SERIALIZING')) {
    return 'ONGOING';
  }
  if (statusStr.includes('COMPLETED') || statusStr.includes('FINISHED') || statusStr.includes('CONCLUDED')) {
    return 'COMPLETED';
  }
  if (statusStr.includes('CANCELLED') || statusStr.includes('CANCELED') || statusStr.includes('DISCONTINUED')) {
    return 'CANCELLED';
  }
  if (statusStr.includes('HIATUS')) {
    return 'HIATUS';
  }
  if (statusStr.includes('NOT_YET') || statusStr.includes('UPCOMING') || statusStr.includes('ANNOUNCED')) {
    return 'NOT_YET_RELEASED';
  }
  return statusStr; // Return normalized string if no mapping found
}

/**
 * Processes date values from different providers into a consistent Date object
 *
 * @param dateValue - Date value in various formats
 * @param fieldName - Name of the field being processed (for logging)
 * @returns Processed Date object or undefined if invalid
 */
export function processDate(dateValue: unknown, fieldName: string): Date | undefined {
  if (!dateValue) {
    return undefined;
  }
  // Handle AniList date objects {year, month, day}
  if (typeof dateValue === 'object' && 'year' in dateValue) {
    const record = dateValue as Record<string, unknown>;
    const year = record['year'];
    const month = record['month'];
    const day = record['day'];
    if (typeof year === 'number') {
      const monthNum = typeof month === 'number' ? month : 1;
      const dayNum = typeof day === 'number' ? day : 1;
      const date = new Date(year, monthNum - 1, dayNum);
      if (!isNaN(date.getTime())) {
        logger.debug(`Processed AniList date for ${fieldName}: ${date.toISOString()}`);
        return date;
      }
    }
  }
  // Handle Date objects
  if (dateValue instanceof Date) {
    if (!isNaN(dateValue.getTime())) {
      return dateValue;
    }
  }
  // Handle ISO strings or other date strings
  if (typeof dateValue === 'string') {
    const date = new Date(dateValue);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }
  // Handle timestamps
  if (typeof dateValue === 'number') {
    const date = new Date(dateValue);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }
  logger.warn(`Could not process date value for ${fieldName}: ${JSON.stringify(dateValue)}`);
  return undefined;
}
