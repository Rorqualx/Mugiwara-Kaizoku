/**
 * Chapter File Manager
 *
 * Handles file system operations for chapter downloads:
 * - Downloads images from URLs
 * - Creates CBZ archives
 * - Manages temporary and final storage locations
 * - Cleanup of temporary files
 *
 * @module server/services/downloads/ChapterFileManager
 */

import { createWriteStream} from 'fs';
import fs from 'fs/promises';
import path from 'path';
import { pipeline } from 'stream/promises';

import archiver from 'archiver';

import type { DownloadLink } from '@/types/adapters/native-download-types';
import { logger } from '@/utils/logger';

/**
 * CBZ creation result
 */
export interface CBZResult {
  filePath: string;
  fileSize: number;
  pageCount: number;
}

/**
 * Chapter File Manager
 */
export class ChapterFileManager {
  private readonly tempDir: string;
  private readonly storageDir: string;

  constructor() {
    // Use environment variables or defaults
    this.tempDir = process.env['TEMP_DOWNLOAD_DIR'] ?? '/tmp/native-downloads';
    this.storageDir = process.env['MANGA_STORAGE_DIR'] ?? '/data/manga';
  }

  /**
   * Download images and create CBZ archive
   */
  async downloadAndCreateCBZ(
    downloadLinks: DownloadLink[],
    mangaId: number,
    chapterNumber: number,
    onProgress?: (progress: number) => void
  ): Promise<CBZResult> {
    const sessionId = `manga-${mangaId}-ch-${chapterNumber}-${Date.now()}`;
    const tempSessionDir = path.join(this.tempDir, sessionId);

    try {
      // Create temp directory for this download
      await fs.mkdir(tempSessionDir, { recursive: true });

      logger.info(`Downloading ${downloadLinks.length} images to ${tempSessionDir}`);

      // Download all images
      const downloadedImages: string[] = [];
      for (let i = 0; i < downloadLinks.length; i++) {
        const link = downloadLinks[i];
        if (!link) continue; // Skip undefined links

        // eslint-disable-next-line no-await-in-loop -- Sequential processing required for progress tracking and ordered downloads
        const imagePath = await this.downloadImage(
          link.imageUrl,
          tempSessionDir,
          link.pageNumber || (i + 1)
        );
        downloadedImages.push(imagePath);

        // Report progress
        if (onProgress) {
          const progress = ((i + 1) / downloadLinks.length) * 100;
          onProgress(Math.floor(progress));
        }
      }

      logger.info(`Downloaded ${downloadedImages.length} images successfully`);

      // Create CBZ archive
      const cbzPath = await this.createCBZ(
        downloadedImages,
        mangaId,
        chapterNumber
      );

      // Get file stats
      const stats = await fs.stat(cbzPath);

      // Cleanup temp directory
      await fs.rm(tempSessionDir, { recursive: true, force: true });

      return {
        filePath: cbzPath,
        fileSize: stats.size,
        pageCount: downloadedImages.length
      };
    } catch (error: unknown) {
      // Cleanup on error
      await fs.rm(tempSessionDir, { recursive: true, force: true }).catch(() => {
        // Ignore cleanup errors
      });

      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to download and create CBZ', errorMessage);
      throw error;
    }
  }

  /**
   * Download a single image
   */
  private async downloadImage(
    imageUrl: string,
    destDir: string,
    pageNumber: number
  ): Promise<string> {
    try {
      // Determine file extension from URL or default to .jpg
      const urlExt = path.extname(new URL(imageUrl).pathname);
      const ext = urlExt || '.jpg';

      // Pad page number for proper sorting (e.g., 001.jpg, 002.jpg)
      const paddedNumber = String(pageNumber).padStart(3, '0');
      const filename = `page-${paddedNumber}${ext}`;
      const destPath = path.join(destDir, filename);

      // Fetch the image
      const response = await fetch(imageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      // Save to file
      const fileStream = createWriteStream(destPath);
      await pipeline(response.body as unknown as NodeJS.ReadableStream, fileStream);

      logger.debug(`Downloaded image ${pageNumber}: ${filename}`);

      return destPath;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to download image from ${imageUrl}`, errorMessage);
      throw new Error(`Failed to download page ${pageNumber}: ${errorMessage}`);
    }
  }

  /**
   * Create CBZ archive from images
   */
  private async createCBZ(
    imagePaths: string[],
    mangaId: number,
    chapterNumber: number
  ): Promise<string> {
    try {
      // Ensure storage directory exists
      const mangaStorageDir = path.join(this.storageDir, `manga-${mangaId}`);
      await fs.mkdir(mangaStorageDir, { recursive: true });

      // Create CBZ filename
      const cbzFilename = `chapter-${String(chapterNumber).padStart(4, '0')}.cbz`;
      const cbzPath = path.join(mangaStorageDir, cbzFilename);

      logger.info(`Creating CBZ archive: ${cbzPath}`);

      // Create archive
      const output = createWriteStream(cbzPath);
      const archive = archiver('zip', {
        zlib: { level: 9 } // Maximum compression
      });

      // Handle errors
      archive.on('error', (err) => {
        throw err;
      });

      // Pipe archive to file
      archive.pipe(output);

      // Add all images to archive (sorted)
      const sortedImages = imagePaths.sort((a, b) => a.localeCompare(b));
      for (const imagePath of sortedImages) {
        const filename = path.basename(imagePath);
        archive.file(imagePath, { name: filename });
      }

      // Finalize archive
      await archive.finalize();

      // Wait for output stream to finish
      await new Promise<void>((resolve, reject) => {
        output.on('close', () => resolve());
        output.on('error', reject);
      });

      logger.info(`Created CBZ archive: ${cbzPath} (${archive.pointer()} bytes)`);

      return cbzPath;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to create CBZ archive', errorMessage);
      throw error;
    }
  }

  /**
   * Delete a chapter file
   */
  async deleteChapterFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
      logger.info(`Deleted chapter file: ${filePath}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.warn(`Failed to delete chapter file: ${filePath}`, errorMessage);
    }
  }

  /**
   * Get chapter file info
   */
  async getFileInfo(filePath: string): Promise<{ size: number; exists: boolean }> {
    try {
      const stats = await fs.stat(filePath);
      return {
        size: stats.size,
        exists: true
      };
    } catch {
      return {
        size: 0,
        exists: false
      };
    }
  }

  /**
   * Cleanup old temp files
   */
  async cleanupTempFiles(olderThanHours = 24): Promise<number> {
    try {
      const tempDirExists = await fs.access(this.tempDir).then(() => true).catch(() => false);
      if (!tempDirExists) {
        return 0;
      }

      const entries = await fs.readdir(this.tempDir, { withFileTypes: true });
      const now = Date.now();
      const maxAge = olderThanHours * 60 * 60 * 1000;

      // Collect cleanup operations for parallel execution
      const cleanupOperations = entries
        .filter(entry => entry.isDirectory())
        .map(async (entry) => {
          const dirPath = path.join(this.tempDir, entry.name);
          const stats = await fs.stat(dirPath);
          const age = now - stats.mtimeMs;

          if (age > maxAge) {
            await fs.rm(dirPath, { recursive: true, force: true });
            logger.debug(`Cleaned up old temp directory: ${entry.name}`);
            return true;
          }
          return false;
        });

      // Execute all cleanup operations in parallel
      const results = await Promise.all(cleanupOperations);
      const cleanedCount = results.filter(Boolean).length;

      if (cleanedCount > 0) {
        logger.info(`Cleaned up ${cleanedCount} old temp directories`);
      }

      return cleanedCount;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to cleanup temp files', errorMessage);
      return 0;
    }
  }
}
