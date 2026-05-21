/**
 * Preview Generator Module
 *
 * Pure functions for generating file organization previews based on
 * configuration and manga metadata.
 *
 * Extracted from: useFileOrganizationConfig.ts (lines 608-712)
 */

import type { FileOrganizationConfig, MangaPreviewInfo } from './types';

// ============================================================================
// Preview Generation
// ============================================================================

/**
 * Generate a preview of how files would be organized
 *
 * Creates a complete file path preview based on the current configuration
 * and provided manga information. Useful for showing users how their
 * settings will affect file organization.
 *
 * @param config - File organization configuration
 * @param mangaInfo - Basic manga information for preview
 * @returns Preview of the file organization (e.g., "My Manga/My Manga - Chapter 01.cbz")
 *
 * @example
 * ```typescript
 * const preview = generateOrganizationPreview(
 *   { folderStructure: 'byTitle', fileNamingTemplate: '{title} - Chapter {chapter}', ... },
 *   { title: 'One Piece', chapter: '1' }
 * );
 * // Returns: "One Piece/One Piece - Chapter 1.cbz"
 * ```
 */
export function generateOrganizationPreview(
  config: FileOrganizationConfig,
  mangaInfo: MangaPreviewInfo
): string {
  const { folderStructure, customFolderTemplate, fileNamingTemplate } = config;

  // Generate folder path based on structure
  let folderPath = '';
  switch (folderStructure) {
    case 'flat':
      folderPath = '';
      break;
    case 'byTitle':
      folderPath = sanitizePath(mangaInfo.title);
      break;
    case 'byTitleYear': {
      const year = mangaInfo.year !== undefined ? ` (${mangaInfo.year})` : '';
      folderPath = sanitizePath(mangaInfo.title + year);
      break;
    }
    case 'byPublisher': {
      const publisher = mangaInfo.publisher ?? 'Unknown Publisher';
      folderPath = sanitizePath(`${publisher}/${mangaInfo.title}`);
      break;
    }
    case 'custom':
      if (customFolderTemplate === '') {
        folderPath = sanitizePath(mangaInfo.title);
      } else {
        folderPath = applyCustomTemplate(customFolderTemplate, mangaInfo);
      }
      break;
    default:
      folderPath = sanitizePath(mangaInfo.title);
      break;
  }

  // Generate file name
  let fileName = fileNamingTemplate
    .replace(/{title}/g, mangaInfo.title)
    .replace(/{chapter}/g, mangaInfo.chapter.toString());

  // Optional replacements
  if (mangaInfo.volume !== undefined) {
    fileName = fileName.replace(/{volume}/g, mangaInfo.volume.toString());
  } else {
    fileName = fileName.replace(/{volume}/g, '');
  }

  if (mangaInfo.year !== undefined) {
    fileName = fileName.replace(/{year}/g, mangaInfo.year.toString());
  } else {
    fileName = fileName.replace(/{year}/g, '');
  }

  fileName = sanitizePath(fileName);

  // Combine path and file name
  return folderPath !== '' ? `${folderPath}/${fileName}.cbz` : `${fileName}.cbz`;
}

// ============================================================================
// Template Helpers
// ============================================================================

/**
 * Apply a custom template to manga information
 *
 * Replaces template placeholders with actual manga metadata values.
 * Handles optional fields gracefully.
 *
 * @param template - The custom template (e.g., "{publisher}/{title} ({year})")
 * @param mangaInfo - Information about the manga
 * @returns The applied template with sanitized path
 *
 * @example
 * ```typescript
 * const result = applyCustomTemplate(
 *   '{publisher}/{title} ({year})',
 *   { title: 'One Piece', publisher: 'Shueisha', year: 1997 }
 * );
 * // Returns: "Shueisha/One Piece (1997)"
 * ```
 */
export function applyCustomTemplate(
  template: string,
  mangaInfo: {
    title: string;
    year?: string | number;
    publisher?: string;
  }
): string {
  // FIXED: Line 682 - Remove unnecessary ?? on required title field
  let result = template.replace(/{title}/g, mangaInfo.title);

  // Optional replacements
  if (mangaInfo.year !== undefined) {
    result = result.replace(/{year}/g, mangaInfo.year.toString());
  } else {
    result = result.replace(/{year}/g, '');
  }

  if (mangaInfo.publisher !== undefined) {
    result = result.replace(/{publisher}/g, mangaInfo.publisher);
  } else {
    result = result.replace(/{publisher}/g, 'Unknown Publisher');
  }

  return sanitizePath(result);
}

/**
 * Sanitize a path to remove invalid characters
 *
 * Removes or replaces characters that are invalid in file paths across
 * different operating systems (Windows, macOS, Linux).
 *
 * @param path - The path to sanitize
 * @returns The sanitized path safe for file system use
 *
 * @example
 * ```typescript
 * sanitizePath('My Manga: Volume 1/2');
 * // Returns: "My Manga_ Volume 1_2"
 * ```
 */
export function sanitizePath(path: string): string {
  // Replace characters that are invalid in file paths
  return path
    .replace(/[<>:"/\\|?*]/g, '_') // Replace invalid characters with underscore
    .replace(/\s+/g, ' ') // Replace multiple spaces with a single space
    .trim(); // Remove leading/trailing spaces
}
