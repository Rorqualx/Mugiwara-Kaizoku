/**
 * Backup Restore Operations Module
 *
 * Handles restoration of system state from backup archives.
 * Supports database, configuration, and media file restoration.
 *
 * Extracted from: backup/index.ts (lines 670-901)
 *
 * @module server/services/backup/restore
 */

import * as fs from 'fs/promises';
import * as path from 'path';


import { BackupContent, BackupStatus } from '@prisma/client';

import { prisma } from '@/server/db';
import { ValidationError } from '@/utils/errors';
import { logger } from '@/utils/logger';


import { eventEmitter } from '../eventEmitter';
import { EventSource, EventType } from '../events/eventTypes';
import { realtimeEmitter } from '../realtime/RealtimeEventEmitter';

import { getDatabaseConfig } from './config';
import { backupConfig, execFileAsync } from './utils';

// ============================================================================
// Constants
// ============================================================================

/**
 * Allowlist of config files that can be restored
 * Any file not in this list will be skipped during restoration
 */
// .env files are intentionally absent from this allowlist — see the matching
// comment in createConfigBackup (utils.ts). Restoring an OLD backup that
// still contains .env entries will log
//   "Skipping unauthorized config file during restore: .env"
// for each one and continue. The operator must source .env from the
// secrets-source-of-truth, not from a tar archive.
const ALLOWED_CONFIG_FILES = new Set([
  'next.config.mjs',
  'tailwind.config.mjs',
  'tsconfig.json',
  'package.json',
]);

// ============================================================================
// Process-wide Restore Lock
// ============================================================================

// Restore is destructive (pg_restore truncates+repopulates, config files
// overwrite root-dir files, media files extract to disk) and uses temp
// directories under process.cwd(). This codebase runs a single Node process,
// so a module-level boolean is sufficient — concurrent restoreBackup or
// restoreFromFile calls reject immediately with ValidationError rather than
// queue. Combined with mkdtemp-per-call temp dirs below, this defends against
// both intentional concurrency and orphan temp dirs from a previous run.
let restoreInProgress = false;

// Exported for tests; not part of the public API. Production code goes
// through restoreBackup / restoreFromFile which call these internally.
export function acquireRestoreLock(operation: string): void {
  if (restoreInProgress) {
    throw new ValidationError(
      `Cannot start ${operation}: another restore is already in progress`
    );
  }
  restoreInProgress = true;
}

export function releaseRestoreLock(): void {
  restoreInProgress = false;
}

export function isRestoreInProgress(): boolean {
  return restoreInProgress;
}

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * Database configuration for restore operations
 */
interface DatabaseConfig {
  host: string;
  port: string;
  username: string;
  password: string;
  database: string;
}

// ============================================================================
// Security Helper Functions
// ============================================================================

/**
 * Validate Extracted Archive Contents
 *
 * Recursively validates that extracted files don't contain path traversal attempts.
 * Checks for '..' in paths and absolute paths.
 *
 * @param extractDir - Directory containing extracted files
 * @throws ValidationError if path traversal detected
 */
async function validateExtractedPaths(extractDir: string): Promise<void> {
  const files = await fs.readdir(extractDir, { recursive: true });

  for (const file of files) {
    // Check for path traversal attempts
    if (file.includes('..') || path.isAbsolute(file)) {
      throw new ValidationError('Archive contains path traversal attempts');
    }

    // Ensure file is within the extract directory
    const fullPath = path.join(extractDir, file);
    const resolved = path.resolve(fullPath);
    const resolvedExtractDir = path.resolve(extractDir);

    if (!resolved.startsWith(resolvedExtractDir)) {
      throw new ValidationError('Archive contains files outside extraction directory');
    }
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Restore Database from Directory
 *
 * Restores PostgreSQL database from a backup dump file.
 *
 * @param restoreDir - Directory containing the extracted backup
 * @throws Error if database restoration fails
 */
async function restoreDatabaseFromDir(restoreDir: string): Promise<void> {
  const dbBackupPath = path.join(restoreDir, 'database.dump');

  // Get database configuration
  const dbConfig = getDatabaseConfig(backupConfig);
  if (!dbConfig) {
    throw new ValidationError('Cannot restore database: DATABASE_URL is not configured');
  }

  // Type assertion after validation
  const config = dbConfig as DatabaseConfig;

  // Restore database with safe argument array
  await execFileAsync(
    'pg_restore',
    [
      '-h', config.host,
      '-p', config.port,
      '-U', config.username,
      '-d', config.database,
      '-c', dbBackupPath
    ],
    {
      env: { ...process.env, PGPASSWORD: config.password }
    }
  );

  // Emit WebSocket event for database restore stage complete
  void realtimeEmitter.emitSystemEvent({
    eventType: 'restore:stage:completed',
    source: 'restoreService',
    message: 'Database restored successfully',
    data: { stage: 'database' }
  });

  logger.info('Database restored successfully');
}

/**
 * Restore Configuration from Directory
 *
 * Restores configuration files from backup archive.
 * Uses Promise.all for parallel file copying to avoid no-await-in-loop.
 *
 * @param restoreDir - Directory containing the extracted backup
 * @throws Error if configuration restoration fails
 */
async function restoreConfigFromDir(restoreDir: string): Promise<void> {
  const configBackupPath = path.join(restoreDir, 'config.tar.gz');
  const configExtractDir = path.join(restoreDir, 'config');

  await fs.mkdir(configExtractDir, {
    recursive: true,
  });

  // Extract config files with safe argument array
  await execFileAsync('tar', ['-xzf', configBackupPath, '-C', configExtractDir]);

  // Copy config files back to root directory using Promise.all
  const configFiles = await fs.readdir(configExtractDir);

  // Filter to only allow known config files (security: prevent arbitrary file restoration)
  const validConfigFiles = configFiles.filter((file) => {
    if (!ALLOWED_CONFIG_FILES.has(file)) {
      logger.warn(`Skipping unauthorized config file during restore: ${file}`);
      return false;
    }
    return true;
  });

  await Promise.all(
    validConfigFiles.map(async (file) => {
      const sourcePath = path.join(configExtractDir, file);
      const destPath = path.join(process.cwd(), file);
      await fs.copyFile(sourcePath, destPath);
      logger.info(`Restored config file: ${file}`);
    })
  );

  // Emit WebSocket event for config restore stage complete
  void realtimeEmitter.emitSystemEvent({
    eventType: 'restore:stage:completed',
    source: 'restoreService',
    message: 'Configuration restored successfully',
    data: { stage: 'config', fileCount: validConfigFiles.length }
  });
}

/**
 * Restore Media Files from Directory
 *
 * Restores media files from backup archive to a sandboxed location.
 * SECURITY: Never extracts directly to root to prevent path traversal attacks.
 *
 * @param restoreDir - Directory containing the extracted backup
 * @throws Error if media restoration fails
 */
async function restoreMediaFromDir(restoreDir: string): Promise<void> {
  const mediaBackupPath = path.join(restoreDir, 'media.tar.gz');

  // Unique sandbox per call (defense-in-depth on top of acquireRestoreLock).
  // The sandbox is intentionally not cleaned up on success — files are left
  // for the operator to manually validate and move (logged below).
  const sandboxDir = await fs.mkdtemp(path.join(process.cwd(), 'temp_media_restore_'));

  try {
    // Extract media files to sandboxed location with safe argument array
    await execFileAsync('tar', ['-xzf', mediaBackupPath, '-C', sandboxDir]);

    // Emit WebSocket event for media restore stage complete
    void realtimeEmitter.emitSystemEvent({
      eventType: 'restore:stage:completed',
      source: 'restoreService',
      message: 'Media files restored to sandbox',
      data: { stage: 'media', sandboxDir }
    });

    logger.info('Media files restored successfully to sandbox directory');
    logger.warn(`MANUAL ACTION REQUIRED: Validate and move files from ${sandboxDir} to their destination`);
  } catch (error: unknown) {
    // Clean up sandbox on error
    await fs.rm(sandboxDir, { recursive: true, force: true });
    throw error;
  }
}

/**
 * Restore Configuration from File
 *
 * Restores configuration files from an uploaded backup file.
 * Uses Promise.all for parallel file copying to avoid no-await-in-loop.
 *
 * @param restoreDir - Directory containing the extracted backup
 * @throws Error if configuration restoration fails
 */
async function restoreConfigFromFile(restoreDir: string): Promise<void> {
  const configBackupPath = path.join(restoreDir, 'config.tar.gz');
  const configExtractDir = path.join(restoreDir, 'config');

  await fs.mkdir(configExtractDir, {
    recursive: true,
  });

  // Extract config files with safe argument array
  await execFileAsync('tar', ['-xzf', configBackupPath, '-C', configExtractDir]);

  // Copy config files back to root directory using Promise.all
  const configFiles = await fs.readdir(configExtractDir);

  // Filter to only allow known config files (security: prevent arbitrary file restoration)
  const validConfigFiles = configFiles.filter((file) => {
    if (!ALLOWED_CONFIG_FILES.has(file)) {
      logger.warn(`Skipping unauthorized config file during restore: ${file}`);
      return false;
    }
    return true;
  });

  await Promise.all(
    validConfigFiles.map(async (file) => {
      const sourcePath = path.join(configExtractDir, file);
      const destPath = path.join(process.cwd(), file);
      await fs.copyFile(sourcePath, destPath);
      logger.info(`Restored config file: ${file}`);
    })
  );
}

// ============================================================================
// Restore from Backup ID
// ============================================================================

/**
 * Restore from Backup
 *
 * Restores system state from a backup archive identified by database ID.
 * Handles database, configuration, and media file restoration.
 *
 * @param id - Backup database ID
 * @returns True if restore successful
 * @throws ValidationError if backup not found or incomplete
 * @throws Error if restore operation fails
 *
 * @example
 * ```typescript
 * const restored = await restoreBackup(42);
 * if (restored) {
 *   logger.info('System restored from backup');
 * }
 * ```
 */
export async function restoreBackup(id: number): Promise<boolean> {
  acquireRestoreLock('restoreBackup');
  try {
    const backup = await prisma.backup.findUnique({
      where: {
        id,
      },
    });

    if (!backup) {
      throw new ValidationError(`Backup with ID ${id} not found`);
    }

    // Type guard for backup status
    if (backup.status !== BackupStatus.COMPLETED) {
      throw new ValidationError(`Cannot restore from incomplete backup (status: ${backup.status})`);
    }

    // Unique temp dir per call (defense-in-depth on top of the restore lock)
    const restoreDir = await fs.mkdtemp(path.join(process.cwd(), 'temp_restore_'));

    try {
      // Extract the backup archive with safe argument array
      await execFileAsync('tar', ['-xzf', backup.path, '-C', restoreDir]);

      // Validate extracted paths to prevent directory traversal attacks
      await validateExtractedPaths(restoreDir);

      // Restore database if included
      if (backup.contents.includes(BackupContent.DATABASE)) {
        await restoreDatabaseFromDir(restoreDir);
      }

      // Restore configuration if included
      if (backup.contents.includes(BackupContent.CONFIGURATION)) {
        await restoreConfigFromDir(restoreDir);
      }

      // Restore media files if included
      if (backup.contents.includes(BackupContent.MEDIA_FILES)) {
        await restoreMediaFromDir(restoreDir);
      }

      // Emit backup restored notification
      await eventEmitter.emitWithTracking({
        type: EventType.BACKUP_RESTORED,
        source: EventSource.SYSTEM,
        metadata: {
          backupId: backup.id,
          backupName: backup.name,
          restoredContents: backup.contents,
          size: backup.size,
        },
      });

      // Emit WebSocket event for restore completed
      void realtimeEmitter.emitSystemEvent({
        eventType: 'restore:completed',
        source: 'restoreService',
        message: `Backup ${backup.name} restored successfully`,
        data: {
          backupId: backup.id,
          backupName: backup.name,
          restoredContents: backup.contents,
          size: backup.size
        }
      });

      logger.info(`Backup ${backup.name} restored successfully`);
      return true;
    } finally {
      // Clean up temporary directory
      await fs.rm(restoreDir, {
        recursive: true,
        force: true,
      });
    }
  } catch (error: unknown) {
    logger.error(`Failed to restore backup ${id}: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  } finally {
    releaseRestoreLock();
  }
}

// ============================================================================
// Restore from File Path
// ============================================================================

/**
 * Restore from File
 *
 * Restores system state from an uploaded backup file.
 * Similar to restoreBackup but works with file paths instead of database IDs.
 *
 * @param filePath - Path to the backup file
 * @returns True if restore successful
 * @throws ValidationError if backup file not found
 * @throws Error if restore operation fails
 *
 * @example
 * ```typescript
 * const restored = await restoreFromFile('/path/to/backup.tar.gz');
 * if (restored) {
 *   logger.info('System restored successfully');
 * }
 * ```
 */
export async function restoreFromFile(filePath: string): Promise<boolean> {
  acquireRestoreLock('restoreFromFile');
  try {
    // Validate file exists
    try {
      await fs.access(filePath);
    } catch {
      throw new ValidationError(`Backup file not found: ${filePath}`);
    }

    // Unique temp dir per call (defense-in-depth on top of the restore lock)
    const restoreDir = await fs.mkdtemp(path.join(process.cwd(), 'temp_restore_file_'));

    try {
      // Extract the backup archive with safe argument array
      await execFileAsync('tar', ['-xzf', filePath, '-C', restoreDir]);

      // Check what contents are in the backup
      const files = await fs.readdir(restoreDir);

      // Restore database if included
      if (files.includes('database.dump')) {
        const dbBackupPath = path.join(restoreDir, 'database.dump');

        // Get database configuration
        const dbConfig = getDatabaseConfig(backupConfig);
        if (!dbConfig) {
          throw new ValidationError('Cannot restore database: DATABASE_URL is not configured');
        }

        // Type assertion after validation
        const config = dbConfig as DatabaseConfig;

        // Restore database with safe argument array
        await execFileAsync(
          'pg_restore',
          [
            '-h', config.host,
            '-p', config.port,
            '-U', config.username,
            '-d', config.database,
            '-c', dbBackupPath
          ],
          {
            env: { ...process.env, PGPASSWORD: config.password }
          }
        );

        logger.info('Database restored successfully from file');
      }

      // Restore configuration if included
      if (files.includes('config.tar.gz')) {
        await restoreConfigFromFile(restoreDir);
      }

      // Restore media files if included
      if (files.includes('media.tar.gz')) {
        const mediaBackupPath = path.join(restoreDir, 'media.tar.gz');

        // Unique sandbox per call. Like restoreMediaFromDir, the sandbox is
        // intentionally not cleaned up on success — operator must manually
        // validate and move the files.
        const sandboxDir = await fs.mkdtemp(path.join(process.cwd(), 'temp_media_restore_file_'));

        try {
          // Extract media files to sandboxed location with safe argument array
          await execFileAsync('tar', ['-xzf', mediaBackupPath, '-C', sandboxDir]);

          // Validate extracted paths to prevent directory traversal
          await validateExtractedPaths(sandboxDir);

          logger.info('Media files restored successfully to sandbox directory');
          logger.warn(`MANUAL ACTION REQUIRED: Validate and move files from ${sandboxDir} to their destination`);
        } catch (error: unknown) {
          // Clean up sandbox on error
          await fs.rm(sandboxDir, { recursive: true, force: true });
          throw error;
        }
      }

      // Emit WebSocket event for file restore completed
      void realtimeEmitter.emitSystemEvent({
        eventType: 'restore:file:completed',
        source: 'restoreService',
        message: 'Restore from file completed successfully',
        data: {
          filePath,
          restoredContents: files
        }
      });

      return true;
    } finally {
      // Clean up temporary directory
      await fs.rm(restoreDir, {
        recursive: true,
        force: true,
      });
    }
  } catch (error: unknown) {
    // Emit WebSocket event for restore failed
    void realtimeEmitter.emitSystemEvent({
      eventType: 'restore:failed',
      source: 'restoreService',
      message: `Restore from file failed: ${error instanceof Error ? error.message : String(error)}`,
      data: {
        filePath,
        error: error instanceof Error ? error.message : String(error)
      }
    });

    logger.error(`Failed to restore from file ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  } finally {
    releaseRestoreLock();
  }
}
