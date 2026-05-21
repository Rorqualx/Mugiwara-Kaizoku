/**
 * Archive Operations Module
 *
 * Archive extraction operations for the file importer service.
 * Supports multiple archive formats: ZIP, CBZ, RAR, CBR, 7z, CB7, TAR, CBT.
 */

import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import AdmZip from 'adm-zip';

import { extractImagesFromRar } from '@/server/services/conversion/utils/rar-extractor';
import { logger } from '@/utils/logger';

import { extractFrom7z, is7zAvailable } from './extractors/seven-zip-extractor';
import { extractFromTar } from './extractors/tar-extractor';
import { findMangaFiles } from './file-operations';

/**
 * Supported archive formats
 */
export type ArchiveFormat = 'zip' | 'cbz' | 'rar' | 'cbr' | '7z' | 'cb7' | 'tar' | 'cbt';

/**
 * Check if a file extension is a supported archive format
 *
 * @param ext - File extension (with or without dot)
 * @returns True if supported
 */
export function isSupportedArchiveFormat(ext: string): boolean {
  const normalizedExt = ext.startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`;
  return ['.zip', '.cbz', '.rar', '.cbr', '.7z', '.cb7', '.tar', '.cbt'].includes(normalizedExt);
}

/**
 * Extract a ZIP/CBZ archive to a directory
 *
 * @param archivePath - Path to archive
 * @param outputDir - Output directory
 * @returns Array of extracted file paths
 */
async function extractZipArchive(archivePath: string, outputDir: string): Promise<string[]> {
  const zip = new AdmZip(archivePath);
  zip.extractAllTo(outputDir, true);

  // Find all files in extracted directory
  return findFilesRecursive(outputDir);
}

/**
 * Extract a RAR/CBR archive to a directory
 *
 * @param archivePath - Path to archive
 * @param outputDir - Output directory
 * @returns Array of extracted file paths
 */
async function extractRarArchive(archivePath: string, outputDir: string): Promise<string[]> {
  const result = await extractImagesFromRar(archivePath);

  if (result.status !== 'success') {
    throw result.status === 'error' ? result.error : new Error('Unexpected result status');
  }

  // Write extracted files to output directory
  const extractedPaths: string[] = [];
  for (const file of result.data.files) {
    const outputPath = path.join(outputDir, file.name);

    // Ensure parent directory exists
    // eslint-disable-next-line no-await-in-loop -- Sequential file extraction prevents race conditions on shared directories
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    // eslint-disable-next-line no-await-in-loop -- Sequential file writes prevent memory exhaustion on large archives
    await fs.writeFile(outputPath, file.data);
    extractedPaths.push(outputPath);
  }

  return extractedPaths;
}

/**
 * Extract a 7z/CB7 archive to a directory
 *
 * @param archivePath - Path to archive
 * @param outputDir - Output directory
 * @returns Array of extracted file paths
 */
async function extract7zArchive(archivePath: string, outputDir: string): Promise<string[]> {
  // Check if 7z is available
  const available = await is7zAvailable();
  if (available.status !== 'success' || !available.data) {
    throw new Error(
      '7z extraction requires 7-Zip. Install 7zip-bin package or use CBZ format instead.'
    );
  }

  const result = await extractFrom7z(archivePath, outputDir);

  if (result.status !== 'success') {
    throw result.status === 'error' ? result.error : new Error('Unexpected result status');
  }

  return result.data.files.map((f: { filePath: string }) => f.filePath);
}

/**
 * Extract a TAR/CBT archive to a directory
 *
 * @param archivePath - Path to archive
 * @param outputDir - Output directory
 * @returns Array of extracted file paths
 */
async function extractTarArchive(archivePath: string, outputDir: string): Promise<string[]> {
  const result = await extractFromTar(archivePath, outputDir);

  if (result.status !== 'success') {
    throw result.status === 'error' ? result.error : new Error('Unexpected result status');
  }

  return result.data.files.map((f: { filePath: string }) => f.filePath);
}

/**
 * Extract an archive file to a temporary directory
 *
 * Supports: ZIP, CBZ, RAR, CBR, 7z, CB7, TAR, CBT
 *
 * @param archivePath - Path to the archive file
 * @returns Object containing extracted directory path and manga files found
 */
export async function extractArchive(
  archivePath: string
): Promise<{ extractDir: string; files: string[] }> {
  const fileName = path.basename(archivePath);
  const ext = path.extname(archivePath).toLowerCase();

  logger.info(`[FileImporter] Extracting archive: ${fileName} (format: ${ext})`);

  // Create temporary extraction directory
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mugiwara-extract-'));

  try {
    let extractedFiles: string[] = [];

    switch (ext) {
      case '.zip':
      case '.cbz':
        extractedFiles = await extractZipArchive(archivePath, tempDir);
        break;

      case '.rar':
      case '.cbr':
        extractedFiles = await extractRarArchive(archivePath, tempDir);
        break;

      case '.7z':
      case '.cb7':
        extractedFiles = await extract7zArchive(archivePath, tempDir);
        break;

      case '.tar':
      case '.cbt':
        extractedFiles = await extractTarArchive(archivePath, tempDir);
        break;

      default:
        throw new Error(
          `Unsupported archive format: ${ext}. ` +
          `Supported formats: ZIP, CBZ, RAR, CBR, 7z, CB7, TAR, CBT.`
        );
    }

    logger.info(`[FileImporter] Extracted ${extractedFiles.length} files to: ${tempDir}`);

    // Find manga files in extracted directory
    const mangaFiles = await findMangaFiles(tempDir);

    logger.info(`[FileImporter] Found ${mangaFiles.length} manga files in archive`);

    return {
      extractDir: tempDir,
      files: mangaFiles
    };
  } catch (error) {
    // Clean up temp directory on error
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (cleanupError) {
      logger.warn(`[FileImporter] Failed to cleanup temp directory ${tempDir}:`, cleanupError);
    }
    throw new Error(`Failed to extract archive: ${error instanceof Error ? error.message : String(error)}`);
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
