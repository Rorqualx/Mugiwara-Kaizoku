/**
 * Volume Split Progress Tracker Service
 *
 * Tracks real-time progress of volume splitting operations.
 * Maintains in-memory state for active split operations with progress updates.
 *
 * Features:
 * - Track multiple simultaneous split operations
 * - Stage-based progress tracking (extracting, detecting, splitting, complete)
 * - Percentage completion calculation
 * - Error state handling
 * - Automatic cleanup of completed operations
 *
 * @module server/services/download/volumeSplitProgressTracker
 */

import { EventEmitter } from 'events';

import { realtimeEmitter } from '@/server/services/realtime';
import { logger } from '@/utils/logger';

/**
 * Stage of the volume split operation
 */
export type SplitStage =
  | 'initializing'
  | 'extracting_images'
  | 'detecting_chapters'
  | 'calculating_confidence'
  | 'creating_chapters'
  | 'complete'
  | 'error';

/**
 * Progress information for a volume split operation
 */
export interface VolumeSplitProgress {
  /** Unique operation ID */
  operationId: string;

  /** Path to the volume being split */
  volumePath: string;

  /** Current stage of the operation */
  stage: SplitStage;

  /** Overall percentage complete (0-100) */
  percentComplete: number;

  /** Current chapter being processed (if in creating_chapters stage) */
  currentChapter?: number;

  /** Total chapters to create (if known) */
  totalChapters?: number;

  /** Total images extracted (if known) */
  totalImages?: number;

  /** Number of chapters created so far */
  chaptersCreated: number;

  /** Files created during split */
  createdFiles: string[];

  /** Error message if stage is 'error' */
  errorMessage?: string;

  /** Timestamp when operation started */
  startedAt: Date;

  /** Timestamp when operation completed (if complete) */
  completedAt?: Date;
}

/**
 * Progress update event data
 */
export interface ProgressUpdate {
  operationId: string;
  stage: SplitStage;
  percentComplete: number;
  currentChapter?: number;
  totalChapters?: number;
}

/**
 * Volume Split Progress Tracker
 *
 * Singleton service for tracking volume split operation progress
 */
export class VolumeSplitProgressTracker extends EventEmitter {
  /** Map of operation ID to progress state */
  private operations = new Map<string, VolumeSplitProgress>();

  /** Cleanup interval for completed operations (30 minutes) */
  private readonly CLEANUP_INTERVAL_MS = 30 * 60 * 1000;

  /** Timer for periodic cleanup */
  private cleanupTimer?: NodeJS.Timeout;

  constructor() {
    super();
    this.startCleanupTimer();
  }

  /**
   * Start a new volume split operation tracking
   *
   * @param operationId - Unique identifier for this operation
   * @param volumePath - Path to volume being split
   * @returns Initial progress state
   */
  startOperation(operationId: string, volumePath: string): VolumeSplitProgress {
    const progress: VolumeSplitProgress = {
      operationId,
      volumePath,
      stage: 'initializing',
      percentComplete: 0,
      chaptersCreated: 0,
      createdFiles: [],
      startedAt: new Date()
    };

    this.operations.set(operationId, progress);

    logger.info(`[VolumeSplitProgressTracker] Started operation ${operationId} for ${volumePath}`);

    this.emitProgress(progress);

    return progress;
  }

  /**
   * Update operation to extracting images stage
   *
   * @param operationId - Operation identifier
   * @param totalImages - Number of images extracted
   */
  updateExtractingImages(operationId: string, totalImages: number): void {
    const progress = this.operations.get(operationId);
    if (!progress) {
      logger.warn(`[VolumeSplitProgressTracker] Operation ${operationId} not found`);
      return;
    }

    progress.stage = 'extracting_images';
    progress.percentComplete = 15;
    progress.totalImages = totalImages;

    logger.debug(`[VolumeSplitProgressTracker] ${operationId}: Extracted ${totalImages} images`);

    this.emitProgress(progress);
  }

  /**
   * Update operation to detecting chapters stage
   *
   * @param operationId - Operation identifier
   */
  updateDetectingChapters(operationId: string): void {
    const progress = this.operations.get(operationId);
    if (!progress) {
      logger.warn(`[VolumeSplitProgressTracker] Operation ${operationId} not found`);
      return;
    }

    progress.stage = 'detecting_chapters';
    progress.percentComplete = 30;

    logger.debug(`[VolumeSplitProgressTracker] ${operationId}: Detecting chapters`);

    this.emitProgress(progress);
  }

  /**
   * Update operation to calculating confidence stage
   *
   * @param operationId - Operation identifier
   * @param totalChapters - Number of chapters detected
   */
  updateCalculatingConfidence(operationId: string, totalChapters: number): void {
    const progress = this.operations.get(operationId);
    if (!progress) {
      logger.warn(`[VolumeSplitProgressTracker] Operation ${operationId} not found`);
      return;
    }

    progress.stage = 'calculating_confidence';
    progress.percentComplete = 40;
    progress.totalChapters = totalChapters;

    logger.debug(`[VolumeSplitProgressTracker] ${operationId}: Detected ${totalChapters} chapters`);

    this.emitProgress(progress);
  }

  /**
   * Update operation to creating chapters stage
   *
   * @param operationId - Operation identifier
   * @param currentChapter - Chapter currently being created
   * @param totalChapters - Total chapters to create
   */
  updateCreatingChapter(operationId: string, currentChapter: number, totalChapters: number): void {
    const progress = this.operations.get(operationId);
    if (!progress) {
      logger.warn(`[VolumeSplitProgressTracker] Operation ${operationId} not found`);
      return;
    }

    progress.stage = 'creating_chapters';
    progress.currentChapter = currentChapter;
    progress.totalChapters = totalChapters;

    // Calculate progress: 40% base + 60% for chapter creation
    const chapterProgress = (currentChapter / totalChapters) * 60;
    progress.percentComplete = 40 + chapterProgress;

    logger.debug(
      `[VolumeSplitProgressTracker] ${operationId}: Creating chapter ${currentChapter}/${totalChapters} (${progress.percentComplete.toFixed(1)}%)`
    );

    this.emitProgress(progress);
  }

  /**
   * Mark a chapter as created
   *
   * @param operationId - Operation identifier
   * @param chapterFilePath - Path to created chapter file
   */
  chapterCreated(operationId: string, chapterFilePath: string): void {
    const progress = this.operations.get(operationId);
    if (!progress) {
      logger.warn(`[VolumeSplitProgressTracker] Operation ${operationId} not found`);
      return;
    }

    progress.chaptersCreated++;
    progress.createdFiles.push(chapterFilePath);

    logger.debug(`[VolumeSplitProgressTracker] ${operationId}: Created ${chapterFilePath}`);

    this.emitProgress(progress);
  }

  /**
   * Mark operation as complete
   *
   * @param operationId - Operation identifier
   * @param createdFiles - All files created during the operation
   */
  completeOperation(operationId: string, createdFiles: string[]): void {
    const progress = this.operations.get(operationId);
    if (!progress) {
      logger.warn(`[VolumeSplitProgressTracker] Operation ${operationId} not found`);
      return;
    }

    progress.stage = 'complete';
    progress.percentComplete = 100;
    progress.createdFiles = createdFiles;
    progress.completedAt = new Date();

    const duration = progress.completedAt.getTime() - progress.startedAt.getTime();
    const durationSec = (duration / 1000).toFixed(1);

    logger.info(
      `[VolumeSplitProgressTracker] ${operationId}: Complete (${progress.chaptersCreated} chapters created in ${durationSec}s)`
    );

    this.emitProgress(progress);
  }

  /**
   * Mark operation as failed
   *
   * @param operationId - Operation identifier
   * @param error - Error that occurred
   */
  errorOperation(operationId: string, error: Error): void {
    const progress = this.operations.get(operationId);
    if (!progress) {
      logger.warn(`[VolumeSplitProgressTracker] Operation ${operationId} not found`);
      return;
    }

    progress.stage = 'error';
    progress.errorMessage = error.message;
    progress.completedAt = new Date();

    logger.error(`[VolumeSplitProgressTracker] ${operationId}: Failed - ${error.message}`);

    this.emitProgress(progress);
  }

  /**
   * Get progress for a specific operation
   *
   * @param operationId - Operation identifier
   * @returns Progress state or null if not found
   */
  getProgress(operationId: string): VolumeSplitProgress | null {
    return this.operations.get(operationId) ?? null;
  }

  /**
   * Get all active operations (not complete or error)
   *
   * @returns Array of active operation progress states
   */
  getActiveOperations(): VolumeSplitProgress[] {
    return Array.from(this.operations.values()).filter(
      op => op.stage !== 'complete' && op.stage !== 'error'
    );
  }

  /**
   * Get all operations (including completed and errored)
   *
   * @returns Array of all operation progress states
   */
  getAllOperations(): VolumeSplitProgress[] {
    return Array.from(this.operations.values());
  }

  /**
   * Remove an operation from tracking
   *
   * @param operationId - Operation identifier
   */
  removeOperation(operationId: string): void {
    this.operations.delete(operationId);
    logger.debug(`[VolumeSplitProgressTracker] Removed operation ${operationId}`);
  }

  /**
   * Emit progress update event
   *
   * @param progress - Progress state to emit
   */
  private emitProgress(progress: VolumeSplitProgress): void {
    const update: ProgressUpdate = {
      operationId: progress.operationId,
      stage: progress.stage,
      percentComplete: progress.percentComplete,
      ...(progress.currentChapter !== undefined && { currentChapter: progress.currentChapter }),
      ...(progress.totalChapters !== undefined && { totalChapters: progress.totalChapters })
    };

    // Emit local event for in-process listeners
    this.emit('progress', update);

    // Emit via WebSocket for remote clients
    void realtimeEmitter.emitVolumeSplitProgress({
      operationId: progress.operationId,
      stage: progress.stage,
      percentComplete: progress.percentComplete,
      ...(progress.currentChapter !== undefined && { currentChapter: progress.currentChapter }),
      ...(progress.totalChapters !== undefined && { totalChapters: progress.totalChapters }),
      ...(progress.totalImages !== undefined && { totalImages: progress.totalImages }),
      volumePath: progress.volumePath,
      ...(progress.errorMessage !== undefined && { errorMessage: progress.errorMessage }),
    });
  }

  /**
   * Start periodic cleanup of old completed operations
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupOldOperations();
    }, this.CLEANUP_INTERVAL_MS);

    // Don't prevent process exit
    this.cleanupTimer.unref();
  }

  /**
   * Clean up operations that completed more than 30 minutes ago
   */
  private cleanupOldOperations(): void {
    const now = Date.now();
    const cutoff = now - this.CLEANUP_INTERVAL_MS;

    let cleanedCount = 0;

    for (const [operationId, progress] of this.operations.entries()) {
      if (
        progress.completedAt &&
        progress.completedAt.getTime() < cutoff
      ) {
        this.operations.delete(operationId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info(`[VolumeSplitProgressTracker] Cleaned up ${cleanedCount} old operations`);
    }
  }

  /**
   * Stop the cleanup timer (for testing or shutdown)
   */
  stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      delete (this as unknown as { cleanupTimer?: NodeJS.Timeout }).cleanupTimer;
    }
  }

  /**
   * Clear all operations (for testing)
   */
  clearAll(): void {
    this.operations.clear();
    logger.debug('[VolumeSplitProgressTracker] Cleared all operations');
  }
}

/**
 * Singleton instance
 */
let trackerInstance: VolumeSplitProgressTracker | null = null;

/**
 * Get singleton instance of VolumeSplitProgressTracker
 *
 * @returns The singleton progress tracker instance
 */
export function getProgressTracker(): VolumeSplitProgressTracker {
  trackerInstance ??= new VolumeSplitProgressTracker();
  return trackerInstance;
}

/**
 * Generate a unique operation ID
 *
 * @param volumePath - Path to volume file
 * @returns Unique operation identifier
 */
export function generateOperationId(volumePath: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  const filename = volumePath.split('/').pop()?.replace(/[^a-zA-Z0-9]/g, '') ?? 'unknown';
  return `${filename}_${timestamp}_${random}`;
}
