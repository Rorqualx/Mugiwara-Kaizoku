/**
 * File Operations Module
 *
 * Handles file system operations for the parser migration system.
 * Includes recursive copy, scanning, and backup functionality.
 *
 * Extracted from: MigrationScript.ts (lines 139-173, 421-462)
 *
 * @module parsers/migration/file-operations
 */

import * as fs from 'fs/promises';
import * as path from 'path';

import type { MigrationConfig } from './types';

// ============================================================================
// Directory Operations
// ============================================================================

/**
 * Copy directory recursively
 *
 * Copies all files and subdirectories from source to destination.
 * Creates destination directory if it doesn't exist.
 *
 * @param src - Source directory path
 * @param dest - Destination directory path
 * @throws Error if source directory cannot be read
 *
 * @example
 * await copyDirectory('/path/to/source', '/path/to/backup');
 */
export async function copyDirectory(src: string, dest: string): Promise<void> {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });

  // Parallel copying of all entries (directories and files)
  await Promise.all(
    entries.map(async (entry) => {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        await copyDirectory(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    })
  );
}

/**
 * Scan directory recursively with callback
 *
 * Traverses directory tree and executes callback for each file encountered.
 * Skips hidden directories, node_modules, and other common exclusions.
 *
 * @param dir - Directory path to scan
 * @param callback - Async function called for each file
 * @throws Does not throw - silently handles missing directories
 *
 * @example
 * await scanDirectory('/path/to/source', async (filePath) => {
 *   if (filePath.endsWith('.ts')) {
 *     console.log('Found TypeScript file:', filePath);
 *   }
 * });
 */
export async function scanDirectory(
  dir: string,
  callback: (filePath: string) => Promise<void>
): Promise<void> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    // Process directories and files in parallel
    await Promise.all(
      entries.map(async (entry) => {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          await scanDirectory(fullPath, callback);
        } else if (entry.isFile()) {
          await callback(fullPath);
        }
      })
    );
  } catch (_error: unknown) {
    // Directory might not exist - silently skip
  }
}

// ============================================================================
// Backup Operations
// ============================================================================

/**
 * Backup existing parser files
 *
 * Creates timestamped backup of parser directories before migration.
 * Backs up:
 * - src/server/parsers
 * - src/api/metadataProviders
 * - src/utils/parsers
 *
 * @param config - Migration configuration (affects dry-run behavior)
 * @param log - Log array for recording backup operations
 * @returns Path to backup directory or 'dry-run-backup' if dry-run mode
 * @throws Error if backup directory cannot be created
 *
 * @example
 * const log: string[] = [];
 * const backupDir = await backupExistingParsers(config, log);
 * console.log('Backup created at:', backupDir);
 */
export async function backupExistingParsers(config: MigrationConfig, log: string[]): Promise<string> {
  if (config.dryRun) {
    log.push('[DRY RUN] Would backup existing parsers');
    return 'dry-run-backup';
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const baseBackupDir = config.backupDir ?? './backups';
  const backupDir = path.join(baseBackupDir, `backup-${timestamp}`);

  await fs.mkdir(backupDir, { recursive: true });

  const parserDirs = [
    'src/server/parsers',
    'src/api/metadataProviders',
    'src/utils/parsers',
  ];

  // Backup all directories in parallel
  const backupResults = await Promise.allSettled(
    parserDirs.map(async (dir) => {
      const srcDir = path.join(process.cwd(), dir);
      const destDir = path.join(backupDir, dir);

      await copyDirectory(srcDir, destDir);
      return { dir, destDir };
    })
  );

  // Log results
  for (const [index, result] of backupResults.entries()) {
    const dir = parserDirs[index];
    if (result.status === 'fulfilled') {
      log.push(`Backed up ${dir} to ${result.value.destDir}`);
    } else {
      log.push(`Failed to backup ${dir}: ${result.reason}`);
    }
  }

  return backupDir;
}
