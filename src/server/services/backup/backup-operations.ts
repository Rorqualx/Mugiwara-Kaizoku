/**
 * Backup Operations Module
 *
 * Basic CRUD operations for backup management: listing, retrieving,
 * and deleting backups with proper database and file system cleanup.
 *
 * Extracted from: backup/index.ts (lines 485-577)
 */

import * as fs from 'fs/promises';

import { prisma } from '@/server/db';
import { ValidationError } from '@/utils/errors';
import { logger } from '@/utils/logger';

// ============================================================================
// List Backups
// ============================================================================

/**
 * List All Backups
 *
 * Retrieves a list of all backups ordered by creation date (newest first).
 *
 * @returns {Promise<unknown[]>} Array of backup records
 * @throws {Error} If backup listing fails
 *
 * @example
 * ```typescript
 * const backups = await listBackups();
 * logger.info(`Found ${backups.length} backups`);
 * ```
 */
export async function listBackups(): Promise<unknown[]> {
  try {
    return await prisma.backup.findMany({
      orderBy: {
        createdAt: 'desc'
      }
    });
  } catch (error: unknown) {
    logger.error(`Failed to list backups: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

// ============================================================================
// Get Backup
// ============================================================================

/**
 * Get Backup Details
 *
 * Retrieves detailed information about a specific backup.
 *
 * @param {number} id - Backup ID
 * @returns {Promise<unknown>} Backup record or null if not found
 * @throws {Error} If backup retrieval fails
 *
 * @example
 * ```typescript
 * const backup = await getBackup(123);
 * if (backup) {
 *   logger.info(`Backup size: ${backup.size} bytes`);
 * }
 * ```
 */
export async function getBackup(id: number): Promise<unknown> {
  try {
    return await prisma.backup.findUnique({
      where: {
        id
      }
    });
  } catch (error: unknown) {
    logger.error(`Failed to get backup ${id}: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

// ============================================================================
// Delete Backup
// ============================================================================

/**
 * Delete Backup
 *
 * Removes a backup and its associated files.
 * Handles both database record and file system cleanup.
 * Uses database transaction to ensure atomic operations.
 *
 * @param {number} id - Backup ID to delete
 * @returns {Promise<boolean>} True if deletion successful
 * @throws {ValidationError} If backup with given ID is not found
 * @throws {Error} If backup deletion fails
 *
 * @example
 * ```typescript
 * const deleted = await deleteBackup(123);
 * if (deleted) {
 *   logger.info('Backup removed successfully');
 * }
 * ```
 */
export async function deleteBackup(id: number): Promise<boolean> {
  try {
    // Capture the path inside the tx and return it; defer file deletion
    // until AFTER the tx commits. Previously fs.unlink ran first inside the
    // tx — if a subsequent DB step (deleteMany, delete) threw, the tx rolled
    // back but the file was already gone, leaving an orphaned row pointing
    // at a deleted file. Same pattern used by retention.ts.
    const pathToDelete = await prisma.$transaction(async (tx): Promise<string | null> => {
      const backup = await tx.backup.findUnique({
        where: { id },
        include: { items: true },
      });

      if (!backup) {
        throw new ValidationError(`Backup with ID ${id} not found`);
      }

      // Delete backup items (cascade should handle this, but be explicit)
      await tx.backupItem.deleteMany({
        where: { backupId: id },
      });

      // Delete the backup record
      await tx.backup.delete({
        where: { id },
      });

      // Empty string path is treated as "no file to delete"; matches the
      // original deleteBackup behavior and the path: '' default for
      // IN_PROGRESS rows that never reached COMPLETED.
      return backup.path === '' ? null : backup.path;
    });

    // Tx committed. Best-effort file deletion. A failure here leaves an
    // orphaned file but no orphaned DB row — strictly better than the
    // inverse, since the user-visible "the backup is gone" state holds.
    if (pathToDelete !== null) {
      try {
        await fs.unlink(pathToDelete);
      } catch (err: unknown) {
        logger.warn(`Failed to delete backup file ${pathToDelete}`, { error: err });
      }
    }

    return true;
  } catch (error: unknown) {
    logger.error(`Failed to delete backup ${id}`, { error });
    throw error;
  }
}
