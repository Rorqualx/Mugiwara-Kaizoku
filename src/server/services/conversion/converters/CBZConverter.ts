/**
 * CBZ Converter
 *
 * Handles conversion to and from CBZ (Comic Book ZIP) format.
 * CBZ is essentially a ZIP archive containing images in reading order.
 *
 * Supported conversions:
 * - ZIP/CBZ → CBZ (repackaging)
 * - CBR/RAR → CBZ (format conversion)
 * - Extract images from CBZ for conversion to other formats
 *
 * @module CBZConverter
 */

import * as fs from 'fs/promises';
import * as path from 'path';

import JSZip from 'jszip';

import type { AsyncResult } from '@/utils/async-result';
import { createSuccessResult, createErrorResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import { BaseConverter } from '../BaseConverter';
import { createCBZArchive } from '../utils/cbz-builder';
import { extractImagesFromRar } from '../utils/rar-extractor';
import { extractImagesFrom7z } from '../utils/seven-zip-wrapper';
import { extractImagesFromTar } from '../utils/tar-wrapper';

import type { ConversionOptions, ConversionResult, ConversionFormat } from '../BaseConverter';



/**
 * Supported image extensions for manga
 */
const SUPPORTED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'];

/**
 * CBZ Converter Implementation
 *
 * Converts manga files to CBZ format and extracts images from CBZ archives.
 * Handles image sorting, validation, and compression.
 *
 * @extends BaseConverter
 */
export class CBZConverter extends BaseConverter {
  constructor() {
    super('CBZConverter');
  }

  /**
   * Get supported source formats
   *
   * @returns Array of source formats (zip, cbz, cbr)
   */
  getSupportedSourceFormats(): ConversionFormat[] {
    return ['zip', 'cbz', 'cbr', '7z', 'cb7', 'tar', 'cbt'];
  }

  /**
   * Get supported target formats
   *
   * @returns Array of target formats (cbz)
   */
  getSupportedTargetFormats(): ConversionFormat[] {
    return ['cbz'];
  }

  /**
   * Perform the CBZ conversion
   *
   * @param options - Conversion options
   * @returns AsyncResult with conversion result
   */
  protected async doConvert(options: ConversionOptions): Promise<AsyncResult<ConversionResult, Error>> {
    const startTime = Date.now();

    try {
      logger.info(`[${this.converterName}] Starting CBZ conversion`, {
        sourceFile: options.sourceFile,
        targetFile: options.targetFile
      });

      // Report initial progress
      this.reportProgress(options, 0);

      // Step 1: Extract images from source archive (10% progress)
      logger.debug(`[${this.converterName}] Extracting images from source`);
      const extractResult = await this.extractImages(options.sourceFile);

      if (extractResult.status === 'error') {
        return createErrorResult(extractResult.error);
      }

      if (extractResult.status !== 'success') {
        return createErrorResult(new Error('Unexpected extraction status'));
      }

      const images = extractResult.data;
      logger.info(`[${this.converterName}] Extracted ${images.length} images`);
      this.reportProgress(options, 10);

      if (images.length === 0) {
        return createErrorResult(new Error('No images found in source archive'));
      }

      // Step 2: Sort images by filename (natural order)
      const sortedImages = this.sortImagesByName(images);
      this.reportProgress(options, 20);

      // Step 3: Create CBZ archive (20-90% progress)
      logger.debug(`[${this.converterName}] Creating CBZ archive`);
      const createResult = await createCBZArchive(
        sortedImages,
        options.targetFile,
        options.compression ?? 6,
        (progress) => {
          // Map 0-100 to 20-90 range
          const mappedProgress = 20 + (progress * 0.7);
          this.reportProgress(options, mappedProgress);
        }
      );

      if (createResult.status === 'error') {
        return createErrorResult(createResult.error);
      }

      this.reportProgress(options, 90);

      // Step 4: Get output file stats
      const stats = await fs.stat(options.targetFile);
      const duration = Date.now() - startTime;

      this.reportProgress(options, 100);

      const result: ConversionResult = {
        outputPath: options.targetFile,
        fileSize: stats.size,
        pageCount: images.length,
        duration,
        metadata: {
          compression: options.compression ?? 6,
          imageCount: images.length
        }
      };

      logger.info(`[${this.converterName}] CBZ conversion completed`, {
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

  /**
   * Extract images from a ZIP/CBZ/CBR archive
   *
   * Automatically detects archive type and uses appropriate extractor:
   * - ZIP/CBZ: Uses JSZip
   * - RAR/CBR: Uses node-unrar-js
   *
   * @param archivePath - Path to archive file
   * @returns AsyncResult with array of image buffers and filenames
   */
  private async extractImages(
    archivePath: string
  ): Promise<AsyncResult<Array<{ name: string; data: Buffer }>, Error>> {
    const ext = path.extname(archivePath).toLowerCase();

    // Use RAR extractor for CBR/RAR files
    if (ext === '.cbr' || ext === '.rar') {
      return this.extractImagesFromRar(archivePath);
    }

    // Use 7z extractor for CB7/7z files
    if (ext === '.cb7' || ext === '.7z') {
      return this.extractImagesFrom7zArchive(archivePath);
    }

    // Use TAR extractor for CBT/TAR files
    if (ext === '.cbt' || ext === '.tar') {
      return this.extractImagesFromTarArchive(archivePath);
    }

    // Use ZIP extractor for CBZ/ZIP files
    return this.extractImagesFromZip(archivePath);
  }

  /**
   * Extract images from a RAR/CBR archive using node-unrar-js
   *
   * @param archivePath - Path to RAR/CBR archive
   * @returns AsyncResult with array of image buffers and filenames
   */
  private async extractImagesFromRar(
    archivePath: string
  ): Promise<AsyncResult<Array<{ name: string; data: Buffer }>, Error>> {
    try {
      logger.debug(`[${this.converterName}] Extracting from RAR/CBR: ${archivePath}`);

      const result = await extractImagesFromRar(archivePath);

      if (result.status === 'error') {
        return createErrorResult(result.error);
      }

      if (result.status !== 'success') {
        return createErrorResult(new Error('Unexpected RAR extraction status'));
      }

      logger.info(`[${this.converterName}] RAR extraction complete: ${result.data.extractedCount} images`);

      return createSuccessResult(result.data.files);
    } catch (error: unknown) {
      logger.error(`[${this.converterName}] Failed to extract from RAR`, error);
      return createErrorResult(
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Extract images from a 7z/CB7 archive
   */
  private async extractImagesFrom7zArchive(
    archivePath: string
  ): Promise<AsyncResult<Array<{ name: string; data: Buffer }>, Error>> {
    try {
      logger.debug(`[${this.converterName}] Extracting from 7z/CB7: ${archivePath}`);
      const result = await extractImagesFrom7z(archivePath);

      if (result.status === 'error') return createErrorResult(result.error);
      if (result.status !== 'success') return createErrorResult(new Error('Unexpected 7z extraction status'));

      logger.info(`[${this.converterName}] 7z extraction complete: ${result.data.extractedCount} images`);
      return createSuccessResult(result.data.files);
    } catch (error: unknown) {
      logger.error(`[${this.converterName}] Failed to extract from 7z`, error);
      return createErrorResult(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Extract images from a TAR/CBT archive
   */
  private async extractImagesFromTarArchive(
    archivePath: string
  ): Promise<AsyncResult<Array<{ name: string; data: Buffer }>, Error>> {
    try {
      logger.debug(`[${this.converterName}] Extracting from TAR/CBT: ${archivePath}`);
      const result = await extractImagesFromTar(archivePath);

      if (result.status === 'error') return createErrorResult(result.error);
      if (result.status !== 'success') return createErrorResult(new Error('Unexpected TAR extraction status'));

      logger.info(`[${this.converterName}] TAR extraction complete: ${result.data.extractedCount} images`);
      return createSuccessResult(result.data.files);
    } catch (error: unknown) {
      logger.error(`[${this.converterName}] Failed to extract from TAR`, error);
      return createErrorResult(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Extract images from a ZIP/CBZ archive using JSZip
   *
   * @param archivePath - Path to ZIP/CBZ archive
   * @returns AsyncResult with array of image buffers and filenames
   */
  private async extractImagesFromZip(
    archivePath: string
  ): Promise<AsyncResult<Array<{ name: string; data: Buffer }>, Error>> {
    try {
      // Read archive file
      const archiveData = await fs.readFile(archivePath);

      // Load archive with JSZip
      const zip = new JSZip();
      const zipContent = await zip.loadAsync(archiveData);

      // Extract all image files
      const imageFiles = Object.entries(zipContent.files).filter(([filename, file]) => {
        // Skip directories
        if (file.dir) return false;

        // Skip non-image files
        const ext = path.extname(filename).toLowerCase();
        if (!SUPPORTED_IMAGE_EXTENSIONS.includes(ext)) {
          logger.debug(`[${this.converterName}] Skipping non-image file: ${filename}`);
          return false;
        }

        return true;
      });

      // Extract all images in parallel
      const images = await Promise.all(
        imageFiles.map(async ([filename, file]) => {
          const imageData = await file.async('nodebuffer');
          logger.debug(`[${this.converterName}] Extracted image: ${filename} (${imageData.length} bytes)`);
          return {
            name: filename,
            data: imageData
          };
        })
      );

      return createSuccessResult(images);
    } catch (error: unknown) {
      logger.error(`[${this.converterName}] Failed to extract images`, error);
      return createErrorResult(
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Sort images by filename using natural sort order
   *
   * Handles numeric sequences properly (e.g., page1, page2, page10)
   *
   * @param images - Array of images to sort
   * @returns Sorted array of images
   */
  private sortImagesByName(
    images: Array<{ name: string; data: Buffer }>
  ): Array<{ name: string; data: Buffer }> {
    return images.sort((a, b) => {
      return a.name.localeCompare(b.name, undefined, {
        numeric: true,
        sensitivity: 'base'
      });
    });
  }

  /**
   * Get a list of image files from a directory
   *
   * Useful for converting a directory of images to CBZ.
   *
   * @param dirPath - Directory path
   * @returns AsyncResult with array of image file paths
   */
  async getImagesFromDirectory(dirPath: string): Promise<AsyncResult<string[], Error>> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      const imageFiles: string[] = [];

      for (const entry of entries) {
        if (!entry.isFile()) continue;

        const ext = path.extname(entry.name).toLowerCase();
        if (SUPPORTED_IMAGE_EXTENSIONS.includes(ext)) {
          imageFiles.push(path.join(dirPath, entry.name));
        }
      }

      // Sort naturally
      imageFiles.sort((a, b) => {
        return path.basename(a).localeCompare(path.basename(b), undefined, {
          numeric: true,
          sensitivity: 'base'
        });
      });

      return createSuccessResult(imageFiles);
    } catch (error: unknown) {
      logger.error(`[${this.converterName}] Failed to read directory`, error);
      return createErrorResult(
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Create CBZ from a directory of images
   *
   * @param dirPath - Directory containing images
   * @param outputPath - Output CBZ file path
   * @param compressionLevel - ZIP compression level (0-9)
   * @returns AsyncResult with conversion result
   */
  async createCBZFromDirectory(
    dirPath: string,
    outputPath: string,
    compressionLevel: number = 6
  ): Promise<AsyncResult<ConversionResult, Error>> {
    const startTime = Date.now();

    try {
      // Get image files
      const imageFilesResult = await this.getImagesFromDirectory(dirPath);

      if (imageFilesResult.status === 'error') {
        return createErrorResult(imageFilesResult.error);
      }

      if (imageFilesResult.status !== 'success') {
        return createErrorResult(new Error('Unexpected image files result status'));
      }

      const imageFiles = imageFilesResult.data;

      if (imageFiles.length === 0) {
        return createErrorResult(new Error('No images found in directory'));
      }

      // Read all images in parallel
      const images = await Promise.all(
        imageFiles.map(async (filePath) => {
          const data = await fs.readFile(filePath);
          return {
            name: path.basename(filePath),
            data
          };
        })
      );

      // Create CBZ
      const createResult = await createCBZArchive(images, outputPath, compressionLevel);

      if (createResult.status === 'error') {
        return createErrorResult(createResult.error);
      }

      // Get stats
      const stats = await fs.stat(outputPath);
      const duration = Date.now() - startTime;

      return createSuccessResult({
        outputPath,
        fileSize: stats.size,
        pageCount: images.length,
        duration,
        metadata: {
          compression: compressionLevel,
          sourceDirectory: dirPath
        }
      });
    } catch (error: unknown) {
      logger.error(`[${this.converterName}] Failed to create CBZ from directory`, error);
      return createErrorResult(
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }
}
