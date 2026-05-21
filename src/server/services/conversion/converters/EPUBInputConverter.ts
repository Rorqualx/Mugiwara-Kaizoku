/**
 * EPUB Input Converter
 *
 * Handles conversion FROM EPUB format to CBZ.
 * Extracts images from EPUB files for conversion to comic book format.
 *
 * Supported conversions:
 * - EPUB → CBZ
 *
 * @module EPUBInputConverter
 */

import * as fs from 'fs/promises';

import type { AsyncResult } from '@/utils/async-result';
import { createSuccessResult, createErrorResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import { BaseConverter } from '../BaseConverter';
import { createCBZArchive } from '../utils/cbz-builder';
import { extractImagesFromEpub } from '../utils/epub-extractor';

import type { ConversionOptions, ConversionResult, ConversionFormat } from '../BaseConverter';

/**
 * EPUB Input Converter Implementation
 *
 * Converts EPUB files to CBZ format by extracting embedded images.
 * Preserves reading order from EPUB spine when available.
 *
 * @extends BaseConverter
 */
export class EPUBInputConverter extends BaseConverter {
  constructor() {
    super('EPUBInputConverter');
  }

  /**
   * Get supported source formats
   *
   * @returns Array of source formats (epub only)
   */
  getSupportedSourceFormats(): ConversionFormat[] {
    return ['epub'];
  }

  /**
   * Get supported target formats
   *
   * @returns Array of target formats (cbz only)
   */
  getSupportedTargetFormats(): ConversionFormat[] {
    return ['cbz'];
  }

  /**
   * Perform the conversion from EPUB to CBZ
   *
   * @param options - Conversion options
   * @returns AsyncResult with conversion result
   */
  protected async doConvert(options: ConversionOptions): Promise<AsyncResult<ConversionResult, Error>> {
    const startTime = Date.now();

    try {
      logger.info(`[${this.converterName}] Starting EPUB to CBZ conversion`, {
        sourceFile: options.sourceFile,
        targetFile: options.targetFile
      });

      this.reportProgress(options, 0);

      // Step 1: Extract images from EPUB (10-60% progress)
      logger.debug(`[${this.converterName}] Extracting images from EPUB`);

      const extractResult = await extractImagesFromEpub(options.sourceFile);

      if (extractResult.status === 'error') {
        return createErrorResult(extractResult.error);
      }

      if (extractResult.status !== 'success') {
        return createErrorResult(new Error('Unexpected extraction status'));
      }

      const images = extractResult.data.files;
      const epubMetadata = extractResult.data.metadata;

      logger.info(`[${this.converterName}] Extracted ${images.length} images from EPUB`);
      this.reportProgress(options, 60);

      if (images.length === 0) {
        return createErrorResult(new Error('No images found in EPUB'));
      }

      // Step 2: Create CBZ archive (60-90% progress)
      logger.debug(`[${this.converterName}] Creating CBZ archive`);

      const createResult = await createCBZArchive(
        images,
        options.targetFile,
        options.compression ?? 6,
        (progress) => {
          const mappedProgress = 60 + (progress * 0.3);
          this.reportProgress(options, mappedProgress);
        }
      );

      if (createResult.status === 'error') {
        return createErrorResult(createResult.error);
      }

      this.reportProgress(options, 90);

      // Step 3: Get output file stats
      const stats = await fs.stat(options.targetFile);
      const duration = Date.now() - startTime;

      this.reportProgress(options, 100);

      const result: ConversionResult = {
        outputPath: options.targetFile,
        fileSize: stats.size,
        pageCount: images.length,
        duration,
        metadata: {
          sourceFormat: 'epub',
          targetFormat: 'cbz',
          pageCount: images.length,
          title: epubMetadata?.title,
          author: epubMetadata?.author
        }
      };

      logger.info(`[${this.converterName}] Conversion completed`, {
        outputPath: result.outputPath,
        fileSize: result.fileSize,
        pageCount: result.pageCount,
        duration: `${duration}ms`
      });

      return createSuccessResult(result);
    } catch (error: unknown) {
      logger.error(`[${this.converterName}] Conversion error`, error);
      return createErrorResult(
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

}
