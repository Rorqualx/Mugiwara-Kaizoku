/**
 * Backup Creation Module
 *
 * Handles the main backup creation workflow including database dumps,
 * configuration archiving, and media file backups with progress tracking.
 *
 * Extracted from: backup/index.ts (lines 265-470)
 *
 * @module server/services/backup/backup-creation
 */

import * as fs from 'fs/promises';
import * as path from 'path';


import { BackupStatus, BackupType, BackupContent, Backup, Prisma } from '@prisma/client';

import { prisma } from '@/server/db';
import { ValidationError } from '@/utils/errors';
import { toStringId } from '@/utils/id-converters';
import { logger } from '@/utils/logger';


import { getGeneralConfigService } from '../config/generalConfigService';
import { getGlobalConfigService } from '../config/globalConfigService';
import { eventEmitter } from '../eventEmitter';
import { EventType, EventSource } from '../events/eventTypes';
import { realtimeEmitter } from '../realtime/RealtimeEventEmitter';

import { isValidBackupSize, BackupConfig } from './config';
import {
  execFileAsync,
  backupConfig,
  DEFAULT_BACKUP_DIR,
  getProgressEmitter,
  ensureBackupDir,
  generateBackupName,
  createDatabaseBackup,
  createConfigBackup,
  createMediaBackup,
  type ProgressEmitter,
} from './utils';

// ============================================================================
// Types
// ============================================================================

/**
 * Backup creation options
 */
interface BackupCreationOptions {
  name?: string;
  type?: BackupType;
  contents?: BackupContent[];
  notes?: string;
  backupDir?: string;
}

/**
 * Backup initialization result
 */
interface BackupInitResult {
  backup: Backup;
  emitter: ProgressEmitter | null;
  backupPath: string;
}

/**
 * Configuration for initializing a backup
 */
interface InitializeBackupConfig {
  name: string;
  type: BackupType;
  contents: BackupContent[];
  notes: string;
  backupDir: string;
}

/**
 * Backup stage context for progress tracking
 */
interface BackupStageContext {
  backup: Backup;
  emitter: ProgressEmitter | null;
  contents: BackupContent[];
  backupPath: string;
  progressIncrement: number;
}

/**
 * Parameters for finalizing backup
 */
interface FinalizeBackupParams {
  backup: Backup;
  emitter: ProgressEmitter | null;
  backupPath: string;
  finalBackupPath: string;
  size: number;
  name: string;
  type: BackupType;
  contents: BackupContent[];
}

// ============================================================================
// Helper Functions (for reducing complexity)
// ============================================================================

/**
 * Retrieves custom backup directory from configuration
 *
 * @returns Custom backup directory or undefined
 */
async function getCustomBackupDir(): Promise<string | undefined> {
  try {
    const configService = getGlobalConfigService();
    const generalConfigService = getGeneralConfigService(configService);
    const backupSettings = await generalConfigService.getBackupSettings();

    if (backupSettings.backupLocation) {
      return backupSettings.backupLocation;
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.warn(`Could not retrieve backup location from config, using default: ${errorMessage}`);
  }

  return undefined;
}

/**
 * Initializes backup record and emits start notifications
 *
 * @param config - Backup initialization configuration
 * @param tx - Prisma transaction client (optional, for transaction-safe operations)
 * @returns Backup initialization result
 */
async function initializeBackup(
  config: InitializeBackupConfig,
  tx?: Prisma.TransactionClient
): Promise<BackupInitResult> {
  const { name, type, contents, notes, backupDir } = config;
  // Get progress emitter if available
  const emitter = await getProgressEmitter();

  // Create backup record in database
  const dbClient = tx ?? prisma;
  const backup = await dbClient.backup.create({
    data: {
      name,
      status: BackupStatus.IN_PROGRESS,
      type,
      contents,
      notes,
      path: '',
      size: 0,
    },
  });

  // Emit initial progress
  if (emitter) {
    emitter.emitProgress(toStringId(backup.id), {
      stage: 'initializing',
      percentage: 0,
      message: 'Starting backup process...',
    });
  }

  // Emit backup started notification
  if ('emitWithTracking' in eventEmitter) {
    const emitterWithTracking = eventEmitter as typeof eventEmitter & {
      emitWithTracking: (event: {
        type: string;
        source: string;
        metadata: Record<string, unknown>;
      }) => Promise<void>;
    };
    await emitterWithTracking.emitWithTracking({
      type: EventType.BACKUP_STARTED,
      source: EventSource.SYSTEM,
      metadata: {
        backupId: backup.id,
        backupName: name,
        backupType: type,
        contents: contents,
        notes: notes,
      },
    });
  }

  // Emit WebSocket event for backup started
  void realtimeEmitter.emitSystemEvent({
    eventType: 'backup:started',
    source: 'backupService',
    message: `Backup ${name} started`,
    data: {
      backupId: backup.id,
      backupName: name,
      backupType: type,
      contents,
      stage: 'initializing',
      progress: 0
    }
  });

  // Ensure backup directory exists
  const backupDirPath = await ensureBackupDir(backupDir);

  // Create backup directory for this specific backup
  const backupPath = path.join(backupDirPath, name);
  await fs.mkdir(backupPath, {
    recursive: true,
  });

  return { backup, emitter, backupPath };
}

/**
 * Performs database backup stage
 *
 * @param ctx - Backup stage context
 * @param currentProgress - Current progress percentage
 * @returns Updated progress percentage
 */
async function performDatabaseBackup(
  ctx: BackupStageContext,
  currentProgress: number
): Promise<number> {
  if (!ctx.contents.includes(BackupContent.DATABASE)) {
    return currentProgress;
  }

  if (ctx.emitter) {
    ctx.emitter.emitProgress(toStringId(ctx.backup.id), {
      stage: 'database',
      percentage: currentProgress,
      message: 'Backing up database...',
    });
  }

  const dbBackupPath = path.join(ctx.backupPath, 'database.dump');
  await createDatabaseBackup(dbBackupPath);

  // Emit WebSocket event for database backup stage complete
  void realtimeEmitter.emitSystemEvent({
    eventType: 'backup:stage:completed',
    source: 'backupService',
    message: 'Database backup completed',
    data: {
      backupId: ctx.backup.id,
      stage: 'database',
      progress: currentProgress + ctx.progressIncrement
    }
  });

  return currentProgress + ctx.progressIncrement;
}

/**
 * Performs configuration backup stage
 *
 * @param ctx - Backup stage context
 * @param currentProgress - Current progress percentage
 * @returns Updated progress percentage
 */
async function performConfigurationBackup(
  ctx: BackupStageContext,
  currentProgress: number
): Promise<number> {
  if (!ctx.contents.includes(BackupContent.CONFIGURATION)) {
    return currentProgress;
  }

  if (ctx.emitter) {
    ctx.emitter.emitProgress(toStringId(ctx.backup.id), {
      stage: 'config',
      percentage: Math.round(currentProgress),
      message: 'Backing up configuration files...',
    });
  }

  const configBackupPath = path.join(ctx.backupPath, 'config.tar.gz');
  await createConfigBackup(configBackupPath);

  // Emit WebSocket event for config backup stage complete
  void realtimeEmitter.emitSystemEvent({
    eventType: 'backup:stage:completed',
    source: 'backupService',
    message: 'Configuration backup completed',
    data: {
      backupId: ctx.backup.id,
      stage: 'config',
      progress: currentProgress + ctx.progressIncrement
    }
  });

  return currentProgress + ctx.progressIncrement;
}

/**
 * Performs media files backup stage
 *
 * @param ctx - Backup stage context
 * @param currentProgress - Current progress percentage
 * @returns Updated progress percentage
 */
async function performMediaBackup(
  ctx: BackupStageContext,
  currentProgress: number
): Promise<number> {
  if (!ctx.contents.includes(BackupContent.MEDIA_FILES)) {
    return currentProgress;
  }

  if (ctx.emitter) {
    ctx.emitter.emitProgress(toStringId(ctx.backup.id), {
      stage: 'media',
      percentage: Math.round(currentProgress),
      message: 'Backing up media files...',
    });
  }

  const mediaBackupPath = path.join(ctx.backupPath, 'media.tar.gz');
  await createMediaBackup(mediaBackupPath);

  // Emit WebSocket event for media backup stage complete
  void realtimeEmitter.emitSystemEvent({
    eventType: 'backup:stage:completed',
    source: 'backupService',
    message: 'Media files backup completed',
    data: {
      backupId: ctx.backup.id,
      stage: 'media',
      progress: currentProgress + ctx.progressIncrement
    }
  });

  return currentProgress + ctx.progressIncrement;
}

/**
 * Performs all backup stages
 *
 * @param ctx - Backup stage context
 * @returns Final progress percentage
 */
async function performBackupStages(ctx: BackupStageContext): Promise<number> {
  let currentProgress = 10;

  currentProgress = await performDatabaseBackup(ctx, currentProgress);
  currentProgress = await performConfigurationBackup(ctx, currentProgress);
  currentProgress = await performMediaBackup(ctx, currentProgress);

  return currentProgress;
}

/**
 * Creates and validates the final backup archive
 *
 * @param backup - Backup record
 * @param emitter - Progress emitter
 * @param backupPath - Source backup directory path
 * @param config - Backup configuration
 * @returns Final backup file path and size
 */
async function createFinalArchive(
  backup: Backup,
  emitter: ProgressEmitter | null,
  backupPath: string,
  config: BackupConfig
): Promise<{ finalPath: string; size: number }> {
  // Create final archive containing all backup files
  if (emitter) {
    emitter.emitProgress(toStringId(backup.id), {
      stage: 'compressing',
      percentage: 80,
      message: 'Compressing backup files...',
    });
  }

  const finalBackupPath = `${backupPath}.tar.gz`;
  await execFileAsync('tar', ['-czf', finalBackupPath, '-C', backupPath, '.']);

  // Get size of final backup
  const stats = await fs.stat(finalBackupPath);

  // Check if backup size is within limits
  if (!isValidBackupSize(stats.size, config)) {
    // Remove the oversized backup
    await fs.rm(finalBackupPath, { force: true });
    await fs.rm(backupPath, { recursive: true, force: true });
    throw new ValidationError(
      `Backup size ${stats.size} bytes exceeds maximum allowed size of ${config.BACKUP_MAX_SIZE_MB}MB`
    );
  }

  return { finalPath: finalBackupPath, size: stats.size };
}

/**
 * Finalizes backup by cleaning up and updating records
 *
 * @param params - Finalization parameters
 * @param tx - Prisma transaction client (optional, for transaction-safe operations)
 */
async function finalizeBackup(params: FinalizeBackupParams, tx?: Prisma.TransactionClient): Promise<void> {
  const { backup, emitter, backupPath, finalBackupPath, size, name, type, contents } = params;

  // Clean up individual backup files
  if (emitter) {
    emitter.emitProgress(toStringId(backup.id), {
      stage: 'finalizing',
      percentage: 90,
      message: 'Finalizing backup...',
    });
  }

  await fs.rm(backupPath, { recursive: true, force: true });

  // Update backup record
  const dbClient = tx ?? prisma;
  await dbClient.backup.update({
    where: { id: backup.id },
    data: {
      status: BackupStatus.COMPLETED,
      path: finalBackupPath,
      size: size,
    },
  });

  // Emit completion
  if (emitter) {
    emitter.emitProgress(toStringId(backup.id), {
      stage: 'completed',
      percentage: 100,
      message: `Backup completed successfully (${(size / 1024 / 1024).toFixed(2)} MB)`,
    });
  }

  // Emit backup completed notification
  await eventEmitter.emitWithTracking({
    type: EventType.BACKUP_COMPLETED,
    source: EventSource.SYSTEM,
    metadata: {
      backupId: backup.id,
      backupName: name,
      backupType: type,
      path: finalBackupPath,
      size: size,
      sizeInMB: (size / 1024 / 1024).toFixed(2),
      contents: contents,
    },
  });

  // Emit WebSocket event for backup completed
  void realtimeEmitter.emitSystemEvent({
    eventType: 'backup:completed',
    source: 'backupService',
    message: `Backup ${name} completed successfully`,
    data: {
      backupId: backup.id,
      backupName: name,
      backupType: type,
      path: finalBackupPath,
      size,
      sizeInMB: (size / 1024 / 1024).toFixed(2),
      contents,
      stage: 'completed',
      progress: 100
    }
  });

  logger.info(`Backup ${name} completed successfully`);
}

/**
 * Handles backup failure by updating records and emitting notifications
 *
 * @param error - Error that occurred
 * @param name - Backup name
 * @param type - Backup type
 * @param contents - Content types
 * @param notes - Original backup notes
 */
async function handleBackupFailure(
  error: unknown,
  name: string,
  type: BackupType,
  contents: BackupContent[],
  notes: string
): Promise<void> {
  const errorMessage = error instanceof Error ? error.message : String(error);
  logger.error(`Backup failed: ${errorMessage}`);

  // Update backup record to failed status
  await prisma.backup.updateMany({
    where: {
      name,
      status: BackupStatus.IN_PROGRESS,
    },
    data: {
      status: BackupStatus.FAILED,
      notes: `${notes}\nError: ${errorMessage}`,
    },
  });

  // Emit backup failed notification
  await eventEmitter.emitWithTracking({
    type: EventType.BACKUP_FAILED,
    source: EventSource.SYSTEM,
    metadata: {
      backupName: name,
      backupType: type,
      error: errorMessage,
      contents: contents,
    },
  });

  // Emit WebSocket event for backup failed
  void realtimeEmitter.emitSystemEvent({
    eventType: 'backup:failed',
    source: 'backupService',
    message: `Backup ${name} failed: ${errorMessage}`,
    data: {
      backupName: name,
      backupType: type,
      error: errorMessage,
      contents,
      stage: 'failed'
    }
  });
}

// ============================================================================
// Main Export
// ============================================================================

/**
 * Create Backup
 *
 * Creates a full system backup including database, configuration, and media files.
 * Handles backup tracking, progress emission, and error recovery.
 *
 * @param options - Backup creation options
 * @returns Backup record ID
 * @throws Error if backup creation fails
 *
 * @example
 * ```typescript
 * const backupId = await createBackup({
 *   name: 'daily_backup',
 *   type: BackupType.SCHEDULED,
 *   contents: [BackupContent.DATABASE, BackupContent.CONFIGURATION],
 *   notes: 'Daily scheduled backup',
 * });
 * ```
 */
export async function createBackup(options: BackupCreationOptions = {}): Promise<number> {
  // Get custom backup directory from config
  const customBackupDir = await getCustomBackupDir();

  // Extract options with defaults
  const {
    name = generateBackupName(),
    type = BackupType.MANUAL,
    contents = [BackupContent.DATABASE, BackupContent.CONFIGURATION],
    notes = '',
    backupDir = customBackupDir ?? DEFAULT_BACKUP_DIR,
  } = options;

  // Previously this entire flow was wrapped in a single 5-minute
  // prisma.$transaction, which (a) held a pooled DB connection idle during
  // pg_dump+tar and (b) rolled back the IN_PROGRESS row on failure so
  // handleBackupFailure's `updateMany where status=IN_PROGRESS` matched 0
  // rows — failed backups left no DB audit trail. The flow is now three
  // phases with no enclosing transaction:
  //   1. initializeBackup commits the IN_PROGRESS row (its own implicit tx).
  //   2. file I/O (pg_dump + tar) runs untransacted.
  //   3. finalizeBackup flips the row to COMPLETED (its own implicit tx).
  // handleBackupFailure now finds the committed row whether the failure
  // happened during initialize-after-row-create, file I/O, or finalize.
  try {
    const { backup, emitter, backupPath } = await initializeBackup({
      name, type, contents, notes, backupDir,
    });

    const progressIncrement = 70 / contents.length;
    const ctx: BackupStageContext = {
      backup,
      emitter,
      contents,
      backupPath,
      progressIncrement,
    };
    await performBackupStages(ctx);
    const { finalPath, size } = await createFinalArchive(backup, emitter, backupPath, backupConfig);

    await finalizeBackup({
      backup,
      emitter,
      backupPath,
      finalBackupPath: finalPath,
      size,
      name,
      type,
      contents,
    });

    return backup.id;
  } catch (error: unknown) {
    // updateMany is a no-op (0 rows) if the failure happened before the
    // IN_PROGRESS row was created; otherwise it finds the row by unique
    // name and marks it FAILED. Either way handleBackupFailure also emits
    // BACKUP_FAILED events for the UI / notification system.
    await handleBackupFailure(error, name, type, contents, notes);
    throw error;
  }
}
