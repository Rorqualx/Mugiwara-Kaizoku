/**
 * Default Paths Module
 *
 * Centralizes path management for libraries and downloads in the application.
 * Provides consistent path handling across both local and Docker environments.
 *
 * Features:
 * - Environment-aware path resolution
 * - Default directory structure
 * - Automatic directory creation
 * - Path normalization utilities
 *
 * @module utils/defaultPaths
 */
import fs from 'fs/promises';
import path from 'path';

import { getErrorMessage } from '@/utils/errors/helpers';

import { logger } from '../utils/logger';

const DOCKER_ENV = process.env['DOCKER'];
const isDocker = DOCKER_ENV === 'true' || DOCKER_ENV === '1';

/**
 * Base data directory path
 * In Docker: /config/data (libraries metadata, downloads cache, suwayomi state).
 *            Postgres lives at /config/postgres; secrets at /config/secrets.env.
 *            User's manga library is bind-mounted separately at /library.
 * In local:  [project_root]/data
 */
export const BASE_DATA_DIR = isDocker ? '/config/data' : path.resolve(process.cwd(), 'data');

logger.info(`Data directory: ${isDocker ? 'Docker' : 'local'} mode, BASE_DATA_DIR=${BASE_DATA_DIR}`);
/**
 * Default libraries directory path
 * Where manga libraries are stored by default
 */
export const LIBRARIES_DIR = path.join(BASE_DATA_DIR, 'libraries');
/**
 * Default downloads directory path
 * Where manga chapters are temporarily stored during download
 */
export const DOWNLOADS_DIR = path.join(BASE_DATA_DIR, 'downloads/manga');
/**
 * Ensures that default directories exist
 * Creates the base data directory and its subdirectories if they don't exist
 *
 * @returns {Promise<void>}
 * @throws {Error} When directory creation fails
 */
export async function ensureDirectoriesExist(): Promise<void> {
  try {
    // First ensure the base data directory exists
    await fs.mkdir(BASE_DATA_DIR, { recursive: true });
    logger.info(`Base data directory created at: ${BASE_DATA_DIR}`);
    // Then create the subdirectories
    await fs.mkdir(LIBRARIES_DIR, { recursive: true });
    await fs.mkdir(DOWNLOADS_DIR, { recursive: true });
    logger.info('Default directories created successfully:');
    logger.info(`- Libraries: ${LIBRARIES_DIR}`);
    logger.info(`- Downloads: ${DOWNLOADS_DIR}`);
  }
  catch (error: unknown) {
    const errorMessage = getErrorMessage(error);
    logger.error('Failed to create default directories:', errorMessage);
    throw new Error(errorMessage);
  }
}
/**
 * Generates a default library path based on library name.
 *
 * Docker: defaults to the user-mounted `/library` root (the bind-mount in
 * docker-compose.yml). Sub-dirs under that are where their files actually
 * live — defaulting elsewhere caused the path-traversal guard to 403 every
 * reader request because the resulting Library row's `path` had no overlap
 * with the on-disk filePaths.
 *
 * Local dev: keeps the legacy LIBRARIES_DIR-relative path so the
 * project-root data/ tree stays self-contained.
 *
 * @param {string} name - Library name
 * @returns {string} Default path for the library
 */
export function getDefaultLibraryPath(name: string): string {
  const safeName = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  if (isDocker) {
    return path.join('/library', safeName);
  }
  return path.join(LIBRARIES_DIR, safeName);
}
/**
 * Gets the default download path
 *
 * @returns {string} Path to the downloads directory
 */
export function getDownloadPath(): string {
  return DOWNLOADS_DIR;
}
/**
 * Resolves a library path
 * If the path is relative, resolves it relative to the libraries directory
 * If the path is absolute, returns it unchanged
 *
 * @param {string} inputPath - Path to resolve
 * @returns {string} Resolved absolute path
 */
export function resolveLibraryPath(inputPath: string): string {
  if (path.isAbsolute(inputPath)) {
    return inputPath;
  }
  // If it's a relative path, resolve it relative to the libraries directory
  return path.join(LIBRARIES_DIR, inputPath);
}