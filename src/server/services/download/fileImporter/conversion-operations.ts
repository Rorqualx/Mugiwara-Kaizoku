/**
 * Conversion Operations Module
 *
 * Format conversion operations for the file importer service.
 * Handles checking conversion requirements and creating conversion jobs.
 */

import * as path from 'path';

import { getGlobalConfigService } from '@/server/services/config/globalConfigService';
import { getConversionService, ConverterFactory } from '@/server/services/conversion';
import type { ConversionFormat } from '@/server/services/conversion/BaseConverter';
import { isSuccess } from '@/utils/async-result';
import { logger } from '@/utils/logger';

const EBOOK_SOURCE_FORMATS = new Set(['mobi', 'azw3']);
const AUDIO_SOURCE_FORMATS = new Set(['mp3', 'm4a', 'm4b', 'aac', 'flac', 'alac', 'wav', 'ogg']);

/**
 * Pick the right target-format config key based on the source category. The settings
 * page exposes three independent target sliders — manga (`downloads.defaultFormat`),
 * ebook (`conversion.defaultEbookFormat`), and audiobook (`conversion.defaultAudiobookFormat`).
 */
function targetKeyFor(normalizedCurrent: string): string {
  if (EBOOK_SOURCE_FORMATS.has(normalizedCurrent)) return 'conversion.defaultEbookFormat';
  if (AUDIO_SOURCE_FORMATS.has(normalizedCurrent)) return 'conversion.defaultAudiobookFormat';
  return 'downloads.defaultFormat';
}

/**
 * Check if file needs format conversion based on user preferences
 *
 * @param currentFormat - Current file format (extension without dot)
 * @returns Object indicating if conversion is needed and target format
 */
export async function shouldConvertFile(currentFormat: string): Promise<{
  shouldConvert: boolean;
  targetFormat?: string;
}> {
  try {
    const configService = getGlobalConfigService();

    const autoConvertEnabled = await configService.get('conversion.autoConvert');
    if (autoConvertEnabled === false || autoConvertEnabled === 'false') {
      logger.debug('[FileImporter] Automatic conversion is disabled, skipping conversion');
      return { shouldConvert: false };
    }

    const normalizedCurrent = currentFormat.toLowerCase().replace('.', '');
    const targetKey = targetKeyFor(normalizedCurrent);
    const defaultFormat = await configService.get(targetKey);

    if (!defaultFormat) {
      logger.debug(`[FileImporter] No target format configured under ${targetKey}, skipping conversion`);
      return { shouldConvert: false };
    }

    const normalizedTarget = (defaultFormat as string).toLowerCase().replace('.', '');

    if (normalizedCurrent === normalizedTarget) {
      return { shouldConvert: false };
    }

    const isSupported = ConverterFactory.isConversionSupported(
      normalizedCurrent as ConversionFormat,
      normalizedTarget as ConversionFormat
    );

    if (!isSupported) {
      logger.debug(`[FileImporter] Conversion from ${normalizedCurrent} to ${normalizedTarget} not supported`);
      return { shouldConvert: false };
    }

    logger.info(`[FileImporter] File conversion needed: ${normalizedCurrent} -> ${normalizedTarget}`);
    return {
      shouldConvert: true,
      targetFormat: normalizedTarget
    };
  } catch (error: unknown) {
    logger.error('[FileImporter] Error checking conversion requirements:', error);
    return { shouldConvert: false };
  }
}

/**
 * Create a conversion job for an imported file
 *
 * @param mangaId - Manga ID
 * @param chapterId - Chapter ID
 * @param sourceFile - Source file path
 * @param sourceFormat - Source format
 * @param targetFormat - Target format
 */
export async function createConversionJob(
  mangaId: number,
  chapterId: number,
  sourceFile: string,
  sourceFormat: string,
  targetFormat: string
): Promise<void> {
  try {
    const conversionService = getConversionService();

    // Generate target file path (same location, different extension)
    const targetFile = sourceFile.replace(
      path.extname(sourceFile),
      `.${targetFormat}`
    );

    logger.info(`[FileImporter] Creating conversion job: ${path.basename(sourceFile)} -> ${path.basename(targetFile)}`);

    type ConversionFormat = 'cbz' | 'cbr' | 'pdf' | 'epub';
    const jobResult = await conversionService.createConversionJob({
      mangaId,
      chapterId,
      sourceFile,
      targetFile,
      sourceFormat: sourceFormat as ConversionFormat,
      targetFormat: targetFormat as ConversionFormat,
      priority: 5, // Default priority
      maxAttempts: 3
    });

    if (isSuccess(jobResult)) {
      logger.info(`[FileImporter] Created conversion job ${jobResult.data} for chapter ${chapterId}`);
    } else {
      if (jobResult.status !== 'error') {
        logger.error(`[FileImporter] Failed to create conversion job: Unexpected status`);
      } else {
        logger.error(`[FileImporter] Failed to create conversion job:`, jobResult.error);
      }
    }
  } catch (error: unknown) {
    logger.error('[FileImporter] Error creating conversion job:', error);
  }
}
