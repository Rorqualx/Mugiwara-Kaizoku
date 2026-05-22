import * as fs from 'fs';
import * as path from 'path';

import { logger } from '../utils/logger';
/**
 * Supported manga archive file extensions
 */
export const SUPPORTED_MANGA_EXTENSIONS = [
'.cbz',
'.zip',
'.pdf',
'.cbr',
'.rar',
'.7z',
'.epub'] as
const;
/**
 * Supported image file extensions for image-based manga folders
 */
export const SUPPORTED_IMAGE_EXTENSIONS = [
'.jpg',
'.jpeg',
'.png',
'.webp',
'.gif',
'.bmp'] as
const;
/**
 * Common manga-related file patterns to ignore
 */
export const IGNORE_PATTERNS = [
'.DS_Store',
'Thumbs.db',
'.gitkeep',
'.gitignore',
'desktop.ini'] as
const;
export type MangaExtension = typeof SUPPORTED_MANGA_EXTENSIONS[number];
export type ImageExtension = typeof SUPPORTED_IMAGE_EXTENSIONS[number];
/**
 * Check if a file is a supported manga archive
 */
export function isMangaFile(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return SUPPORTED_MANGA_EXTENSIONS.includes(ext as MangaExtension);
}
/**
 * Check if a file is a supported image file
 */
export function isImageFile(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return SUPPORTED_IMAGE_EXTENSIONS.includes(ext as ImageExtension);
}
/**
 * Check if a directory contains manga images
 */
export async function isImageDirectory(dirPath: string): Promise<boolean> {
  try {
    // First check if this is actually a directory
    const stats = await fs.promises.stat(dirPath);
    if (!stats.isDirectory()) {
      return false;
    }

    const files = await fs.promises.readdir(dirPath);
    const imageFiles = files.filter((f) => {
      if ((IGNORE_PATTERNS as readonly string[]).includes(f))
      return false;
      return isImageFile(f);
    });
    // Not an image directory if it also contains archive files (CBZ, CBR, etc.)
    const hasArchiveFiles = files.some((f) => isMangaFile(f));
    if (hasArchiveFiles) return false;
    // Consider it a manga directory if it has at least 3 images and no archives
    return imageFiles.length >= 3;
  }
  catch (error: unknown) {
    // Only log real errors, not expected "not a directory" cases
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (!errorMessage.includes('ENOTDIR') && !errorMessage.includes('ENOENT')) {
      logger.error(`Error checking directory ${dirPath}:`, error);
    }
    return false;
  }
}

/**
 * Classify a directory entry as dir / file / symlink, falling back to `lstat`
 * when the dirent's d_type is unreliable (DT_UNKNOWN on NFS/SMB/FUSE makes
 * isDirectory()/isFile()/isSymbolicLink() all return false for real entries).
 */
async function classifyEntry(
  entry: fs.Dirent,
  fullPath: string,
  followSymlinks: boolean,
): Promise<{ kind: 'dir' | 'file' | 'symlink'; name: string; fullPath: string } | null> {
  let isDir = entry.isDirectory();
  let isFile = entry.isFile();
  let isSymlink = entry.isSymbolicLink();

  if (!isDir && !isFile && !isSymlink) {
    try {
      const stats = await fs.promises.lstat(fullPath);
      isDir = stats.isDirectory();
      isFile = stats.isFile();
      isSymlink = stats.isSymbolicLink();
    } catch {
      return null;
    }
  }

  if (isDir) return { kind: 'dir', name: entry.name, fullPath };
  if (isFile) return { kind: 'file', name: entry.name, fullPath };
  if (isSymlink && followSymlinks) return { kind: 'symlink', name: entry.name, fullPath };
  return null;
}

/**
 * Get all manga files from a directory (recursive)
 */
export async function findMangaFiles(dirPath: string, options: {
  recursive?: boolean;
  includeImageDirs?: boolean;
  followSymlinks?: boolean;
} = {}): Promise<string[]> {
  const { recursive = true, includeImageDirs = true, followSymlinks = false } = options;
  const mangaFiles: string[] = [];
  async function scanDirectory(currentPath: string): Promise<void> {
    try {
      const entries = await fs.promises.readdir(currentPath, { withFileTypes: true });

      // Separate entries by type for parallel processing
      const directories: Array<{ name: string; fullPath: string }> = [];
      const files: Array<{ name: string; fullPath: string }> = [];
      const symlinks: Array<{ name: string; fullPath: string }> = [];

      const classified = await Promise.all(
        entries.map((e) => classifyEntry(e, path.join(currentPath, e.name), followSymlinks)),
      );
      for (const c of classified) {
        if (!c) continue;
        if (c.kind === 'dir') directories.push({ name: c.name, fullPath: c.fullPath });
        else if (c.kind === 'file') files.push({ name: c.name, fullPath: c.fullPath });
        else symlinks.push({ name: c.name, fullPath: c.fullPath });
      }

      // Process files synchronously (no await needed)
      for (const file of files) {
        if (isMangaFile(file.name)) {
          mangaFiles.push(file.fullPath);
        }
      }

      // Process directories in parallel
      await Promise.all(
        directories.map(async (dir) => {
          // Check if it's an image directory
          if (includeImageDirs && (await isImageDirectory(dir.fullPath))) {
            mangaFiles.push(dir.fullPath);
          } else if (recursive) {
            // Recursively scan subdirectories
            await scanDirectory(dir.fullPath);
          }
        })
      );

      // Process symlinks in parallel
      await Promise.allSettled(
        symlinks.map(async (symlink) => {
          try {
            const stats = await fs.promises.stat(symlink.fullPath);
            if (stats.isDirectory() && recursive) {
              await scanDirectory(symlink.fullPath);
            } else if (stats.isFile() && isMangaFile(symlink.fullPath)) {
              mangaFiles.push(symlink.fullPath);
            }
          } catch (error: unknown) {
            logger.warn(`Unable to follow symlink ${symlink.fullPath}:`, error);
          }
        })
      );
    }
    catch (error: unknown) {
logger.error(`Error scanning directory ${currentPath}:`, error);
    }
  }
  await scanDirectory(dirPath);
  return mangaFiles;
}
/**
 * Group files by their parent manga directory
 */
export function groupFilesByManga(files: string[]): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const file of files) {
    const dir = path.dirname(file);
    const existing = groups.get(dir) ?? [];
    existing.push(file);
    groups.set(dir, existing);
  }
  return groups;
}
/**
 * Extract volume number from filename
 */
export function extractVolumeNumber(filename: string): number | null {
  const patterns = [
  /[Vv]ol(?:ume)?[\s._-]*(\d+)/i,
  /[Vv](\d+)/,
  /Volume[\s._-]*(\d+)/i];

  for (const pattern of patterns) {
    const match = filename.match(pattern);
    if (match?.[1]) {
      return parseInt(match[1], 10);
    }
  }
  return null;
}
/**
 * Extract chapter number from filename
 */
export function extractChapterNumber(filename: string): number | null {
  const patterns = [
  /[Cc]h(?:apter)?[\s._-]*(\d+(?:\.\d+)?)/i,
  /(?<![a-zA-Z])[Cc](\d+(?:\.\d+)?)/,
  /Chapter[\s._-]*(\d+(?:\.\d+)?)/i,
  /[\s._-](\d{3,4})[\s._-]/, // Common pattern: _001_ or -001-
  /[\s._-](\d{1,3})$/ // Number at end: -1, -99
  ];
  // Skip if it looks like a volume indicator
  if (/[Vv]ol(?:ume)?[\s._-]*\d+/i.test(filename) &&
  !/[Cc]h(?:apter)?[\s._-]*\d+/i.test(filename)) {
    return null;
  }
  for (const pattern of patterns) {
    const match = filename.match(pattern);
    if (match?.[1]) {
      return parseFloat(match[1]);
    }
  }
  return null;
}
/**
 * Get file size in bytes
 *
 * Returns the size in bytes for a single file.
 * For directories, use getDirectorySizeBytes instead.
 *
 * @param filePath - Path to the file
 * @returns Size in bytes, or 0 on error
 */
export async function getFileSizeBytes(filePath: string): Promise<number> {
  try {
    const stats = await fs.promises.stat(filePath);
    return stats.size;
  }
  catch (_error: unknown) {
    return 0;
  }
}

const IMAGE_EXTENSIONS_SET = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);

/**
 * Count image pages in an archive file (CBZ/ZIP).
 * Falls back to checking for a single archive inside a directory.
 * Returns 0 for unsupported formats or on error.
 */
export async function countArchivePages(filePath: string): Promise<number> {
  try {
    let archivePath = filePath;
    // If filePath is a directory, look for an archive inside
    const stats = await fs.promises.stat(filePath).catch(() => null);
    if (stats?.isDirectory()) {
      const entries = await fs.promises.readdir(filePath);
      const archive = entries.find(f => /\.(zip|cbz)$/i.test(f));
      if (!archive) return 0;
      archivePath = path.join(filePath, archive);
    } else if (!stats?.isFile()) {
      // Try with .cbz extension
      const cbzPath = filePath + '.cbz';
      const zipPath = filePath + '.zip';
      const cbzStats = await fs.promises.stat(cbzPath).catch(() => null);
      const zipStats = await fs.promises.stat(zipPath).catch(() => null);
      if (cbzStats?.isFile()) archivePath = cbzPath;
      else if (zipStats?.isFile()) archivePath = zipPath;
      else return 0;
    }

    if (!/\.(zip|cbz)$/i.test(archivePath)) return 0;

    const JSZip = (await import('jszip')).default;
    const data = await fs.promises.readFile(archivePath);
    const zip = await JSZip.loadAsync(data);
    const images = Object.keys(zip.files).filter(name => {
      const ext = path.extname(name).toLowerCase();
      return IMAGE_EXTENSIONS_SET.has(ext) && !zip.files[name]?.dir && !name.startsWith('__MACOSX');
    });
    return images.length;
  } catch {
    return 0;
  }
}

/**
 * Get total size of a directory or file in bytes
 *
 * For files, returns the file size.
 * For directories, recursively calculates total size of all contents.
 *
 * @param targetPath - Path to file or directory
 * @returns Total size in bytes, or 0 on error
 */
export async function getDirectorySizeBytes(targetPath: string): Promise<number> {
  try {
    const stats = await fs.promises.stat(targetPath);

    if (stats.isFile()) {
      return stats.size;
    }

    if (stats.isDirectory()) {
      const entries = await fs.promises.readdir(targetPath, { withFileTypes: true });
      let totalSize = 0;

      // Process entries in parallel for better performance
      const sizes = await Promise.all(
        entries.map(async (entry) => {
          const entryPath = path.join(targetPath, entry.name);
          if (entry.isFile()) {
            try {
              const entryStats = await fs.promises.stat(entryPath);
              return entryStats.size;
            } catch {
              return 0;
            }
          } else if (entry.isDirectory()) {
            return getDirectorySizeBytes(entryPath);
          }
          return 0;
        })
      );

      totalSize = sizes.reduce((sum, size) => sum + size, 0);
      return totalSize;
    }

    return 0;
  }
  catch (_error: unknown) {
    return 0;
  }
}

/**
 * Get total size of multiple files in bytes
 *
 * Useful for calculating total size of manga archive files.
 *
 * @param filePaths - Array of file paths
 * @returns Total size in bytes
 */
export async function getFilesSizeBytes(filePaths: string[]): Promise<number> {
  const sizes = await Promise.all(filePaths.map(getFileSizeBytes));
  return sizes.reduce((sum, size) => sum + size, 0);
}

/**
 * Get file size in human readable format
 */
export async function getFileSize(filePath: string): Promise<string> {
  try {
    const stats = await fs.promises.stat(filePath);
    const bytes = stats.size;
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }
  catch (_error: unknown) {
    return '0 B';
  }
}
/**
 * Check if a path is safe (prevents directory traversal)
 */
export function isSafePath(basePath: string, targetPath: string): boolean {
  const resolvedBase = path.resolve(basePath);
  const resolvedTarget = path.resolve(basePath, targetPath);
  return resolvedTarget.startsWith(resolvedBase);
}
/**
 * Get the creation date of a file
 */
export async function getFileCreationDate(filePath: string): Promise<Date | null> {
  try {
    const stats = await fs.promises.stat(filePath);
    return stats.birthtime;
  }
  catch (_error: unknown) {
    return null;
  }
}
/**
 * Sort files naturally (handle numeric sequences properly)
 */
export function naturalSort(files: string[]): string[] {
  return files.sort((a, b) => {
    // Extract numbers from filenames
    const aMatch = a.match(/(\d+)/g);
    const bMatch = b.match(/(\d+)/g);
    if (aMatch && bMatch) {
      // Compare first number found
      const aNum = parseInt(aMatch[0], 10);
      const bNum = parseInt(bMatch[0], 10);
      if (aNum !== bNum) {
        return aNum - bNum;
      }
    }
    // Fallback to locale compare
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
  });
}