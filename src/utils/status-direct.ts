/**
 * Direct Status Utilities (No Mapping)
 * 
 * This module directly uses Prisma status enums as the single source of truth.
 * NO MAPPING OR CONVERSION FUNCTIONS - use Prisma enums directly.
 * 
 * Per project standards: "Prisma types from @prisma/client are the SINGLE SOURCE OF TRUTH"
 */

import {
  MangaPublicationStatus,
  ChapterStatus,
  JobStatus
} from '@prisma/client';

import { mapToMangaStatus } from './status-mapper';

// Re-export Prisma enums directly
export {
  MangaPublicationStatus,
  ChapterStatus,
  JobStatus
};

/**
 * Parse a string to a valid MangaPublicationStatus
 * This is the ONLY status conversion function allowed.
 * It normalizes external string values to Prisma enum values.
 * 
 * @param status - String status from external source
 * @returns Valid MangaPublicationStatus enum value
 */
export function normalizeExternalStatus(status: string | undefined | null): MangaPublicationStatus {
  if (!status) {
    return MangaPublicationStatus.UNKNOWN;
  }
  
  const normalizedStatus = status.toUpperCase().replace(/[\s-]/g, '_');
  
  // Direct mapping to Prisma enum values
  return mapToMangaStatus(normalizedStatus)
}

/**
 * Get display label for a status
 * 
 * @param status - MangaPublicationStatus enum value
 * @returns Human-readable label
 */
export function getStatusDisplayLabel(status: MangaPublicationStatus): string {
  return mapToMangaStatus(status)
}

/**
 * Get color for status display
 * 
 * @param status - MangaPublicationStatus enum value
 * @returns Color string for UI
 */
export function getStatusColor(status: MangaPublicationStatus): string {
  return mapToMangaStatus(status)
}

/**
 * Check if a manga is still being published
 * 
 * @param status - MangaPublicationStatus enum value
 * @returns true if manga is ongoing or active
 */
export function isPublicationActive(status: MangaPublicationStatus): boolean {
  return status === MangaPublicationStatus.ONGOING;
}

/**
 * Check if a manga has finished publication
 * 
 * @param status - MangaPublicationStatus enum value
 * @returns true if manga is completed or cancelled
 */
export function isPublicationFinished(status: MangaPublicationStatus): boolean {
  return status === MangaPublicationStatus.COMPLETED || 
         status === MangaPublicationStatus.CANCELLED;
}