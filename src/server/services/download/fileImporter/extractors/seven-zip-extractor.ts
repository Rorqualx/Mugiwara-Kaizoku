/**
 * 7-Zip Archive Extraction Utility
 *
 * Provides 7z archive extraction using node-7z with 7zip-bin.
 * Supports CB7 (Comic Book 7z) and 7z archive formats.
 *
 * @module seven-zip-extractor
 */

import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import type { AsyncResult } from '@/utils/async-result';
import { createSuccessResult, createErrorResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';

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
  /** File path after extraction */
  filePath: string;
}

/**
 * 7z extraction result
 */
export interface SevenZipExtractionResult {
  /** Array of extracted files */
  files: ExtractedFile[];
  /** Output directory where files were extracted */
  extractDir: string;
  /** Total number of files in archive */
  totalFiles: number;
  /** Number of files extracted (images only) */
  extractedCount: number;
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
 * Get the path to the 7z binary from 7zip-bin
 *
 * @returns Path to 7z binary
 */
async function get7zPath(): Promise<string> {
  try {
    // Dynamically import 7zip-bin to get the platform-specific binary
    const sevenZipBin = await import('7zip-bin');
    return sevenZipBin.path7za;
  } catch (error: unknown) {
    logger.error('[7zExtractor] Failed to load 7zip-bin:', error);
    throw new Error('7zip-bin not available. Install 7zip-bin package.');
  }
}

/**
 * Check if 7z extraction is available
 *
 * @returns AsyncResult with true if 7z is available
 */
export async function is7zAvailable(): Promise<AsyncResult<boolean, Error>> {
  try {
    const sevenZipPath = await get7zPath();
    await fs.access(sevenZipPath, fs.constants.X_OK);
    return createSuccessResult(true);
  } catch {
    return createSuccessResult(false);
  }
}

/**
 * Extract all files from a 7z/CB7 archive to a directory
 *
 * Uses node-7z with 7zip-bin for platform-independent extraction.
 *
 * @param archivePath - Path to the 7z/CB7 archive
 * @param outputDir - Optional output directory (creates temp dir if not provided)
 * @returns AsyncResult with extracted file information
 */
export async function extractFrom7z(
  archivePath: string,
  outputDir?: string
): Promise<AsyncResult<SevenZipExtractionResult, Error>> {
  try {
    // Dynamically import node-7z
    const Seven = await import('node-7z');
    const sevenZipPath = await get7zPath();

    logger.debug(`[7zExtractor] Extracting from: ${archivePath}`);

    // Create output directory if not provided
    const extractDir = outputDir ?? await fs.mkdtemp(path.join(os.tmpdir(), 'mugiwara-7z-'));

    // Ensure output directory exists
    await fs.mkdir(extractDir, { recursive: true });

    // Extract archive using node-7z
    const extractStream = Seven.extractFull(archivePath, extractDir, {
      $bin: sevenZipPath,
      $progress: true,
      recursive: true
    });

    // Wait for extraction to complete
    await new Promise<void>((resolve, reject) => {
      extractStream.on('end', () => resolve());
      extractStream.on('error', (err: Error) => reject(err));
    });

    logger.debug(`[7zExtractor] Extraction complete to: ${extractDir}`);

    // Find all extracted files
    const allFiles = await findFilesRecursive(extractDir);
    const imageFiles = allFiles.filter(f => isImageFile(f));

    // Sort files naturally (page1, page2, page10 order)
    imageFiles.sort((a, b) => a.localeCompare(b, undefined, {
      numeric: true,
      sensitivity: 'base'
    }));

    const files: ExtractedFile[] = imageFiles.map(filePath => ({
      name: path.basename(filePath),
      filePath
    }));

    logger.info(`[7zExtractor] Extracted ${files.length} images from ${allFiles.length} total files`);

    return createSuccessResult({
      files,
      extractDir,
      totalFiles: allFiles.length,
      extractedCount: files.length
    });
  } catch (error: unknown) {
    logger.error('[7zExtractor] Extraction failed:', error);
    return createErrorResult(
      error instanceof Error ? error : new Error(String(error))
    );
  }
}

/**
 * List files in a 7z/CB7 archive without extracting
 *
 * @param archivePath - Path to the 7z/CB7 archive
 * @returns AsyncResult with list of files in archive
 */
export async function list7zContents(
  archivePath: string
): Promise<AsyncResult<string[], Error>> {
  try {
    const Seven = await import('node-7z');
    const sevenZipPath = await get7zPath();

    const files: string[] = [];

    const listStream = Seven.list(archivePath, {
      $bin: sevenZipPath
    });

    // Collect file entries
    listStream.on('data', (data: { file?: string }) => {
      if (data.file && isImageFile(data.file)) {
        files.push(data.file);
      }
    });

    await new Promise<void>((resolve, reject) => {
      listStream.on('end', () => resolve());
      listStream.on('error', (err: Error) => reject(err));
    });

    // Sort naturally
    files.sort((a, b) => a.localeCompare(b, undefined, {
      numeric: true,
      sensitivity: 'base'
    }));

    return createSuccessResult(files);
  } catch (error: unknown) {
    logger.error('[7zExtractor] List failed:', error);
    return createErrorResult(
      error instanceof Error ? error : new Error(String(error))
    );
  }
}

/**
 * Check if a file is a valid 7z/CB7 archive
 *
 * @param archivePath - Path to the file
 * @returns AsyncResult with true if valid 7z archive
 */
export async function isValid7zArchive(
  archivePath: string
): Promise<AsyncResult<boolean, Error>> {
  try {
    const Seven = await import('node-7z');
    const sevenZipPath = await get7zPath();

    // Try to list archive contents - will fail if invalid
    const testStream = Seven.list(archivePath, {
      $bin: sevenZipPath
    });

    await new Promise<void>((resolve, reject) => {
      testStream.on('end', () => resolve());
      testStream.on('error', (err: Error) => reject(err));
    });

    return createSuccessResult(true);
  } catch {
    return createSuccessResult(false);
  }
}

/**
 * Recursively find all files in a directory
 *
 * @param dir - Directory to search
 * @returns Array of file paths
 */
async function findFilesRecursive(dir: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // eslint-disable-next-line no-await-in-loop -- Recursive directory traversal requires sequential processing
      const subFiles = await findFilesRecursive(fullPath);
      files.push(...subFiles);
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}
