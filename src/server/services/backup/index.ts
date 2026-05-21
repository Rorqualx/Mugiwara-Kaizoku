/**
 * Backup Service - Main Aggregator
 *
 * This module aggregates all backup-related sub-modules into a single
 * unified service interface. All functions are re-exported for backward
 * compatibility.
 *
 * Architecture:
 * - backup/utils.ts - Shared utilities, types, constants (301 lines)
 * - backup/backup-creation.ts - Main backup creation (521 lines)
 * - backup/backup-operations.ts - List, get, delete operations (137 lines)
 * - backup/retention.ts - Retention policy enforcement (94 lines)
 * - backup/restore.ts - Restore from backup/file (347 lines)
 * - backup/scheduling.ts - Task scheduling (69 lines)
 *
 * Total: 8 functions across 6 modules
 *
 * Original file: 918 lines -> Refactored: ~80 lines (91% reduction in main file)
 */

// Re-export all backup functions
export { createBackup } from './backup-creation';
export { listBackups, getBackup, deleteBackup } from './backup-operations';
export { enforceRetentionPolicy } from './retention';
export { restoreBackup, restoreFromFile } from './restore';
export { scheduleBackup } from './scheduling';

// Re-export types from utils
export type { ProgressEmitter } from './utils';

// Import for service object
import { createBackup } from './backup-creation';
import { listBackups, getBackup, deleteBackup } from './backup-operations';
import { restoreBackup, restoreFromFile } from './restore';
import { enforceRetentionPolicy } from './retention';
import { scheduleBackup } from './scheduling';

/**
 * Backup Service Object
 *
 * Provides a unified interface for all backup operations.
 * Maintains backward compatibility with existing code using
 * backupService.methodName() pattern.
 *
 * Functions:
 * - createBackup: Create full system backup
 * - listBackups: List all backups
 * - getBackup: Get backup by ID
 * - deleteBackup: Delete backup and files
 * - enforceRetentionPolicy: Apply retention rules
 * - restoreBackup: Restore from backup ID
 * - restoreFromFile: Restore from file path
 * - scheduleBackup: Schedule backup task
 */
export const backupService = {
  createBackup,
  listBackups,
  getBackup,
  deleteBackup,
  enforceRetentionPolicy,
  restoreBackup,
  restoreFromFile,
  scheduleBackup,
};

export default backupService;
