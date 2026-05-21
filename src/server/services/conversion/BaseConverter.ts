/**
 * Base Converter Abstract Class
 *
 * Provides the foundation for all format converters in the system.
 * Implements common functionality like validation, error handling, and progress tracking.
 *
 * @module BaseConverter
 */

import * as fs from 'fs/promises';
import * as path from 'path';

import { z } from 'zod';

import type { AsyncResult } from '@/utils/async-result';
import { createSuccessResult, createErrorResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';

/**
 * Supported conversion formats — single source of truth. The Zod schema is exported
 * so the tRPC router validates against the same closed enum the converters declare.
 */
export const conversionFormatSchema = z.enum([
  'cbz', 'pdf', 'epub', 'cbr', 'zip', '7z', 'cb7', 'tar', 'cbt',
  'mobi', 'azw3',
  'mp3', 'm4a', 'm4b', 'aac', 'flac', 'alac', 'wav', 'ogg'
]);
export type ConversionFormat = z.infer<typeof conversionFormatSchema>;

/**
 * Conversion options passed to converters
 */
export interface ConversionOptions {
  /** Source file path */
  sourceFile: string;
  /** Target file path */
  targetFile: string;
  /** Source format */
  sourceFormat: ConversionFormat;
  /** Target format */
  targetFormat: ConversionFormat;
  /** Quality setting (1-100) */
  quality?: number;
  /** Compression level (0-9) */
  compression?: number;
  /** Explicit audio bitrate (e.g. "192k") for AudiobookConverter — wins over quality→bitrate mapping. */
  bitrate?: string;
  /** Progress callback */
  onProgress?: (progress: number) => void;
  /** Additional metadata to embed */
  metadata?: Record<string, unknown>;
  /** Timeout in milliseconds (default: 10 minutes) */
  timeout?: number;
}

/**
 * Conversion result data
 */
export interface ConversionResult {
  /** Path to converted file */
  outputPath: string;
  /** Size of output file in bytes */
  fileSize: number;
  /** Number of pages/images converted */
  pageCount: number;
  /** Conversion duration in milliseconds */
  duration: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * File validation result
 */
export interface ValidationResult {
  /** Whether the file is valid */
  isValid: boolean;
  /** Validation error message if invalid */
  error?: string;
  /** Detected file format */
  detectedFormat?: ConversionFormat;
  /** File size in bytes */
  fileSize?: number;
  /** Number of pages/images */
  pageCount?: number;
}

/** Maximum allowed source file size for conversion (500 MB) */
const MAX_CONVERSION_FILE_SIZE = 500 * 1024 * 1024;

/** Default conversion timeout (10 minutes) */
const DEFAULT_CONVERSION_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * Format alias map — comic book extensions are aliases for their underlying archive types.
 * Used by validate() to avoid false "format mismatch" rejections.
 */
const FORMAT_ALIASES: Record<string, string[]> = {
  cbz: ['zip'],
  zip: ['cbz'],
  cbr: ['rar'],
  rar: ['cbr'],
  cb7: ['7z'],
  '7z': ['cb7'],
  cbt: ['tar'],
  tar: ['cbt'],
};

/**
 * Check if two format strings are compatible (equal or aliases).
 */
function areFormatsCompatible(a: string, b: string): boolean {
  if (a === b) return true;
  return FORMAT_ALIASES[a]?.includes(b) ?? false;
}

/**
 * Abstract base class for all format converters
 *
 * Provides common functionality and enforces implementation of conversion logic.
 * All concrete converters must extend this class and implement the abstract methods.
 *
 * @abstract
 */
export abstract class BaseConverter {
  /** Converter name for logging */
  protected readonly converterName: string;

  /**
   * Create a new converter instance
   *
   * @param converterName - Name of the converter for logging
   */
  constructor(converterName: string) {
    this.converterName = converterName;
  }

  /**
   * Get the list of formats this converter supports as source
   *
   * @returns Array of supported source formats
   */
  abstract getSupportedSourceFormats(): ConversionFormat[];

  /**
   * Get the list of formats this converter can convert to
   *
   * @returns Array of supported target formats
   */
  abstract getSupportedTargetFormats(): ConversionFormat[];

  /**
   * Perform the actual conversion
   *
   * Must be implemented by concrete converter classes.
   * Should handle all conversion logic and error cases.
   *
   * @param options - Conversion options
   * @returns AsyncResult with conversion result or error
   */
  protected abstract doConvert(options: ConversionOptions): Promise<AsyncResult<ConversionResult, Error>>;

  /**
   * Validate the source file
   *
   * Checks if the file exists, is readable, and matches the expected format.
   * Can be overridden by concrete converters for format-specific validation.
   *
   * @param filePath - Path to file to validate
   * @param expectedFormat - Expected file format
   * @returns AsyncResult with validation result
   */
  async validate(filePath: string, expectedFormat: ConversionFormat): Promise<AsyncResult<ValidationResult, Error>> {
    try {
      // Check if file exists
      try {
        await fs.access(filePath, fs.constants.R_OK);
      } catch (_error: unknown) {
        return createSuccessResult({
          isValid: false,
          error: 'File does not exist or is not readable'
        });
      }

      // Get file stats
      const stats = await fs.stat(filePath);
      if (!stats.isFile()) {
        return createSuccessResult({
          isValid: false,
          error: 'Path is not a file'
        });
      }

      // Check file size
      if (stats.size === 0) {
        return createSuccessResult({
          isValid: false,
          error: 'File is empty'
        });
      }

      // Reject files exceeding size limit
      if (stats.size > MAX_CONVERSION_FILE_SIZE) {
        const sizeMB = (stats.size / (1024 * 1024)).toFixed(1);
        const limitMB = MAX_CONVERSION_FILE_SIZE / (1024 * 1024);
        return createSuccessResult({
          isValid: false,
          error: `File too large for conversion: ${sizeMB}MB exceeds ${limitMB}MB limit`,
          fileSize: stats.size
        });
      }

      // Detect format from extension
      const ext = path.extname(filePath).toLowerCase().slice(1);
      const detectedFormat = ext as ConversionFormat;

      // Verify format matches expected (allowing aliases like cbr↔rar)
      if (!areFormatsCompatible(detectedFormat, expectedFormat)) {
        return createSuccessResult({
          isValid: false,
          error: `Format mismatch: expected ${expectedFormat}, detected ${detectedFormat}`,
          detectedFormat
        });
      }

      // File is valid
      return createSuccessResult({
        isValid: true,
        detectedFormat,
        fileSize: stats.size
      });
    } catch (error: unknown) {
      return createErrorResult(
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Check if this converter can handle a specific conversion
   *
   * @param sourceFormat - Source file format
   * @param targetFormat - Target file format
   * @returns True if converter supports this conversion
   */
  canConvert(sourceFormat: ConversionFormat, targetFormat: ConversionFormat): boolean {
    const supportedSources = this.getSupportedSourceFormats();
    const supportedTargets = this.getSupportedTargetFormats();

    return (
      supportedSources.includes(sourceFormat) &&
      supportedTargets.includes(targetFormat)
    );
  }

  /**
   * Perform the conversion with validation and error handling
   *
   * This is the main public method that should be called to perform conversions.
   * It handles validation, logging, progress tracking, and error handling.
   *
   * @param options - Conversion options
   * @returns AsyncResult with conversion result or error
   */
  async convert(options: ConversionOptions): Promise<AsyncResult<ConversionResult, Error>> {
    const startTime = Date.now();

    logger.info(`[${this.converterName}] Starting conversion`, {
      sourceFile: options.sourceFile,
      targetFile: options.targetFile,
      sourceFormat: options.sourceFormat,
      targetFormat: options.targetFormat
    });

    try {
      // Validate conversion is supported
      if (!this.canConvert(options.sourceFormat, options.targetFormat)) {
        const error = new Error(
          `Conversion from ${options.sourceFormat} to ${options.targetFormat} is not supported by ${this.converterName}`
        );
        logger.error(`[${this.converterName}] Unsupported conversion`, error);
        return createErrorResult(error);
      }

      // Validate source file
      const validationResult = await this.validate(options.sourceFile, options.sourceFormat);
      if (validationResult.status === 'error') {
        logger.error(`[${this.converterName}] Validation error`, validationResult.error);
        return createErrorResult(validationResult.error);
      }

      if (validationResult.status !== 'success') {
        const error = new Error('Validation returned unexpected status');
        logger.error(`[${this.converterName}] Validation status error`, error);
        return createErrorResult(error);
      }

      const validation = validationResult.data;
      if (!validation.isValid) {
        const error = new Error(`Source file validation failed: ${validation.error ?? 'Unknown error'}`);
        logger.error(`[${this.converterName}] Invalid source file`, error);
        return createErrorResult(error);
      }

      // Ensure target directory exists
      const targetDir = path.dirname(options.targetFile);
      await fs.mkdir(targetDir, { recursive: true });

      // Perform the conversion with timeout protection
      logger.debug(`[${this.converterName}] Calling doConvert`);
      const timeout = options.timeout ?? DEFAULT_CONVERSION_TIMEOUT_MS;
      const timeoutPromise = new Promise<AsyncResult<ConversionResult, Error>>((resolve) => {
        const timer = setTimeout(() => {
          resolve(createErrorResult(
            new Error(`Conversion timed out after ${Math.round(timeout / 1000)}s`)
          ));
        }, timeout);
        // Allow Node.js to exit if this is the only timer keeping it alive
        if (typeof timer === 'object' && 'unref' in timer) timer.unref();
      });

      const result = await Promise.race([this.doConvert(options), timeoutPromise]);

      if (result.status === 'error') {
        logger.error(`[${this.converterName}] Conversion failed`, result.error);
        return result;
      }

      if (result.status !== 'success') {
        const error = new Error('Conversion returned unexpected status');
        logger.error(`[${this.converterName}] Conversion status error`, error);
        return createErrorResult(error);
      }

      const duration = Date.now() - startTime;
      logger.info(`[${this.converterName}] Conversion completed successfully`, {
        outputPath: result.data.outputPath,
        fileSize: result.data.fileSize,
        pageCount: result.data.pageCount,
        duration: `${duration}ms`
      });

      // Add duration to result
      return createSuccessResult({
        ...result.data,
        duration
      });
    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      const convertError = error instanceof Error ? error : new Error(String(error));

      logger.error(`[${this.converterName}] Conversion error after ${duration}ms`, convertError);

      return createErrorResult(convertError);
    }
  }

  /**
   * Report progress to callback if provided
   *
   * @param options - Conversion options containing progress callback
   * @param progress - Progress value (0-100)
   */
  protected reportProgress(options: ConversionOptions, progress: number): void {
    if (options.onProgress) {
      try {
        options.onProgress(Math.min(100, Math.max(0, progress)));
      } catch (error: unknown) {
        logger.warn(`[${this.converterName}] Progress callback error`, error);
      }
    }
  }

  /**
   * Get converter name
   *
   * @returns Converter name
   */
  getName(): string {
    return this.converterName;
  }
}
