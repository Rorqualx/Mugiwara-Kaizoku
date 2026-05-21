/**
 * Job Parser Module
 *
 * Parse and validate job results from download jobs.
 * Extracts download IDs, client types, and modes while
 * eliminating non-null assertions through validation.
 *
 * Extracted from: downloadMonitor.ts (lines 100-146)
 * Created: 2025-11-21
 */

import { logger } from '@/utils/logger';

import {
  safeParseJson,
  validateMangaId,
  JobResultSchema,
  JobPayloadSchema
} from './utils';

import type { jobs } from '@prisma/client';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Parsed and validated job data
 *
 * Contains all necessary information extracted from a job record,
 * with validated manga ID (no null assertions needed).
 *
 * @property downloadId - Client-specific download identifier
 * @property clientType - Type of download client (e.g., 'qbittorrent')
 * @property mode - Download mode: 'PACK' (volume bundle) or 'BULK' (individual chapters)
 * @property mangaId - Validated manga ID (guaranteed to be a number, never null)
 */
export interface ParsedJobData {
  downloadId: string;
  clientType: string;
  mode?: string;
  mangaId: number; // Validated, never null
}

// ============================================================================
// Job Parsing Functions
// ============================================================================

/**
 * Parse job result and payload to extract download information
 *
 * Extracts download ID, client type, and mode from job records.
 * Validates manga ID to eliminate non-null assertions.
 *
 * @param job - Job record from database
 * @returns Parsed job data or null if invalid
 *
 * @example
 * ```typescript
 * const job = await prisma.jobs.findUnique({ where: { id: 1 } });
 * const parsed = parseJobResult(job);
 *
 * if (!parsed) {
 *   logger.warn('Invalid job data');
 *   return;
 * }
 *
 * // Now we can use parsed.mangaId without ! assertion
 * const chapters = await prisma.chapter.findMany({
 *   where: { mangaId: parsed.mangaId }
 * });
 * ```
 */
export function parseJobResult(job: jobs): ParsedJobData | null {
  // Parse and validate job result to get download ID and client type
  const rawResult = safeParseJson(job.result);

  const resultParse = JobResultSchema.safeParse(rawResult);
  if (!resultParse.success) {
    logger.warn(`[JobParser] Invalid job result for job ${job.id}:`, resultParse.error);
    return null;
  }

  const result = resultParse.data;

  // Extract downloadId - handle both string and AsyncResult object formats
  const downloadId = extractDownloadId(result.downloadId);

  const clientType = result.clientType;

  // Extract mode from result, fallback to payload if not in result
  const mode = extractMode(result, job.payload);

  // Validate required fields
  if (!downloadId || !clientType) {
    logger.warn(`[JobParser] Job ${job.id} missing downloadId or clientType in result`);
    return null;
  }

  // Validate manga ID exists (eliminates non-null assertion)
  let mangaId: number;
  try {
    mangaId = validateMangaId(job.manga_id);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Invalid manga ID';
    logger.warn(`[JobParser] Job ${job.id} has invalid manga_id: ${errorMessage}`);
    return null;
  }

  // Return parsed data with mode only if defined
  if (mode !== undefined) {
    return {
      downloadId,
      clientType,
      mode,
      mangaId
    };
  }

  return {
    downloadId,
    clientType,
    mangaId
  };
}

/**
 * Extract download ID from job result
 *
 * Handles both string and AsyncResult formats.
 * AsyncResult format: { data: "download-id", status: "success" }
 *
 * @param result - Download ID value from job result
 * @returns Download ID string or undefined if invalid
 *
 * @example
 * ```typescript
 * // String format
 * const id1 = extractDownloadId("download-123");
 * // Returns: "download-123"
 *
 * // AsyncResult format
 * const id2 = extractDownloadId({ data: "download-456", status: "success" });
 * // Returns: "download-456"
 *
 * // Invalid
 * const id3 = extractDownloadId(null);
 * // Returns: undefined
 * ```
 */
export function extractDownloadId(result: unknown): string | undefined {
  if (typeof result === 'string') {
    return result;
  }

  if (result && typeof result === 'object' && 'data' in result) {
    const asyncResult = result as { data: unknown };
    if (typeof asyncResult.data === 'string') {
      return asyncResult.data;
    }
  }

  return undefined;
}

/**
 * Extract mode from result or fallback to payload
 *
 * Attempts to extract mode from job result first. If not present,
 * falls back to parsing the job payload.
 *
 * @param result - Parsed job result data
 * @param payload - Raw job payload data
 * @returns Mode string ('PACK' or 'BULK') or undefined
 *
 * @example
 * ```typescript
 * // Mode in result
 * const mode1 = extractMode({ mode: "PACK" }, null);
 * // Returns: "PACK"
 *
 * // Mode in payload (fallback)
 * const mode2 = extractMode({}, '{"mode":"BULK"}');
 * // Returns: "BULK"
 *
 * // No mode
 * const mode3 = extractMode({}, null);
 * // Returns: undefined
 * ```
 */
export function extractMode(result: unknown, payload: unknown): string | undefined {
  // Check if result has mode
  if (result && typeof result === 'object' && 'mode' in result) {
    const resultObj = result as { mode: unknown };
    if (typeof resultObj.mode === 'string') {
      return resultObj.mode;
    }
  }

  // Fallback to payload if mode not in result
  if (payload) {
    const rawPayload = safeParseJson(payload);

    const payloadParse = JobPayloadSchema.safeParse(rawPayload);
    if (payloadParse.success && payloadParse.data.mode) {
      return payloadParse.data.mode;
    }
  }

  return undefined;
}

/**
 * Check if download is PACK mode
 *
 * PACK mode indicates a volume/series bundle download that requires
 * archive extraction. BULK mode indicates individual chapter downloads.
 *
 * @param mode - Download mode string
 * @returns True if mode is 'PACK', false otherwise
 *
 * @example
 * ```typescript
 * const isPack1 = isPackMode("PACK");
 * // Returns: true
 *
 * const isPack2 = isPackMode("BULK");
 * // Returns: false
 *
 * const isPack3 = isPackMode(undefined);
 * // Returns: false
 * ```
 */
export function isPackMode(mode: string | undefined): boolean {
  return mode === 'PACK';
}
