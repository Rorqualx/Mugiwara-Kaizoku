/**
 * Manga Path Management Utilities
 *
 * This module provides utilities for managing manga file paths and library locations.
 * It handles path resolution, validation, and error handling for manga storage.
 *
 * @module manga
 */
import path from 'path';

import { sanitizer } from './client/frontendHelpers';
import { logger } from './logging';

import type { Library } from '@prisma/client';
/**
 * Interface for objects that have an associated library
 *
 * @interface HasLibrary
 * @property {Library | null} library - Associated library object or null
 * @property {string} title - Title of the manga
 */
export interface HasLibrary {
  library: Library | null;
  title: string;
}
/**
 * Custom error for library path resolution failures
 *
 * Thrown when a manga's library cannot be found or accessed.
 *
 * @class LibraryPathError
 * @extends Error
 * @example
 * throw new LibraryPathError('One Piece');
 */
export class LibraryPathError extends Error {
  constructor(title: string) {
    super(`Library not found for manga: ${title}`);
    this["name"] = 'LibraryPathError';
  }
}
/**
 * Resolves the filesystem path for a manga's storage location
 *
 * Takes a manga object with library information and resolves its storage path.
 * The manga title is sanitized to create a safe directory name.
 *
 * @param {HasLibrary} data - Manga data with library information
 * @returns {string} Absolute path to the manga's storage location
 * @throws {LibraryPathError} If the manga has no associated library
 * @example
 * const mangaPath = getMangaLibraryPath({
 *   title: 'One Piece',
 *   library: { path: '/manga/library' }
 * });
 */
export function getMangaLibraryPath(data: HasLibrary): string {
  if (!data.library) {
    throw new LibraryPathError(data["title"]);
  }
  logger.info('Library Path:', data.library.path);
  logger.info('Sanitized Title:', sanitizer(data["title"]));
  return path.resolve(data.library.path, sanitizer(data["title"]));
}
/**
 * Validates and returns a manga's storage path
 *
 * Attempts to resolve a manga's storage path and handles any errors.
 * Logs errors for library path resolution failures.
 *
 * @param {HasLibrary} data - Manga data with library information
 * @returns {string} Resolved manga storage path
 * @throws {Error} Propagates any errors that aren't LibraryPathError
 * @example
 * try {
 *   const path = validateMangaPath(manga);
 *   logger.info('Valid path:', path);
 * } catch (error) {
 *   console.error('Invalid path:', error);
 * }
 */
export function validateMangaPath(data: HasLibrary): string {
  try {
    return getMangaLibraryPath(data);
  }
  catch (error: unknown) {
    if (error instanceof LibraryPathError) {
      logger.error((error instanceof Error ? error.message : String(error)));
    }
    throw error;
  }
}