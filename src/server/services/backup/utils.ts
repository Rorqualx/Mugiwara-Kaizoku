/**
 * Backup Utilities Module
 *
 * Shared helper functions, types, and constants used across all backup modules.
 * Handles file operations, database backups, and configuration archiving.
 *
 * Extracted from: backup/index.ts (lines 25-238)
 *
 * @module server/services/backup/utils
 */

import { execFile } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { promisify } from 'util';

import { prisma } from '@/server/db';
import { ValidationError } from '@/utils/errors';
import { logger } from '@/utils/logger';

import { getBackupConfigSingleton, getDatabaseConfig } from './config';

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * Progress emitter interface for backup progress tracking
 */
export interface ProgressEmitter {
  emitProgress: (id: string, progress: { stage: string; percentage: number; message: string }) => void;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Promisified execFile for async command execution with safe argument arrays
 */
export const execFileAsync = promisify(execFile);

/**
 * Singleton backup configuration instance
 */
export const backupConfig = getBackupConfigSingleton();

/**
 * Default backup directory from configuration
 */
export const DEFAULT_BACKUP_DIR = backupConfig.BACKUP_DIR;

// ============================================================================
// Progress Emitter
// ============================================================================

let backupProgressEmitter: unknown = null;

/**
 * Get Progress Emitter
 *
 * Dynamically imports the progress emitter to avoid circular dependencies.
 * Returns null if the emitter cannot be loaded.
 *
 * @returns Promise resolving to the progress emitter or null
 */
export async function getProgressEmitter(): Promise<ProgressEmitter | null> {
  if (!backupProgressEmitter) {
    try {
      const module = await import('../../../pages/api/backup/progress/[id]');
      backupProgressEmitter = module.backupProgressEmitter;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to load progress emitter:', errorMessage);
    }
  }

  // Type guard to ensure emitter has the expected shape
  if (
    backupProgressEmitter &&
    typeof backupProgressEmitter === 'object' &&
    'emitProgress' in backupProgressEmitter
  ) {
    return backupProgressEmitter as ProgressEmitter;
  }

  return null;
}

// ============================================================================
// Directory & Name Utilities
// ============================================================================

/**
 * Ensures Backup Directory Exists
 *
 * Creates the backup directory if it doesn't exist.
 * Handles path resolution and permissions.
 *
 * @param backupDir - Target backup directory path (defaults to DEFAULT_BACKUP_DIR)
 * @returns Resolved backup directory path
 * @throws Error if directory creation fails
 *
 * @example
 * ```typescript
 * const dir = await ensureBackupDir('/custom/backup/path');
 * ```
 */
export async function ensureBackupDir(backupDir: string = DEFAULT_BACKUP_DIR): Promise<string> {
  try {
    await fs.mkdir(backupDir, {
      recursive: true,
    });
    return backupDir;
  } catch (error: unknown) {
    logger.error(`Failed to create backup directory: ${error instanceof Error ? error.message : String(error)}`);
    throw new Error(`Failed to create backup directory: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Generate Unique Backup Name
 *
 * Creates a timestamped backup name with optional prefix.
 * Format: prefix_YYYYMMDD_HHMMSS
 *
 * @param prefix - Backup name prefix (defaults to 'backup')
 * @returns Generated backup name
 *
 * @example
 * ```typescript
 * const name = generateBackupName('daily');
 * // Returns: 'daily_20250311_150000'
 * ```
 */
export function generateBackupName(prefix = 'backup'): string {
  const now = new Date();
  const timestamp = now
    .toISOString()
    .replace(/:/g, '')
    .replace(/\..+/, '')
    .replace(/T/, '_')
    .replace(/-/g, '');
  return `${prefix}_${timestamp}`;
}

// ============================================================================
// Backup Creation Functions
// ============================================================================

/**
 * Create Database Backup
 *
 * Executes pg_dump to create a PostgreSQL database backup.
 * Handles connection details and credentials securely.
 *
 * @param outputPath - Path for the backup file
 * @returns Path to created backup file
 * @throws Error if database backup fails
 *
 * @example
 * ```typescript
 * const dbPath = await createDatabaseBackup('/backups/db.dump');
 * ```
 */
export async function createDatabaseBackup(outputPath: string): Promise<string> {
  try {
    const dbConfig = getDatabaseConfig(backupConfig);
    if (!dbConfig) {
      throw new ValidationError('Database backup requested but DATABASE_URL is not configured');
    }

    // Execute pg_dump with safe argument array
    await execFileAsync(
      'pg_dump',
      [
        '-h', dbConfig.host,
        '-p', dbConfig.port,
        '-U', dbConfig.username,
        '-d', dbConfig.database,
        '-F', 'c',
        '-f', outputPath
      ],
      {
        env: { ...process.env, PGPASSWORD: dbConfig.password }
      }
    );

    return outputPath;
  } catch (error: unknown) {
    logger.error(`Database backup failed: ${error instanceof Error ? error.message : String(error)}`);
    throw new Error(`Database backup failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Create Configuration Backup
 *
 * Archives configuration files including environment variables,
 * application settings, and project configuration.
 *
 * @param outputPath - Path for the backup archive
 * @returns Path to created backup file
 * @throws Error if configuration backup fails
 *
 * @example
 * ```typescript
 * const configPath = await createConfigBackup('/backups/config.tar.gz');
 * ```
 */
export async function createConfigBackup(outputPath: string): Promise<string> {
  try {
    // Create a tar.gz archive of configuration files.
    //
    // .env files are intentionally NOT included. They contain DATABASE_URL,
    // API keys, NEXTAUTH_SECRET — secrets that don't belong in a backup tar
    // that may be moved offsite, uploaded, or shared. Restore expects the
    // operator to recover .env from the secrets-source-of-truth (deployment
    // config, secrets manager, vault); see ALLOWED_CONFIG_FILES in restore.ts
    // which explicitly skips .env on the read side as defense-in-depth.
    const configFiles = [
      'next.config.mjs',
      'tailwind.config.mjs',
      'tsconfig.json',
      'package.json',
    ];

    // Create a temporary directory to store config files
    const tempDir = path.join(process.cwd(), 'temp_config_backup');
    await fs.mkdir(tempDir, {
      recursive: true,
    });

    // Copy config files in parallel. allSettled is used to avoid no-await-in-loop;
    // we then explicitly inspect each result so failures are surfaced rather than
    // silently swallowed. Previously each map fn did its own try/warn-continue,
    // which meant a backup with zero successfully-copied configs would still
    // produce an apparently-successful (empty) config.tar.gz.
    const results = await Promise.allSettled(
      configFiles.map(async (file) => {
        const filePath = path.join(process.cwd(), file);
        const destPath = path.join(tempDir, file);
        await fs.copyFile(filePath, destPath);
        return file;
      })
    );

    const succeeded: string[] = [];
    const failures: { file: string; reason: string }[] = [];
    results.forEach((result, i) => {
      const file = configFiles[i] ?? 'unknown';
      if (result.status === 'fulfilled') {
        succeeded.push(file);
      } else {
        const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
        failures.push({ file, reason });
      }
    });

    if (failures.length > 0) {
      logger.warn(
        `Config backup: ${succeeded.length}/${configFiles.length} files copied. ` +
        `Skipped: ${failures.map((f) => `${f.file} (${f.reason})`).join(', ')}`
      );
    }

    if (succeeded.length === 0) {
      // Clean up before throwing — every other early-exit cleans temp_config_backup.
      await fs.rm(tempDir, { recursive: true, force: true });
      throw new Error(
        `Configuration backup failed: 0 of ${configFiles.length} config files could be copied. ` +
        `Reasons: ${failures.map((f) => `${f.file} (${f.reason})`).join('; ')}`
      );
    }

    // Create tar.gz archive with safe argument array
    await execFileAsync('tar', ['-czf', outputPath, '-C', tempDir, '.']);

    // Clean up temp directory
    await fs.rm(tempDir, {
      recursive: true,
      force: true,
    });

    return outputPath;
  } catch (error: unknown) {
    logger.error(`Configuration backup failed: ${error instanceof Error ? error.message : String(error)}`);
    throw new Error(`Configuration backup failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Create Media Backup
 *
 * Archives manga library files and media content.
 * Handles large file operations and path resolution.
 *
 * @param outputPath - Path for the backup archive
 * @returns Path to created backup file (empty string if no libraries found)
 * @throws Error if media backup fails
 *
 * @example
 * ```typescript
 * const mediaPath = await createMediaBackup('/backups/media.tar.gz');
 * ```
 */
export async function createMediaBackup(outputPath: string): Promise<string> {
  try {
    // Get all library paths
    const libraries = await prisma.library.findMany();

    if (libraries.length === 0) {
      logger.warn('No libraries found for media backup');
      return '';
    }

    // Create a temporary file with library paths
    const tempPathsFile = path.join(process.cwd(), 'temp_library_paths.txt');

    // Extract and validate paths from libraries (security: prevent path traversal)
    const libraryPaths = libraries
      .map((lib) => lib.path)
      .filter((libPath) => {
        // Ensure path is absolute and doesn't contain traversal sequences
        if (!path.isAbsolute(libPath) || libPath.includes('..')) {
          logger.warn(`Skipping invalid library path during backup: ${libPath}`);
          return false;
        }
        return true;
      });

    if (libraryPaths.length === 0) {
      logger.warn('No valid library paths found for media backup');
      return '';
    }

    await fs.writeFile(tempPathsFile, libraryPaths.join('\n'));

    // Create tar.gz archive using the paths file with safe argument array
    await execFileAsync('tar', ['-czf', outputPath, '-T', tempPathsFile]);

    // Clean up temp file
    await fs.unlink(tempPathsFile);

    return outputPath;
  } catch (error: unknown) {
    logger.error(`Media backup failed: ${error instanceof Error ? error.message : String(error)}`);
    throw new Error(`Media backup failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// ============================================================================
// Path Security Utilities
// ============================================================================

/**
 * Validate Backup Filename
 *
 * Checks if a filename is valid for backup files.
 * Only allows alphanumeric characters, dash, underscore, and dot.
 * Must end with a valid backup extension.
 *
 * @param filename - Filename to validate
 * @returns True if filename is valid
 *
 * @example
 * ```typescript
 * isValidBackupFilename('backup_20250311.tar.gz'); // true
 * isValidBackupFilename('../../../etc/passwd'); // false
 * ```
 */
export function isValidBackupFilename(filename: string): boolean {
  // Only allow alphanumeric, dash, underscore, dot
  // Must end with valid extension
  return /^[\w-]+\.(tar\.gz|zip|dump|kbak)$/.test(filename);
}

/**
 * Sanitize Path
 *
 * Removes any directory traversal attempts from a path.
 * Extracts the basename and removes potentially dangerous characters.
 *
 * @param unsafePath - Unsanitized path
 * @returns Sanitized filename
 *
 * @example
 * ```typescript
 * sanitizePath('../../../etc/passwd'); // 'passwd'
 * sanitizePath('backup@2025.tar.gz'); // 'backup_2025.tar.gz'
 * ```
 */
export function sanitizePath(unsafePath: string): string {
  // Remove any directory traversal attempts
  return path.basename(unsafePath).replace(/[^a-zA-Z0-9._-]/g, '_');
}

/**
 * Validate Backup Path
 *
 * Validates that a backup path is within the allowed directory.
 * Prevents directory traversal attacks by:
 * 1. Validating filename characters
 * 2. Resolving the full path
 * 3. Verifying it's within the allowed directory
 * 4. Checking it's a regular file (not a symlink)
 *
 * @param inputPath - User-provided path or filename
 * @param allowedDir - Directory where backups are allowed
 * @returns Validated and resolved full path
 * @throws ValidationError if path is invalid or unsafe
 *
 * @example
 * ```typescript
 * const safePath = await validateBackupPath('backup.tar.gz', '/backups');
 * // Returns: '/backups/backup.tar.gz'
 *
 * await validateBackupPath('../../../etc/passwd', '/backups');
 * // Throws: ValidationError
 * ```
 */
export async function validateBackupPath(inputPath: string, allowedDir: string): Promise<string> {
  // Get the basename to prevent directory components
  const filename = path.basename(inputPath);

  // Validate filename characters (alphanumeric, dash, underscore, dot)
  if (!/^[\w\-.]+$/.test(filename)) {
    throw new ValidationError('Invalid characters in backup filename');
  }

  // Construct the full path
  const fullPath = path.resolve(allowedDir, filename);

  // Verify the resolved path is within allowed directory
  const resolvedAllowed = path.resolve(allowedDir);
  if (!fullPath.startsWith(resolvedAllowed + path.sep)) {
    throw new ValidationError('Path traversal detected');
  }

  // Verify file exists and is a regular file (not symlink)
  const stats = await fs.lstat(fullPath);
  if (!stats.isFile()) {
    throw new ValidationError('Invalid backup file type');
  }

  return fullPath;
}
