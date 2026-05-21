/**
 * TAR Archive Extraction Utility
 *
 * Provides TAR archive extraction using the Node.js tar package.
 * Supports CBT (Comic Book TAR) and TAR archive formats.
 *
 * @module tar-extractor
 */

import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import type { AsyncResult } from '@/utils/async-result';
import { createSuccessResult, createErrorResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import type { ReadEntry } from 'tar';

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
 * TAR extraction result
 */
export interface TarExtractionResult {
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
 * Check if TAR extraction is available (always true, uses Node.js built-in)
 *
 * @returns AsyncResult with true
 */
export async function isTarAvailable(): Promise<AsyncResult<boolean, Error>> {
  try {
    // TAR package should always be available since it's a dependency
    await import('tar');
    return createSuccessResult(true);
  } catch {
    return createSuccessResult(false);
  }
}

/**
 * Extract all files from a TAR/CBT archive to a directory
 *
 * @param archivePath - Path to the TAR/CBT archive
 * @param outputDir - Optional output directory (creates temp dir if not provided)
 * @returns AsyncResult with extracted file information
 */
export async function extractFromTar(
  archivePath: string,
  outputDir?: string
): Promise<AsyncResult<TarExtractionResult, Error>> {
  try {
    // Dynamically import tar
    const tar = await import('tar');

    logger.debug(`[TarExtractor] Extracting from: ${archivePath}`);

    // Create output directory if not provided
    const extractDir = outputDir ?? await fs.mkdtemp(path.join(os.tmpdir(), 'mugiwara-tar-'));

    // Ensure output directory exists
    await fs.mkdir(extractDir, { recursive: true });

    // Extract archive using tar
    await tar.extract({
      file: archivePath,
      cwd: extractDir,
      strict: true
    });

    logger.debug(`[TarExtractor] Extraction complete to: ${extractDir}`);

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

    logger.info(`[TarExtractor] Extracted ${files.length} images from ${allFiles.length} total files`);

    return createSuccessResult({
      files,
      extractDir,
      totalFiles: allFiles.length,
      extractedCount: files.length
    });
  } catch (error: unknown) {
    logger.error('[TarExtractor] Extraction failed:', error);
    return createErrorResult(
      error instanceof Error ? error : new Error(String(error))
    );
  }
}

/**
 * List files in a TAR/CBT archive without extracting
 *
 * @param archivePath - Path to the TAR/CBT archive
 * @returns AsyncResult with list of files in archive
 */
export async function listTarContents(
  archivePath: string
): Promise<AsyncResult<string[], Error>> {
  try {
    const tar = await import('tar');

    const files: string[] = [];

    // List entries in the archive
    await tar.list({
      file: archivePath,
      onReadEntry: (entry: ReadEntry) => {
        if (entry.type === 'File' && isImageFile(entry.path)) {
          files.push(entry.path);
        }
      }
    });

    // Sort naturally
    files.sort((a, b) => a.localeCompare(b, undefined, {
      numeric: true,
      sensitivity: 'base'
    }));

    return createSuccessResult(files);
  } catch (error: unknown) {
    logger.error('[TarExtractor] List failed:', error);
    return createErrorResult(
      error instanceof Error ? error : new Error(String(error))
    );
  }
}

/**
 * Check if a file is a valid TAR/CBT archive
 *
 * @param archivePath - Path to the file
 * @returns AsyncResult with true if valid TAR archive
 */
export async function isValidTarArchive(
  archivePath: string
): Promise<AsyncResult<boolean, Error>> {
  try {
    const tar = await import('tar');

    // Try to list archive contents - will fail if invalid
    let hasEntries = false;
    await tar.list({
      file: archivePath,
      onReadEntry: () => {
        hasEntries = true;
      }
    });

    return createSuccessResult(hasEntries);
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
