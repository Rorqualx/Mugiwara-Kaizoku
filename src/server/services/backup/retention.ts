/**
 * Backup Retention Policy Module
 *
 * Manages backup retention based on age and count limits.
 * Automatically removes old or excess backups.
 *
 * Extracted from: backup/index.ts (lines 593-651)
 *
 * @module server/services/backup/retention
 */

import * as fs from 'fs/promises';


import { BackupStatus, Prisma } from '@prisma/client';

import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';


import { getGeneralConfigService } from '../config/generalConfigService';
import { getGlobalConfigService } from '../config/globalConfigService';

import { backupConfig } from './utils';

/**
 * Helper for transaction-aware backup deletion
 * Deletes a backup record from the database within a transaction context.
 * Returns the file path for deletion AFTER the transaction commits.
 *
 * SECURITY: File deletion happens AFTER database transaction succeeds to ensure
 * consistency. If file deletion fails, the record is already gone (orphaned files
 * are less problematic than orphaned database records pointing to deleted files).
 *
 * @param tx - Prisma transaction client
 * @param id - Backup ID to delete
 * @returns The file path to delete after transaction commits, or null if no file
 */
async function deleteBackupWithTx(tx: Prisma.TransactionClient, id: number): Promise<string | null> {
  const backup = await tx.backup.findUnique({ where: { id } });
  const pathToDelete = backup?.path ?? null;

  // Delete backup items first (foreign key constraint)
  await tx.backupItem.deleteMany({
    where: { backupId: id },
  });

  // Delete the backup record
  await tx.backup.delete({ where: { id } });

  // Return path for file deletion after transaction commits
  return pathToDelete;
}

/**
 * Delete old backups that exceed retention age
 * @returns Array of file paths to delete after transaction commits
 */
async function deleteOldBackups(
  tx: Prisma.TransactionClient,
  retentionDays: number
): Promise<string[]> {
  if (retentionDays <= 0) return [];

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  const oldBackups = await tx.backup.findMany({
    where: { createdAt: { lt: cutoffDate }, status: BackupStatus.COMPLETED },
  });

  const paths: string[] = [];
  for (const backup of oldBackups) {
    // eslint-disable-next-line no-await-in-loop -- Sequential execution required within transaction
    const pathToDelete = await deleteBackupWithTx(tx, backup.id);
    if (pathToDelete) paths.push(pathToDelete);
    logger.info(`Deleted old backup ${backup.name} (age: ${retentionDays}+ days)`);
  }
  return paths;
}

/**
 * Delete excess backups that exceed max count
 * @returns Array of file paths to delete after transaction commits
 */
async function deleteExcessBackups(
  tx: Prisma.TransactionClient,
  maxCount: number
): Promise<string[]> {
  if (maxCount <= 0) return [];

  const backups = await tx.backup.findMany({
    where: { status: BackupStatus.COMPLETED },
    orderBy: { createdAt: 'desc' },
  });

  if (backups.length <= maxCount) return [];

  const paths: string[] = [];
  const backupsToDelete = backups.slice(maxCount);
  for (const backup of backupsToDelete) {
    // eslint-disable-next-line no-await-in-loop -- Sequential execution required within transaction
    const pathToDelete = await deleteBackupWithTx(tx, backup.id);
    if (pathToDelete) paths.push(pathToDelete);
    logger.info(`Deleted excess backup ${backup.name} (keeping ${maxCount} most recent)`);
  }
  return paths;
}

/**
 * Delete backup files after transaction commits
 * Logs warnings for any failed deletions but continues processing
 */
async function deleteBackupFiles(paths: string[]): Promise<void> {
  for (const filePath of paths) {
    try {
      // eslint-disable-next-line no-await-in-loop -- Sequential file deletion for logging accuracy
      await fs.unlink(filePath);
      logger.info(`Deleted backup file: ${filePath}`);
    } catch (err: unknown) {
      logger.warn(`Failed to delete backup file ${filePath}`, { error: err });
    }
  }
}

/**
 * Enforce Backup Retention Policy
 *
 * Manages backup retention based on age and count limits.
 * Deletes backups that exceed retention age or maximum count.
 * Uses database transaction to ensure atomic operations.
 *
 * @returns Promise resolving to true on success
 * @throws Error if retention policy enforcement fails
 */
export async function enforceRetentionPolicy(): Promise<boolean> {
  try {
    const configService = getGlobalConfigService();
    const generalConfigService = getGeneralConfigService(configService);
    const backupSettings = await generalConfigService.getBackupSettings();

    const retentionDays = backupConfig.BACKUP_RETENTION_DAYS;
    const maxCount = backupSettings.maxBackups;

    // Collect file paths to delete AFTER transaction commits
    let pathsToDelete: string[] = [];

    await prisma.$transaction(async (tx) => {
      const oldPaths = await deleteOldBackups(tx, retentionDays);
      const excessPaths = await deleteExcessBackups(tx, maxCount);
      pathsToDelete = [...oldPaths, ...excessPaths];
    });

    // Delete files AFTER transaction commits successfully
    await deleteBackupFiles(pathsToDelete);

    return true;
  } catch (error: unknown) {
    logger.error(`Failed to enforce backup retention policy`, { error });
    throw error;
  }
}
