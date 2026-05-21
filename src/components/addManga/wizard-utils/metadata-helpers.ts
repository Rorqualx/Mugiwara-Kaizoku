/**
 * Metadata Helper Functions
 *
 * Utility functions for metadata processing, confidence calculation,
 * and cover image aggregation.
 *
 * @module components/addManga/wizard-utils/metadata-helpers
 */

import type { ProviderMetadata } from '@/types/universalImportWizard.types';
import { type createLogger } from '@/utils/logger';
import { getUnknownProperty } from '@/utils/type-guards/safe-access';

// ============================================================================
// Date Normalization
// ============================================================================

/**
 * Date object format used by some providers (AniList)
 */
interface DateObject {
  year?: number;
  month?: number;
  day?: number;
}

/**
 * Normalizes a date value to MM-DD-YYYY format
 * Handles various input formats:
 * - YYYY-MM-DD (ISO format from AniList/Wikipedia)
 * - MM-DD-YYYY (already normalized)
 * - YYYY or YYYY-MM (partial dates)
 * - { year, month, day } object format
 *
 * @param value - Date value in various formats
 * @returns Date string in MM-DD-YYYY format, or partial format if incomplete
 */
export function normalizeDateToMMDDYYYY(value: unknown): string {
  if (!value) return '';

  // Handle date object format { year, month, day }
  if (typeof value === 'object' && !Array.isArray(value)) {
    const dateObj = value as DateObject;
    if (dateObj.year !== undefined) {
      const year = String(dateObj.year);
      const month = dateObj.month !== undefined ? String(dateObj.month).padStart(2, '0') : '';
      const day = dateObj.day !== undefined ? String(dateObj.day).padStart(2, '0') : '';

      if (month && day) {
        return `${month}-${day}-${year}`;
      } else if (month) {
        return `${month}-${year}`;
      }
      return year;
    }
    return '';
  }

  // Handle string formats
  if (typeof value !== 'string') return '';

  const dateStr = value.trim();
  if (!dateStr) return '';

  // Check if already in MM-DD-YYYY format (month 01-12, day 01-31, year 4 digits)
  const mmddyyyyMatch = dateStr.match(/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])-(\d{4})$/);
  if (mmddyyyyMatch) {
    return dateStr; // Already normalized
  }

  // Check for YYYY-MM-DD format (ISO)
  const isoMatch = dateStr.match(/^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${month}-${day}-${year}`;
  }

  // Check for YYYY-MM format (partial)
  const yearMonthMatch = dateStr.match(/^(\d{4})-(0[1-9]|1[0-2])$/);
  if (yearMonthMatch) {
    const [, year, month] = yearMonthMatch;
    return `${month}-${year}`;
  }

  // Check for just YYYY format
  const yearOnlyMatch = dateStr.match(/^(\d{4})$/);
  if (yearOnlyMatch) {
    return dateStr; // Return year as-is
  }

  // Return original string if no pattern matches (could be other formats)
  return dateStr;
}

// ============================================================================
// HTML Processing
// ============================================================================

/**
 * Removes HTML tags and decodes HTML entities from a string
 * @param html - HTML string to clean
 * @returns Plain text without HTML tags or entities
 */
export function cleanHtml(html: string): string {
  // First remove figure tags and their content completely (images)
  let cleaned = html.replace(/<figure[^>]*>[\s\S]*?<\/figure>/gi, '');

  // Remove all HTML tags
  cleaned = cleaned.replace(/<[^>]*>/g, '');

  // Decode common HTML entities
  cleaned = cleaned
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&hellip;/g, '...')
    .replace(/&#(\d+);/g, (_match: string, dec: string) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&#x([0-9A-Fa-f]+);/g, (_match: string, hex: string) => String.fromCharCode(parseInt(hex, 16)));

  // Remove extra whitespace and trim
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned;
}

// ============================================================================
// Confidence Calculation
// ============================================================================

// Re-export calculateFieldConfidence from the confidence lib
// This maintains backwards compatibility for existing consumers
// The new implementation uses dynamic multi-factor confidence scoring
export { getFieldConfidence as calculateFieldConfidence } from '@/lib/confidence';

// ============================================================================
// Cover Image Aggregation - Helper Functions
// ============================================================================

/**
 * Extracts cover URL from a volume object
 */
function extractCoverFromVolume(volObj: Record<string, unknown>): string | undefined {
  const coverUrl = getUnknownProperty(volObj, 'coverImageUrl')
    ?? getUnknownProperty(volObj, 'coverUrl')
    ?? getUnknownProperty(volObj, 'coverImage')
    ?? getUnknownProperty(volObj, 'image');
  return coverUrl as string | undefined;
}

/**
 * Collects covers from an array of volume objects
 */
function collectCoversFromVolumeArray(
  volumeArray: unknown[],
  existingCovers: string[]
): void {
  for (const volume of volumeArray) {
    const volObj = volume as Record<string, unknown>;
    const coverUrl = extractCoverFromVolume(volObj);
    if (coverUrl && !existingCovers.includes(coverUrl)) {
      existingCovers.push(coverUrl);
    }
  }
}

/**
 * Extracts covers from provider metadata object
 */
function extractCoversFromMetadata(metadataObj: Record<string, unknown>): string[] {
  const covers: string[] = [];

  // Check volumeData (primary source)
  const volumeData = getUnknownProperty(metadataObj, 'volumeData');
  if (Array.isArray(volumeData)) {
    collectCoversFromVolumeArray(volumeData, covers);
  }

  // Check volumes array (ComicVine pattern)
  const volumes = getUnknownProperty(metadataObj, 'volumes');
  if (Array.isArray(volumes)) {
    collectCoversFromVolumeArray(volumes, covers);
  }

  // Check rawData nested structures
  const rawData = getUnknownProperty(metadataObj, 'rawData') as Record<string, unknown> | undefined;
  if (rawData) {
    const volumeList = getUnknownProperty(rawData, 'volumeList');
    if (Array.isArray(volumeList)) {
      collectCoversFromVolumeArray(volumeList, covers);
    }
    const rawDataVolumes = getUnknownProperty(rawData, 'volumes');
    if (Array.isArray(rawDataVolumes)) {
      collectCoversFromVolumeArray(rawDataVolumes, covers);
    }
  }

  return covers;
}

// ============================================================================
// Cover Image Aggregation - Main Function
// ============================================================================

/**
 * Aggregates volume cover images from all provider metadata sources
 * @param selectedSourcesMetadata - Metadata from all providers
 * @param loggerInstance - Logger instance for debugging
 * @returns Map of provider names to arrays of cover image URLs
 */
export function getVolumeCoversByProvider(
  selectedSourcesMetadata: Record<string, ProviderMetadata>,
  loggerInstance: ReturnType<typeof createLogger>
): Record<string, string[]> {
  const volumeCoversByProvider: Record<string, string[]> = {};

  for (const [providerName, metadata] of Object.entries(selectedSourcesMetadata)) {
    const metadataObj = metadata as Record<string, unknown>;
    const covers = extractCoversFromMetadata(metadataObj);

    if (covers.length > 0) {
      volumeCoversByProvider[providerName] = covers;
      loggerInstance.info(`[getVolumeCoversByProvider] Found ${covers.length} volume covers from ${providerName}`);
    }
  }

  return volumeCoversByProvider;
}
