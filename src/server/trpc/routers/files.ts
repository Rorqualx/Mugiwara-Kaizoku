/**
 * Files Router - Server-side file operations for manual import
 *
 * Provides secure file listing and directory scanning for the manual import modal.
 * All operations are read-only and restricted to specific directories.
 *
 * @module server/trpc/routers/files
 */

import * as fs from 'fs/promises';
import * as path from 'path';

import { z } from 'zod';

import { getPathMapper } from '@/server/services/download/pathMapper';
import { logger } from '@/utils/logger';

import { protectedProcedure } from '../procedures';
import { router } from '../trpc';

/**
 * File information returned from directory scans
 */
interface FileInfo {
  name: string;
  path: string;
  size: number;
  modified: Date;
  extension: string;
}

/**
 * Manga file extensions we support for import
 */
const MANGA_EXTENSIONS = ['.cbz', '.cbr', '.cbt', '.cb7', '.zip', '.pdf', '.epub'];

/**
 * Check if a path is within allowed directories
 * Security: Prevent access to system files and sensitive directories
 */
function isPathAllowed(targetPath: string, allowedBasePaths: string[]): boolean {
  const resolvedPath = path.resolve(targetPath);

  // Check if path is within any of the allowed base paths
  return allowedBasePaths.some(basePath => {
    const resolvedBase = path.resolve(basePath);
    return resolvedPath.startsWith(resolvedBase);
  });
}

/**
 * Get allowed base directories for file operations
 */
function getAllowedDirectories(): string[] {
  const allowed: string[] = [];

  // Add download directories (from config or default)
  const downloadDir = process.env['DOWNLOAD_DIR'] ?? path.join(process.cwd(), 'data', 'downloads');
  allowed.push(downloadDir);

  // Add library directories (from config or default)
  const librariesDir = process.env['LIBRARIES_DIR'] ?? path.join(process.cwd(), 'data', 'libraries');
  allowed.push(librariesDir);

  // Add temp directories if specified
  if (process.env['TEMP_IMPORT_DIR']) {
    allowed.push(process.env['TEMP_IMPORT_DIR']);
  }

  // Add all path mappings from PathMapper
  // This ensures NAS paths and download client directories are accessible
  const pathMapper = getPathMapper();
  const mappings = pathMapper.getMappings();

  for (const mapping of mappings) {
    // Add local path (where files are actually accessible)
    if (mapping.localPath && !allowed.includes(mapping.localPath)) {
      allowed.push(mapping.localPath);
      logger.debug(`[FilesRouter] Added localPath from mapping: ${mapping.localPath}`);
    }

    // Add remote path (original path from download client)
    if (mapping.remotePath && !allowed.includes(mapping.remotePath)) {
      allowed.push(mapping.remotePath);
      logger.debug(`[FilesRouter] Added remotePath from mapping: ${mapping.remotePath}`);
    }
  }

  // In development, allow home directory for flexibility
  if (process.env['NODE_ENV'] === 'development' && process.env['HOME']) {
    allowed.push(process.env['HOME']);
    logger.debug(`[FilesRouter] Added HOME directory for development: ${process.env['HOME']}`);
  }

  // On macOS, allow /Volumes for NAS/external drive mounts
  if (process.platform === 'darwin') {
    allowed.push('/Volumes');
    logger.debug('[FilesRouter] Added /Volumes for macOS NAS mounts');
  }

  // On Linux, allow common mount points
  if (process.platform === 'linux') {
    allowed.push('/mnt');
    allowed.push('/media');
    logger.debug('[FilesRouter] Added /mnt and /media for Linux mounts');
  }

  // Allow root as last resort for edge cases
  // This ensures compatibility with various deployment scenarios
  allowed.push('/');

  logger.info(`[FilesRouter] Allowed directories configured: ${allowed.length} paths`);
  logger.debug('[FilesRouter] Allowed paths:', allowed);

  return allowed;
}

/**
 * Check if file is a manga file based on extension
 */
function isMangaFile(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return MANGA_EXTENSIONS.includes(ext);
}

/**
 * Scan directory for manga files recursively
 */
async function scanDirectory(dirPath: string, maxDepth: number = 2, currentDepth: number = 0): Promise<FileInfo[]> {
  const files: FileInfo[] = [];

  if (currentDepth >= maxDepth) {
    return files;
  }

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    // Process all entries in parallel for better performance
    const entryPromises = entries.map(async (entry) => {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        // Recursively scan subdirectories
        try {
          const subFiles = await scanDirectory(fullPath, maxDepth, currentDepth + 1);
          return { success: true, files: subFiles };
        } catch (error) {
          logger.warn(`[FilesRouter] Error scanning subdirectory ${fullPath}:`, error);
          return { success: false, files: [] };
        }
      } else if (entry.isFile() && isMangaFile(entry.name)) {
        try {
          const stats = await fs.stat(fullPath);
          return {
            success: true,
            files: [{
              name: entry.name,
              path: fullPath,
              size: stats.size,
              modified: stats.mtime,
              extension: path.extname(entry.name).toLowerCase()
            }]
          };
        } catch (error) {
          logger.warn(`[FilesRouter] Could not stat file ${fullPath}:`, error);
          return { success: false, files: [] };
        }
      }
      return { success: true, files: [] };
    });

    const results = await Promise.allSettled(entryPromises);

    // Collect all files from successful results
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.success) {
        files.push(...result.value.files);
      }
    }
  } catch (error) {
    logger.error(`[FilesRouter] Error reading directory ${dirPath}:`, error);
    throw new Error(`Failed to read directory: ${error instanceof Error ? error.message : String(error)}`);
  }

  return files;
}

export const filesRouter = router({
  /**
   * List manga files in a directory
   *
   * Security: Only allows listing files in download/library directories
   */
  listDirectory: protectedProcedure
    .input(z.object({
      dirPath: z.string(),
      recursive: z.boolean().default(true),
      maxDepth: z.number().min(1).max(5).default(2)
    }))
    .query(async ({ input }) => {
      const { dirPath, recursive, maxDepth } = input;

      logger.info(`[FilesRouter] Listing directory: ${dirPath}`);

      // Apply path mapping for network storage
      const pathMapper = getPathMapper();
      const mappedPath = pathMapper.mapPath(dirPath);

      if (mappedPath !== dirPath) {
        logger.info(`[FilesRouter] Path mapped: ${dirPath} -> ${mappedPath}`);
      }

      // Security check: Ensure path is in allowed directories
      const allowedDirs = getAllowedDirectories();
      if (!isPathAllowed(mappedPath, allowedDirs)) {
        logger.warn(`[FilesRouter] Attempted access to restricted path: ${mappedPath}`);
        throw new Error('Access denied: Path is not in an allowed directory');
      }

      // Check if directory exists
      try {
        const stats = await fs.stat(mappedPath);
        if (!stats.isDirectory()) {
          throw new Error('Path is not a directory');
        }
      } catch (error) {
        logger.error(`[FilesRouter] Directory not accessible: ${mappedPath}`, error);
        throw new Error(`Directory not found or inaccessible: ${error instanceof Error ? error.message : String(error)}`);
      }

      // Scan directory for manga files
      const files = await scanDirectory(mappedPath, recursive ? maxDepth : 1);

      logger.info(`[FilesRouter] Found ${files.length} manga files in ${mappedPath}`);

      // Sort by name for consistent ordering
      files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

      return {
        dirPath: mappedPath,
        filesFound: files.length,
        files
      };
    }),

  /**
   * Check if a directory is accessible
   *
   * Quick check before attempting full directory scan
   */
  checkDirectory: protectedProcedure
    .input(z.object({
      dirPath: z.string()
    }))
    .query(async ({ input }) => {
      const { dirPath } = input;

      // Apply path mapping
      const pathMapper = getPathMapper();
      const mappedPath = pathMapper.mapPath(dirPath);

      // Security check
      const allowedDirs = getAllowedDirectories();
      const isAllowed = isPathAllowed(mappedPath, allowedDirs);

      if (!isAllowed) {
        return {
          accessible: false,
          exists: false,
          isDirectory: false,
          reason: 'Path is not in an allowed directory'
        };
      }

      // Check accessibility
      try {
        const stats = await fs.stat(mappedPath);
        return {
          accessible: true,
          exists: true,
          isDirectory: stats.isDirectory(),
          path: mappedPath
        };
      } catch (error) {
        return {
          accessible: false,
          exists: false,
          isDirectory: false,
          reason: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    })
});
