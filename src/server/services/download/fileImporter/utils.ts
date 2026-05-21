/**
 * File Importer Utilities
 *
 * Shared utility functions for the file importer service modules.
 * Provides path sanitization, JSON parsing, folder path generation,
 * and accessibility helpers.
 */

import * as fs from 'fs/promises';
import * as path from 'path';

import { z } from 'zod';

import { getGlobalConfigService } from '@/server/services/config/globalConfigService';
import { getFileOrganizationConfigService, type FileOrganizationConfig } from '@/server/services/fileOrganization/configService';
import { logger } from '@/utils/logger';

/**
 * Zod schema for file organization settings
 */
export const FileOrganizationSettingsSchema = z.object({
  createVolumeFolders: z.boolean().optional(),
  /** How chapter files are organized: volume-group (default), per-chapter, or flat */
  chapterFolderMode: z.enum(['volume-group', 'per-chapter', 'flat']).optional().default('volume-group'),
  splitVolumeFiles: z.boolean().optional(),
  fileMode: z.enum(['keep_in_place', 'move', 'copy']).optional().default('move'),
  organizeOnImport: z.boolean().optional().default(true),
}).passthrough();

/**
 * Type for file organization settings
 */
export type FileOrganizationSettings = z.infer<typeof FileOrganizationSettingsSchema>;

/**
 * Safely parse JSON string to unknown type
 * Fixes @typescript-eslint/no-unsafe-return by properly typing the return
 *
 * @param value - Value to parse (may be string or already parsed)
 * @returns Parsed JSON as unknown, or null on parse failure
 */
export function parseJsonSafely(value: unknown): unknown {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return null;
    }
  }
  return value;
}

/**
 * Sanitize a path component (remove invalid characters)
 *
 * @param name - Path component to sanitize
 * @returns Sanitized path component
 */
export function sanitizePath(name: string): string {
  return name
    .replace(/[<>:"|?*]/g, '') // Remove invalid Windows characters
    .replace(/\//g, '-') // Replace forward slashes
    .replace(/\\/g, '-') // Replace backslashes
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Get helpful error message for inaccessible path
 *
 * @param dirPath - Path that is inaccessible
 * @returns Detailed error message with troubleshooting tips
 */
export function getPathAccessibilityError(dirPath: string): string {
  const isNetworkPath = dirPath.includes('//') ||
                        dirPath.startsWith('/data/') ||
                        dirPath.startsWith('/mnt/') ||
                        dirPath.match(/^[A-Z]:\\/);

  if (isNetworkPath) {
    return [
      `Cannot access path: ${dirPath}`,
      '',
      'This appears to be a network or remote path. Possible issues:',
      '  • Network storage is not mounted on this machine',
      '  • Mount point does not exist or has incorrect permissions',
      '  • Network connection to storage is down',
      '',
      'To fix this:',
      '  1. Verify the network storage is mounted:',
      '     - Linux/macOS: Run `df -h | grep "path"` or `mount | grep "path"`',
      '     - Windows: Check mapped drives in File Explorer',
      '',
      '  2. If not mounted, mount the network storage:',
      '     - See docs/NETWORK_STORAGE_SETUP.md for detailed instructions',
      '',
      '  3. Verify file access:',
      `     - Try: ls "${dirPath}" (Linux/macOS) or dir "${dirPath}" (Windows)`,
      '',
      '  4. Check download client configuration:',
      '     - Ensure download client reports mounted paths, not remote paths',
      '',
      'For more help, see: docs/NETWORK_STORAGE_SETUP.md'
    ].join('\n');
  }

  return [
    `Cannot access path: ${dirPath}`,
    '',
    'Possible issues:',
    '  • Path does not exist',
    '  • Insufficient permissions to read directory',
    '  • Directory is on unmounted drive',
    '',
    'To fix this:',
    `  1. Verify path exists: ls "${dirPath}"`,
    `  2. Check permissions: ls -la "${path.dirname(dirPath)}"`,
    '  3. Ensure all parent directories exist and are accessible',
    ''
  ].join('\n');
}

// ============================================================================
// File Organization Configuration
// ============================================================================

/**
 * Load file organization configuration from the global config service.
 * Returns defaults if loading fails.
 */
export async function loadFileOrganizationConfig(): Promise<FileOrganizationConfig> {
  try {
    const configService = getGlobalConfigService();
    const fileOrgService = getFileOrganizationConfigService(configService);
    return await fileOrgService.loadConfig();
  } catch (error) {
    logger.warn('[FileImporter] Failed to load file organization config, using defaults', { error });
    return {
      folderStructure: 'byTitle',
      customFolderTemplate: '',
      fileNamingTemplate: '{title} - Chapter {chapter}',
      createMetadataFiles: true,
      fileMode: 'move',
      organizeOnImport: true,
    };
  }
}

/**
 * Generate manga folder path based on file organization settings.
 * Shared between download pipeline and import pipeline.
 *
 * @param libraryPath - Library root path
 * @param mangaTitle - Manga title
 * @param config - File organization config
 * @returns Folder path for the manga within the library
 */
export function generateMangaFolderPath(
  libraryPath: string,
  mangaTitle: string,
  config: FileOrganizationConfig
): string {
  const sanitize = (str: string): string => str.replace(/[<>:"/\\|?*]/g, '_').trim();

  switch (config.folderStructure) {
    case 'flat':
      return libraryPath;
    case 'byTitle':
      return path.join(libraryPath, sanitize(mangaTitle));
    case 'byTitleYear': {
      const yearMatch = mangaTitle.match(/\((\d{4})\)/);
      const year = yearMatch?.[1] ?? new Date().getFullYear().toString();
      return path.join(libraryPath, sanitize(`${mangaTitle} (${year})`));
    }
    case 'custom': {
      if (config.customFolderTemplate) {
        const folderName = config.customFolderTemplate
          .replace(/{title}/g, mangaTitle)
          .replace(/{year}/g, new Date().getFullYear().toString());
        return path.join(libraryPath, sanitize(folderName));
      }
      return path.join(libraryPath, sanitize(mangaTitle));
    }
    default:
      return path.join(libraryPath, sanitize(mangaTitle));
  }
}

/**
 * Generate a file name based on the fileNamingTemplate setting.
 *
 * @param originalName - Original file name
 * @param mangaTitle - Manga title
 * @param chapterNumber - Chapter number (if known)
 * @param volumeNumber - Volume number (if known)
 * @param config - File organization config
 * @returns Renamed file name, or original if template is default/empty
 */
export function generateFileName(
  originalName: string,
  mangaTitle: string,
  chapterNumber: number | null,
  volumeNumber: number | null,
  config: FileOrganizationConfig
): string {
  const template = config.fileNamingTemplate;
  // If no custom template or default template, keep original name
  if (!template || template === '{title} - Chapter {chapter}') {
    return originalName;
  }

  const ext = path.extname(originalName);
  const chapterStr = chapterNumber !== null
    ? String(chapterNumber).padStart(3, '0')
    : '000';

  let fileName = template
    .replace(/{title}/g, mangaTitle)
    .replace(/{chapter}/g, chapterStr);

  if (volumeNumber !== null) {
    fileName = fileName.replace(/{volume}/g, String(volumeNumber));
  } else {
    fileName = fileName.replace(/{volume}/g, '');
  }

  fileName = fileName.replace(/{year}/g, new Date().getFullYear().toString());

  // Sanitize and add extension
  const sanitized = fileName
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();

  return sanitized + ext;
}

/**
 * Ensure the standard Chapters/ and Volumes/ subdirectories exist
 * inside a manga series folder.
 */
export async function ensureMangaSubdirs(mangaDir: string): Promise<void> {
  await Promise.all([
    fs.mkdir(path.join(mangaDir, 'Chapters'), { recursive: true }),
    fs.mkdir(path.join(mangaDir, 'Volumes'), { recursive: true })
  ]);
}
