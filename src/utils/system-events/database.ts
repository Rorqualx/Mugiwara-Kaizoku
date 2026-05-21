/**
 * Database Event Logging Functions
 *
 * Logging functions for database connection, errors, backups,
 * and restoration events.
 *
 * Extracted from: systemEvents.ts
 */

import { emitEvent } from '../eventEmitter';

/**
 * Logs a database connection event
 * Emits an info event when database connection is established
 *
 * @example
 * ```ts
 * logDatabaseConnection();
 * // Emits: "Connected to database"
 * ```
 */
export function logDatabaseConnection(): void {
  emitEvent('info', 'Connected to database', 'Database', {
    details: { message: 'Successfully established connection to the database.' }
  });
}

/**
 * Logs a database error event
 * Emits an error event when a database operation fails
 *
 * @param {string} error - Brief error message
 * @param {string} [errorDetails] - Detailed error information
 *
 * @example
 * ```ts
 * logDatabaseError("Query failed", "Error: relation 'manga' does not exist");
 * ```
 */
export function logDatabaseError(error: string, errorDetails?: string): void {
  emitEvent('error', `Database error: ${error}`, 'Database', {
    details: { message: 'An error occurred while interacting with the database.' },
    errorDetails: errorDetails ?? error,
    actions: [
      { label: 'View System Status', action: 'navigate', url: '/system/status' }
    ]
  });
}

/**
 * Logs a database backup event
 * Emits a success event when a database backup is completed
 *
 * @param {string} path - Path where the backup was saved
 *
 * @example
 * ```ts
 * logDatabaseBackup("/backups/db_20250311.bak");
 * ```
 */
export function logDatabaseBackup(path: string): void {
  emitEvent('success', `Database backup completed: ${path}`, 'Database', {
    details: { message: `A database backup has been created at ${path}.` },
    actions: [
      { label: 'View Backups', action: 'navigate', url: '/system/backup' }
    ]
  });
}

/**
 * Logs database disconnection
 * Emits a warning event when database connection is lost
 *
 * @example
 * ```ts
 * logDatabaseDisconnected();
 * // Emits: "Database connection lost"
 * ```
 */
export function logDatabaseDisconnected(): void {
  emitEvent(
    'warning',
    'Database connection lost',
    'Database',
    {
      details: {
        type: 'database_disconnected'
      }
    }
  );
}

/**
 * Logs database reconnection
 * Emits a success event when database connection is restored
 *
 * @example
 * ```ts
 * logDatabaseReconnected();
 * // Emits: "Database connection restored"
 * ```
 */
export function logDatabaseReconnected(): void {
  emitEvent(
    'success',
    'Database connection restored',
    'Database',
    {
      details: {
        type: 'database_reconnected'
      }
    }
  );
}

/**
 * Logs backup restoration
 * Emits a success event when a backup is successfully restored
 *
 * @param {string} backupFile - Backup file name
 * @param {Date} backupDate - Date of the backup
 *
 * @example
 * ```ts
 * logBackupRestored("db_backup_20250315.bak", new Date('2025-03-15'));
 * ```
 */
export function logBackupRestored(backupFile: string, backupDate: Date): void {
  emitEvent(
    'success',
    `Backup restored: ${backupFile} from ${backupDate.toLocaleDateString()}`,
    'System',
    {
      details: {
        type: 'backup_restored',
        backupFile,
        backupDate: backupDate.toISOString()
      }
    }
  );
}

/**
 * Logs backup retention policy application
 * Emits an info event when backup retention policy is applied
 *
 * @param {number} deletedCount - Number of old backups deleted
 * @param {number} retainedCount - Number of backups retained
 *
 * @example
 * ```ts
 * logBackupRetentionApplied(5, 10);
 * // Emits: "Backup retention applied: 5 deleted, 10 retained"
 * ```
 */
export function logBackupRetentionApplied(deletedCount: number, retainedCount: number): void {
  emitEvent(
    'info',
    `Backup retention applied: ${deletedCount} deleted, ${retainedCount} retained`,
    'System',
    {
      details: {
        type: 'backup_retention_applied',
        deletedCount,
        retainedCount
      }
    }
  );
}
