/**
 * Download Monitor Utilities Module
 *
 * Shared Zod schemas, type definitions, and helper functions
 * used across all download monitoring modules.
 *
 * Extracted from: downloadMonitor.ts (lines 12-56)
 * Date: 2025-11-21
 */

import { z } from 'zod';

// ============================================================================
// Zod Validation Schemas
// ============================================================================

/**
 * Schema for AsyncResult download ID format
 * Validates that a download ID is wrapped in AsyncResult success format
 */
export const AsyncResultDownloadIdSchema = z.object({
  data: z.string(),
  status: z.literal('success')
});

/**
 * Schema for job result data structure
 * Validates the result field stored in Jobs table after download initiation
 */
export const JobResultSchema = z.object({
  downloadId: z.union([z.string(), AsyncResultDownloadIdSchema]).optional(),
  clientType: z.string().optional(),
  mode: z.string().optional()
});

/**
 * Schema for job payload data structure
 * Validates the payload field stored in Jobs table
 * Uses passthrough to allow additional fields while extracting mode
 */
export const JobPayloadSchema = z.object({
  mode: z.string().optional()
}).passthrough(); // Allow additional fields

/**
 * Schema for download status response from download clients
 * Validates the status information returned by download client adapters
 */
export const DownloadStatusSchema = z.object({
  status: z.string(),
  savePath: z.string().optional(),
  name: z.string().optional(),
  size: z.number().optional(),
  error: z.unknown().optional(),
  progress: z.number().optional(),
  clientSpecific: z.unknown().optional()
}).passthrough();

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Information about a completed download ready for import
 *
 * Represents a download that has finished in the download client
 * and is ready to be imported into the library.
 *
 * @property jobId - Database ID of the job that initiated the download
 * @property downloadId - Client-specific download identifier
 * @property clientType - Type of download client (e.g., 'qbittorrent', 'transmission')
 * @property savePath - Absolute path where download client saved the file
 * @property fileName - Name of the downloaded file or directory
 * @property mangaId - Database ID of the manga this download belongs to
 * @property chapterIds - Array of chapter IDs being downloaded
 * @property size - Total size in bytes of the downloaded content
 * @property status - Current download status (e.g., 'COMPLETED', 'SEEDING')
 * @property mode - Optional download mode: 'PACK' (volume/series bundle) or 'BULK' (individual chapters)
 */
export interface CompletedDownload {
  jobId: string;
  downloadId: string;
  clientType: string;
  savePath: string;
  fileName: string;
  mangaId: number;
  chapterIds: number[];
  size: number;
  status: string;
  mode?: string; // 'PACK' or 'BULK' - determines if archive extraction is needed
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Safely parse JSON value
 *
 * Attempts to parse a string as JSON. If the value is already parsed
 * or parsing fails, returns the value/null appropriately.
 *
 * @param value - Value to parse (string or already parsed object)
 * @returns Parsed value, original value if not a string, or null if parsing fails
 *
 * @example
 * ```typescript
 * const parsed = safeParseJson('{"key": "value"}');
 * // Returns: { key: "value" }
 *
 * const alreadyParsed = safeParseJson({ key: "value" });
 * // Returns: { key: "value" }
 *
 * const invalid = safeParseJson('invalid json');
 * // Returns: null
 * ```
 */
export function safeParseJson(value: unknown): unknown {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return null;
    }
  }
  return value;
}

/**
 * Validate manga ID exists and is not null/undefined
 *
 * Eliminates the need for non-null assertions (!.) when working with
 * potentially null manga IDs from database queries.
 *
 * @param mangaId - Manga ID to validate
 * @returns Validated manga ID (guaranteed to be a number)
 * @throws Error if mangaId is null or undefined
 *
 * @example
 * ```typescript
 * const job = await prisma.jobs.findUnique({ where: { id: 1 } });
 * const mangaId = validateMangaId(job.manga_id);
 * // Now mangaId is guaranteed to be a number, no ! needed
 * ```
 */
export function validateMangaId(mangaId: number | null | undefined): number {
  if (mangaId === null || mangaId === undefined) {
    throw new Error('mangaId is required but was null or undefined');
  }
  return mangaId;
}
