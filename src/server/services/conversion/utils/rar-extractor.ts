/**
 * RAR Archive Extraction Utility
 *
 * Provides pure JavaScript RAR extraction using node-unrar-js.
 * Supports CBR (Comic Book RAR) and RAR archive formats.
 *
 * @module rar-extractor
 */

import * as fs from 'fs/promises';
import * as path from 'path';

import type { AsyncResult } from '@/utils/async-result';
import { createSuccessResult, createErrorResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import { bufferToArrayBuffer } from './buffer-utils';

/**
 * Supported image extensions for extraction
 */
const SUPPORTED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'];

/**
 * Extracted file data
 */
export interface ExtractedFile {
  /** Original filename from archive */
  name: string;
  /** File data as Buffer */
  data: Buffer;
}

/**
 * RAR extraction result
 */
export interface RarExtractionResult {
  /** Array of extracted files */
  files: ExtractedFile[];
  /** Total number of files in archive */
  totalFiles: number;
  /** Number of files extracted (images only) */
  extractedCount: number;
  /** Number of files skipped (non-images) */
  skippedCount: number;
}

/**
 * Check if a file extension is a supported image type
 *
 * @param filename - Filename to check
 * @returns True if file is a supported image
 */
function isImageFile(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return SUPPORTED_IMAGE_EXTENSIONS.includes(ext);
}

/**
 * Extract images from a RAR/CBR archive using node-unrar-js
 *
 * Uses createExtractorFromData for in-memory extraction which returns
 * the actual file content (Uint8Array) rather than extracting to disk.
 *
 * @param archivePath - Path to the RAR/CBR archive
 * @returns AsyncResult with extracted image files
 */
export async function extractImagesFromRar(
  archivePath: string
): Promise<AsyncResult<RarExtractionResult, Error>> {
  try {
    // Dynamically import node-unrar-js to avoid bundling issues
    const { createExtractorFromData } = await import('node-unrar-js');

    logger.debug(`[RarExtractor] Extracting images from: ${archivePath}`);

    // Read the archive file into memory
    const archiveData = await fs.readFile(archivePath);

    // Create extractor from data (returns Extractor<Uint8Array> with actual content)
    const extractor = await createExtractorFromData({
      data: bufferToArrayBuffer(archiveData)
    });

    // Get file list first to count total files
    const list = extractor.getFileList();
    const fileHeaders = [...list.fileHeaders];
    const totalFiles = fileHeaders.length;

    // Re-create extractor for extraction (generators are consumed)
    const extractorForExtract = await createExtractorFromData({
      data: bufferToArrayBuffer(archiveData)
    });

    const files: ExtractedFile[] = [];
    let skippedCount = 0;

    // Extract each file
    const extracted = extractorForExtract.extract();

    for (const file of extracted.files) {
      // Skip directories
      if (file.fileHeader.flags.directory) {
        continue;
      }

      const filename = file.fileHeader.name;

      // Skip non-image files
      if (!isImageFile(filename)) {
        logger.debug(`[RarExtractor] Skipping non-image: ${filename}`);
        skippedCount++;
        continue;
      }

      // Get file content (extraction is Uint8Array from createExtractorFromData)
      if (file.extraction) {
        const data = Buffer.from(file.extraction);
        files.push({
          name: filename,
          data
        });
        logger.debug(`[RarExtractor] Extracted: ${filename} (${data.length} bytes)`);
      }
    }

    logger.info(`[RarExtractor] Extraction complete: ${files.length} images from ${totalFiles} total files`);

    return createSuccessResult({
      files,
      totalFiles,
      extractedCount: files.length,
      skippedCount
    });
  } catch (error: unknown) {
    logger.error('[RarExtractor] Extraction failed:', error);
    return createErrorResult(
      error instanceof Error ? error : new Error(String(error))
    );
  }
}

/**
 * Extract a single page from a RAR/CBR archive by index
 *
 * @param archivePath - Path to the RAR/CBR archive
 * @param pageIndex - Zero-based page index
 * @returns AsyncResult with the extracted page data
 */
export async function extractPageFromRar(
  archivePath: string,
  pageIndex: number
): Promise<AsyncResult<ExtractedFile & { totalPages: number }, Error>> {
  try {
    const { createExtractorFromData } = await import('node-unrar-js');

    logger.debug(`[RarExtractor] Extracting page ${pageIndex} from: ${archivePath}`);

    // Read the archive file into memory
    const archiveData = await fs.readFile(archivePath);

    // Create extractor from data
    const extractor = await createExtractorFromData({
      data: bufferToArrayBuffer(archiveData)
    });

    // Get sorted list of image files
    const list = extractor.getFileList();
    const imageFiles = [...list.fileHeaders]
      .filter(h => !h.flags.directory && isImageFile(h.name))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, {
        numeric: true,
        sensitivity: 'base'
      }));

    if (pageIndex < 0 || pageIndex >= imageFiles.length) {
      return createErrorResult(new Error(
        `Page index ${pageIndex} out of range (0-${imageFiles.length - 1})`
      ));
    }

    const targetFile = imageFiles[pageIndex];
    if (!targetFile) {
      return createErrorResult(new Error('Target file not found'));
    }

    // Re-create extractor for extraction (generators are consumed)
    const extractorForExtract = await createExtractorFromData({
      data: bufferToArrayBuffer(archiveData)
    });

    // Extract only the target file
    const extracted = extractorForExtract.extract({ files: [targetFile.name] });

    for (const file of extracted.files) {
      if (file.extraction && file.fileHeader.name === targetFile.name) {
        const data = Buffer.from(file.extraction);
        return createSuccessResult({
          name: file.fileHeader.name,
          data,
          totalPages: imageFiles.length
        });
      }
    }

    return createErrorResult(new Error('Failed to extract target page'));
  } catch (error: unknown) {
    logger.error('[RarExtractor] Page extraction failed:', error);
    return createErrorResult(
      error instanceof Error ? error : new Error(String(error))
    );
  }
}

/**
 * Get the list of image files in a RAR/CBR archive without extracting
 *
 * @param archivePath - Path to the RAR/CBR archive
 * @returns AsyncResult with sorted list of image filenames
 */
export async function listRarImages(
  archivePath: string
): Promise<AsyncResult<string[], Error>> {
  try {
    const { createExtractorFromData } = await import('node-unrar-js');

    // Read the archive file into memory
    const archiveData = await fs.readFile(archivePath);

    const extractor = await createExtractorFromData({
      data: bufferToArrayBuffer(archiveData)
    });
    const list = extractor.getFileList();

    const imageFiles = [...list.fileHeaders]
      .filter(h => !h.flags.directory && isImageFile(h.name))
      .map(h => h.name)
      .sort((a, b) => a.localeCompare(b, undefined, {
        numeric: true,
        sensitivity: 'base'
      }));

    return createSuccessResult(imageFiles);
  } catch (error: unknown) {
    logger.error('[RarExtractor] List failed:', error);
    return createErrorResult(
      error instanceof Error ? error : new Error(String(error))
    );
  }
}

/**
 * Check if a file is a valid RAR/CBR archive
 *
 * @param archivePath - Path to the file
 * @returns AsyncResult with true if valid RAR archive
 */
export async function isValidRarArchive(
  archivePath: string
): Promise<AsyncResult<boolean, Error>> {
  try {
    const { createExtractorFromData } = await import('node-unrar-js');

    // Read the archive file into memory
    const archiveData = await fs.readFile(archivePath);

    // Try to open the archive
    const extractor = await createExtractorFromData({
      data: bufferToArrayBuffer(archiveData)
    });
    extractor.getFileList();

    return createSuccessResult(true);
  } catch {
    return createSuccessResult(false);
  }
}
