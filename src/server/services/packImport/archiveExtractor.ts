/**
 * Archive Extractor Service
 *
 * Handles extraction of manga pack archives (CBZ/CBR/ZIP/RAR/7z).
 * Extracts files and organizes them by volume/chapter structure.
 */

import { createWriteStream } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import { pipeline } from 'stream/promises';

import yauzl from 'yauzl';

import type { ArchiveFileInfo } from '@/types/pack-download-types';
import type { AsyncResult } from '@/utils/async-result';
import { createSuccessResult, createErrorResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';

type ExecFileAsync = (file: string, args: string[]) => Promise<{ stdout: string; stderr: string }>;

/** Probe for an available 7z-capable extraction tool. Returns the first found. */
async function pickArchiveTool(execFileAsync: ExecFileAsync): Promise<'7z' | 'unar' | null> {
  try {
    await execFileAsync('7z', ['--help']);
    return '7z';
  } catch {
    // not installed
  }
  try {
    await execFileAsync('unar', ['-v']);
    return 'unar';
  } catch {
    return null;
  }
}

/**
 * Archive extraction result
 */
export interface ExtractionResult {
  extractedPath: string;
  totalFiles: number;
  extractedFiles: number;
  skippedFiles: number;
  files: ArchiveFileInfo[];
}

/**
 * Archive Extractor Service
 * Extracts manga pack archives to organized directory structure
 */
export class ArchiveExtractorService {
  private readonly SUPPORTED_EXTENSIONS = ['.cbz', '.zip', '.cbr', '.rar', '.7z'];
  private readonly IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];

  /**
   * Extract archive to target directory
   *
   * @param archivePath - Path to archive file
   * @param extractToPath - Directory to extract files to
   * @returns Extraction result with file list
   */
  async extractArchive(
    archivePath: string,
    extractToPath: string
  ): Promise<AsyncResult<ExtractionResult, Error>> {
    try {
      // Validate archive exists
      try {
        await fs.access(archivePath);
      } catch {
        return createErrorResult(new Error(`Archive file not found: ${archivePath}`));
      }

      // Detect archive type from extension
      const ext = path.extname(archivePath).toLowerCase();

      if (!this.SUPPORTED_EXTENSIONS.includes(ext)) {
        return createErrorResult(new Error(`Unsupported archive format: ${ext}`));
      }

      logger.info(`[ArchiveExtractor] Extracting ${ext} archive: ${archivePath}`);

      // Create extraction directory
      await fs.mkdir(extractToPath, { recursive: true });

      // Extract based on type
      let result: AsyncResult<ExtractionResult, Error>;

      if (ext === '.cbz' || ext === '.zip') {
        result = await this.extractZip(archivePath, extractToPath);
      } else if (ext === '.cbr' || ext === '.rar') {
        result = await this.extractRar(archivePath, extractToPath);
      } else if (ext === '.7z') {
        result = await this.extract7z(archivePath, extractToPath);
      } else {
        return createErrorResult(new Error(`Unsupported archive type: ${ext}`));
      }

      return result;

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Archive extraction failed';
      logger.error(`[ArchiveExtractor] Extraction failed:`, error);
      return createErrorResult(new Error(errorMessage));
    }
  }

  /**
   * Extract ZIP/CBZ archive
   */
  private async extractZip(
    archivePath: string,
    extractToPath: string
  ): Promise<AsyncResult<ExtractionResult, Error>> {
    return new Promise((resolve) => {
      const files: ArchiveFileInfo[] = [];
      let extractedFiles = 0;
      let skippedFiles = 0;
      let totalFiles = 0;

      yauzl.open(archivePath, { lazyEntries: true }, (err, zipfile) => {
        if (err ?? !zipfile) {
          resolve(createErrorResult(new Error(`Failed to open ZIP: ${err?.message ?? 'Unknown error'}`)));
          return;
        }

        zipfile.readEntry();

        zipfile.on('entry', (entry: yauzl.Entry) => {
          void (() => {
            totalFiles++;

            // Skip directories
            if (/\/$/.test(entry.fileName)) {
              zipfile.readEntry();
              return;
            }

            // Skip non-image files
            const ext = path.extname(entry.fileName).toLowerCase();
            if (!this.IMAGE_EXTENSIONS.includes(ext)) {
              logger.debug(`[ArchiveExtractor] Skipping non-image file: ${entry.fileName}`);
              skippedFiles++;
              zipfile.readEntry();
              return;
            }

            // Extract file
            zipfile.openReadStream(entry, (err, readStream) => {
              void (async () => {
            if (err ?? !readStream) {
              logger.error(`[ArchiveExtractor] Failed to read entry: ${entry.fileName}`, err);
              skippedFiles++;
              zipfile.readEntry();
              return;
            }

            try {
              // Sanitize filename and create target path
              const fileName = path.basename(entry.fileName);
              const targetPath = path.join(extractToPath, fileName);

              // Ensure directory exists
              await fs.mkdir(path.dirname(targetPath), { recursive: true });

              // Extract file
              const writeStream = createWriteStream(targetPath);
              await pipeline(readStream, writeStream);

              // Parse volume/chapter info
              const fileInfo = this.parseFileInfo(fileName, targetPath, entry.uncompressedSize);
              files.push(fileInfo);
              extractedFiles++;

              logger.debug(`[ArchiveExtractor] Extracted: ${fileName}`);
              zipfile.readEntry();

            } catch (error: unknown) {
              logger.error(`[ArchiveExtractor] Failed to extract file: ${entry.fileName}`, error);
              skippedFiles++;
              zipfile.readEntry();
            }
              })();
            });
          })();
        });

        zipfile.on('end', () => {
          logger.info(`[ArchiveExtractor] ZIP extraction complete: ${extractedFiles}/${totalFiles} files`);
          resolve(createSuccessResult({
            extractedPath: extractToPath,
            totalFiles,
            extractedFiles,
            skippedFiles,
            files
          }));
        });

        zipfile.on('error', (err: unknown) => {
          logger.error(`[ArchiveExtractor] ZIP extraction error:`, err);
          const errorMessage = err instanceof Error ? err.message : String(err);
          resolve(createErrorResult(new Error(`ZIP extraction failed: ${errorMessage}`)));
        });
      });
    });
  }

  /**
   * Extract RAR/CBR archive
   * Uses unrar command-line tool
   */
  private async extractRar(
    archivePath: string,
    extractToPath: string
  ): Promise<AsyncResult<ExtractionResult, Error>> {
    try {
      const { execFile } = await import('child_process');
      const { promisify } = await import('util');
      const execFileAsync = promisify(execFile);

      // Check if unrar is available
      try {
        await execFileAsync('unrar', ['--version']);
      } catch {
        return createErrorResult(new Error(
          'unrar command not found. Please install unrar: brew install unrar (macOS) or apt-get install unrar (Linux)'
        ));
      }

      logger.info(`[ArchiveExtractor] Extracting RAR with unrar command`);

      // Extract archive
      await execFileAsync('unrar', ['x', '-y', archivePath, extractToPath]);

      // Scan extracted files
      const extractedFiles = await this.scanExtractedFiles(extractToPath);

      logger.info(`[ArchiveExtractor] RAR extraction complete: ${extractedFiles.length} files`);

      return createSuccessResult({
        extractedPath: extractToPath,
        totalFiles: extractedFiles.length,
        extractedFiles: extractedFiles.length,
        skippedFiles: 0,
        files: extractedFiles
      });

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'RAR extraction failed';
      logger.error(`[ArchiveExtractor] RAR extraction failed:`, error);
      return createErrorResult(new Error(errorMessage));
    }
  }

  /**
   * Extract 7z archive.
   *
   * Tries `7z` (p7zip) first — fastest, native handling. Falls back to
   * `unar` (The Unarchiver) which also supports 7z format. Hosts with
   * either tool will succeed; the existing `unar` install on production
   * (used for multi-part RAR per iter-16) means 7z extraction works
   * even when p7zip is not installed.
   */
  private async extract7z(
    archivePath: string,
    extractToPath: string
  ): Promise<AsyncResult<ExtractionResult, Error>> {
    try {
      const { execFile } = await import('child_process');
      const { promisify } = await import('util');
      const execFileAsync = promisify(execFile);

      const tool = await pickArchiveTool(execFileAsync);
      if (!tool) {
        return createErrorResult(new Error(
          'No 7z extractor available. Install p7zip (brew install p7zip / apt-get install p7zip-full) or unar (brew install unar / apt-get install unar)'
        ));
      }

      logger.info(`[ArchiveExtractor] Extracting 7z via ${tool}`);

      if (tool === '7z') {
        await execFileAsync('7z', ['x', '-y', `-o${extractToPath}`, archivePath]);
      } else {
        // unar handles destination via -o; -f to overwrite, -D to skip wrapper dir
        await execFileAsync('unar', ['-f', '-D', '-o', extractToPath, archivePath]);
      }

      const extractedFiles = await this.scanExtractedFiles(extractToPath);

      logger.info(`[ArchiveExtractor] 7z extraction complete via ${tool}: ${extractedFiles.length} files`);

      return createSuccessResult({
        extractedPath: extractToPath,
        totalFiles: extractedFiles.length,
        extractedFiles: extractedFiles.length,
        skippedFiles: 0,
        files: extractedFiles
      });

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '7z extraction failed';
      logger.error(`[ArchiveExtractor] 7z extraction failed:`, error);
      return createErrorResult(new Error(errorMessage));
    }
  }

  /**
   * Scan directory for extracted image files
   */
  private async scanExtractedFiles(directoryPath: string): Promise<ArchiveFileInfo[]> {
    const files: ArchiveFileInfo[] = [];

    async function scanDir(dir: string): Promise<void> {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      // Sequential processing required for memory management with large archives
      // and to prevent filesystem overwhelm. Recursive directory traversal and
      // file stat operations are kept sequential to avoid race conditions.
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          // eslint-disable-next-line no-await-in-loop
          await scanDir(fullPath);
        } else {
          const ext = path.extname(entry.name).toLowerCase();
          if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'].includes(ext)) {
            // eslint-disable-next-line no-await-in-loop
            const stats = await fs.stat(fullPath);
            const fileInfo = {
              fileName: entry.name,
              filePath: fullPath,
              size: stats.size,
              volumeNumber: null as number | null,
              chapterNumber: null as number | null,
              isValidChapter: false
            };

            // Parse volume/chapter info
            const parsed = parseVolumeChapterFromFilename(entry.name);
            fileInfo.volumeNumber = parsed.volume;
            fileInfo.chapterNumber = parsed.chapter;
            fileInfo.isValidChapter = parsed.volume !== null || parsed.chapter !== null;

            files.push(fileInfo);
          }
        }
      }
    }

    await scanDir(directoryPath);
    return files;
  }

  /**
   * Parse file info from filename
   */
  private parseFileInfo(fileName: string, filePath: string, size: number): ArchiveFileInfo {
    const parsed = parseVolumeChapterFromFilename(fileName);

    return {
      fileName,
      filePath,
      size,
      volumeNumber: parsed.volume,
      chapterNumber: parsed.chapter,
      isValidChapter: parsed.volume !== null || parsed.chapter !== null
    };
  }
}

/**
 * Parse volume and chapter numbers from filename
 * Examples:
 * - "v01c001.jpg" -> { volume: 1, chapter: 1 }
 * - "Volume 05 - Chapter 023.jpg" -> { volume: 5, chapter: 23 }
 * - "Fire Force - c142.jpg" -> { volume: null, chapter: 142 }
 */
function parseVolumeChapterFromFilename(fileName: string): {
  volume: number | null;
  chapter: number | null;
} {
  let volume: number | null = null;
  let chapter: number | null = null;

  // Remove extension
  const nameWithoutExt = path.basename(fileName, path.extname(fileName));

  // Try to match volume: v01, vol 01, volume 01, etc.
  const volumeMatch = nameWithoutExt.match(/v(?:ol(?:ume)?\.?\s*)?(\d+)/i);
  if (volumeMatch?.[1]) {
    volume = parseInt(volumeMatch[1], 10);
  }

  // Try to match chapter: c001, ch 001, chapter 001, etc.
  const chapterMatch = nameWithoutExt.match(/c(?:h(?:apter)?\.?\s*)?(\d+)/i);
  if (chapterMatch?.[1]) {
    chapter = parseInt(chapterMatch[1], 10);
  }

  // Alternative: Try numeric patterns like "001", "023"
  // Only use if we didn't find volume/chapter prefix
  if (volume === null && chapter === null) {
    const numericMatch = nameWithoutExt.match(/(\d{3,})/);
    if (numericMatch?.[1]) {
      const num = parseInt(numericMatch[1], 10);
      // Assume it's a chapter number if it's a 3+ digit number
      if (num >= 1 && num <= 9999) {
        chapter = num;
      }
    }
  }

  return { volume, chapter };
}

/**
 * Factory function to create ArchiveExtractorService instance
 */
export function createArchiveExtractor(): ArchiveExtractorService {
  return new ArchiveExtractorService();
}
