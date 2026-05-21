/**
 * Format Availability Checker
 *
 * Provides runtime checks for format extraction capabilities.
 * Used to inform users which formats are available on their system.
 *
 * @module format-checker
 */

import type { AsyncResult } from '@/utils/async-result';
import { createSuccessResult, createErrorResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import { is7zAvailable } from './extractors/seven-zip-extractor';
import { isTarAvailable } from './extractors/tar-extractor';

/**
 * Format availability status
 */
export interface FormatAvailability {
  /** Format extension (without dot) */
  format: string;
  /** Human-readable format name */
  name: string;
  /** Whether extraction is available */
  available: boolean;
  /** Reason if not available */
  reason: string | undefined;
  /** What's needed to enable this format */
  requirement: string | undefined;
}

/**
 * All supported formats with their availability
 */
export interface AllFormatsAvailability {
  /** Comic book formats */
  comic: FormatAvailability[];
  /** eBook formats */
  ebook: FormatAvailability[];
  /** Summary counts */
  summary: {
    totalFormats: number;
    availableFormats: number;
    unavailableFormats: number;
  };
}

/**
 * Check if RAR extraction is available
 *
 * @returns AsyncResult with availability status
 */
async function isRarAvailable(): Promise<AsyncResult<boolean, Error>> {
  try {
    // node-unrar-js is pure JavaScript, should always work
    await import('node-unrar-js');
    return createSuccessResult(true);
  } catch {
    return createSuccessResult(false);
  }
}

/**
 * Check if Kindle format support is available
 *
 * @returns AsyncResult with availability status
 */
async function isKindleAvailable(): Promise<AsyncResult<boolean, Error>> {
  try {
    await import('@lingo-reader/mobi-parser');
    return createSuccessResult(true);
  } catch {
    return createSuccessResult(false);
  }
}

/**
 * Helper to create a FormatAvailability object
 */
function createFormatAvailability(
  format: string,
  name: string,
  available: boolean,
  reason: string | undefined,
  requirement: string | undefined
): FormatAvailability {
  return { format, name, available, reason, requirement };
}

/**
 * Check availability of all supported formats
 *
 * @returns AsyncResult with all format availability information
 */
// eslint-disable-next-line complexity -- Format availability checking across multiple archive types with detailed status reporting
export async function checkAllFormatsAvailability(): Promise<AsyncResult<AllFormatsAvailability, Error>> {
  try {
    // Check all format availabilities in parallel
    const [sevenZip, tar, rar, kindle] = await Promise.all([
      is7zAvailable(),
      isTarAvailable(),
      isRarAvailable(),
      isKindleAvailable()
    ]);

    const is7zOk = sevenZip.status === 'success' && sevenZip.data;
    const isTarOk = tar.status === 'success' && tar.data;
    const isRarOk = rar.status === 'success' && rar.data;
    const isKindleOk = kindle.status === 'success' && kindle.data;

    const comicFormats: FormatAvailability[] = [
      createFormatAvailability('cbz', 'Comic Book ZIP', true, undefined, undefined),
      createFormatAvailability('zip', 'ZIP Archive', true, undefined, undefined),
      createFormatAvailability(
        'cbr',
        'Comic Book RAR',
        isRarOk,
        isRarOk ? undefined : 'node-unrar-js package not available',
        isRarOk ? undefined : 'Install node-unrar-js package'
      ),
      createFormatAvailability(
        'rar',
        'RAR Archive',
        isRarOk,
        isRarOk ? undefined : 'node-unrar-js package not available',
        isRarOk ? undefined : 'Install node-unrar-js package'
      ),
      createFormatAvailability(
        'cb7',
        'Comic Book 7z',
        is7zOk,
        is7zOk ? undefined : '7-Zip binary not available',
        is7zOk ? undefined : 'Install 7zip-bin package'
      ),
      createFormatAvailability(
        '7z',
        '7-Zip Archive',
        is7zOk,
        is7zOk ? undefined : '7-Zip binary not available',
        is7zOk ? undefined : 'Install 7zip-bin package'
      ),
      createFormatAvailability(
        'cbt',
        'Comic Book TAR',
        isTarOk,
        isTarOk ? undefined : 'tar package not available',
        isTarOk ? undefined : 'Install tar package'
      ),
      createFormatAvailability(
        'tar',
        'TAR Archive',
        isTarOk,
        isTarOk ? undefined : 'tar package not available',
        isTarOk ? undefined : 'Install tar package'
      )
    ];

    const ebookFormats: FormatAvailability[] = [
      createFormatAvailability('pdf', 'PDF Document', true, undefined, undefined),
      createFormatAvailability('epub', 'EPUB eBook', true, undefined, undefined),
      createFormatAvailability(
        'mobi',
        'MOBI eBook (Kindle)',
        isKindleOk,
        isKindleOk ? undefined : '@lingo-reader/mobi-parser package not available',
        isKindleOk ? undefined : 'Install @lingo-reader/mobi-parser package'
      ),
      createFormatAvailability(
        'azw3',
        'AZW3 eBook (Kindle)',
        isKindleOk,
        isKindleOk ? undefined : '@lingo-reader/mobi-parser package not available',
        isKindleOk ? undefined : 'Install @lingo-reader/mobi-parser package'
      )
    ];

    const allFormats = [...comicFormats, ...ebookFormats];
    const availableCount = allFormats.filter(f => f.available).length;

    logger.debug('[FormatChecker] Format availability checked', {
      total: allFormats.length,
      available: availableCount,
      unavailable: allFormats.length - availableCount
    });

    return createSuccessResult({
      comic: comicFormats,
      ebook: ebookFormats,
      summary: {
        totalFormats: allFormats.length,
        availableFormats: availableCount,
        unavailableFormats: allFormats.length - availableCount
      }
    });
  } catch (error: unknown) {
    logger.error('[FormatChecker] Failed to check format availability:', error);
    return createErrorResult(
      error instanceof Error ? error : new Error(String(error))
    );
  }
}

/**
 * Check if a specific format is available for extraction
 *
 * @param format - Format extension (with or without dot)
 * @returns AsyncResult with availability status
 */
export async function isFormatAvailable(format: string): Promise<AsyncResult<FormatAvailability, Error>> {
  const normalizedFormat = format.startsWith('.') ? format.slice(1).toLowerCase() : format.toLowerCase();

  try {
    const allFormats = await checkAllFormatsAvailability();

    if (allFormats.status !== 'success') {
      return createErrorResult(allFormats.status === 'error' ? allFormats.error : new Error('Unexpected status'));
    }

    const allFormatsList = [...allFormats.data.comic, ...allFormats.data.ebook];
    const found = allFormatsList.find(f => f.format === normalizedFormat);

    if (!found) {
      return createSuccessResult(createFormatAvailability(
        normalizedFormat,
        `Unknown (${normalizedFormat})`,
        false,
        'Format not supported',
        'This format is not supported by the application'
      ));
    }

    return createSuccessResult(found);
  } catch (error: unknown) {
    logger.error('[FormatChecker] Failed to check format:', error);
    return createErrorResult(
      error instanceof Error ? error : new Error(String(error))
    );
  }
}

/**
 * Get a list of all available formats (formats that can be extracted)
 *
 * @returns AsyncResult with array of available format extensions
 */
export async function getAvailableFormats(): Promise<AsyncResult<string[], Error>> {
  try {
    const allFormats = await checkAllFormatsAvailability();

    if (allFormats.status !== 'success') {
      return createErrorResult(allFormats.status === 'error' ? allFormats.error : new Error('Unexpected status'));
    }

    const available = [...allFormats.data.comic, ...allFormats.data.ebook]
      .filter(f => f.available)
      .map(f => f.format);

    return createSuccessResult(available);
  } catch (error: unknown) {
    return createErrorResult(
      error instanceof Error ? error : new Error(String(error))
    );
  }
}
