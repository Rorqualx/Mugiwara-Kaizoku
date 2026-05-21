/**
 * Logging Operations Module
 *
 * Handles persistence of migration logs to disk.
 * Provides functionality to save migration execution details,
 * statistics, and results to a JSON log file.
 *
 * Extracted from: MigrationScript.ts (lines 488-507)
 *
 * @module parsers/migration/logging-operations
 */

import * as fs from 'fs/promises';

import type { MigrationConfig } from './types';

// ============================================================================
// Types
// ============================================================================

/**
 * Migration statistics for logging
 */
export interface MigrationStats {
  /** Total number of files processed */
  filesProcessed: number;

  /** Number of files successfully migrated */
  filesMigrated: number;

  /** Number of files skipped during migration */
  filesSkipped: number;

  /** List of errors encountered during migration */
  errors: Array<{ file: string; error: string }>;
}

/**
 * Complete log data structure
 */
interface LogData {
  /** Timestamp of migration execution */
  timestamp: string;

  /** Migration configuration used */
  config: MigrationConfig;

  /** Migration execution statistics */
  stats: MigrationStats;

  /** Detailed log messages */
  log: string[];
}

// ============================================================================
// Logging Operations
// ============================================================================

/**
 * Save migration log to disk
 *
 * Persists migration execution details to a JSON file for auditing
 * and debugging purposes. Skips saving in dry-run mode.
 *
 * @param config - Migration configuration
 * @param stats - Migration statistics
 * @param log - Log messages from migration execution
 * @returns Promise that resolves when log is saved
 *
 * @example
 * ```typescript
 * await saveMigrationLog(
 *   config,
 *   {
 *     filesProcessed: 10,
 *     filesMigrated: 8,
 *     filesSkipped: 2,
 *     errors: []
 *   },
 *   ['Starting migration...', 'Migration complete']
 * );
 * ```
 */
export async function saveMigrationLog(
  config: MigrationConfig,
  stats: MigrationStats,
  log: string[]
): Promise<void> {
  if (config.dryRun) {
    return;
  }

  const logData: LogData = {
    timestamp: new Date().toISOString(),
    config,
    stats,
    log,
  };

  const logPath = config.migrationLog ?? './migration-log.json';
  await fs.writeFile(logPath, JSON.stringify(logData, null, 2));
}
