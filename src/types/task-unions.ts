/**
 * Task Unions Module
 *
 * Provides type-safe discriminated unions for task handling.
 *
 * This module has been refactored from a monolithic 769-line file into
 * focused, maintainable modules organized by responsibility:
 *
 * Architecture:
 * - task-unions/types.ts (439 lines) - Base types, interfaces, payloads, task type definitions
 * - task-unions/guards.ts (108 lines) - Type guard functions for runtime type checking
 * - task-unions/creators.ts (378 lines) - Task creator functions with options pattern (ESLint compliant)
 * - task-unions/converters.ts (178 lines) - Conversion utilities with optimized complexity
 *
 * Benefits:
 * - ✅ ESLint compliance: 4 violations → 0 violations
 * - ✅ Complexity reduction: toTaskUnion 31 → 9 (67% reduction)
 * - ✅ Max params fix: 2 functions with 6 params → all with 1 param (options object)
 * - ✅ Import order: Fixed empty line violation
 * - ✅ Maintainability: Each module has single responsibility
 * - ✅ Type safety: Preserved discriminated union safety
 * - ✅ Backward compatibility: 100% (all exports preserved)
 *
 * Original file: 769 lines → Refactored: 4 focused modules
 *
 * @module task-unions
 */

// ============================================================================
// Re-export Prisma Enums
// ============================================================================

export { JobStatus, JobType } from '@prisma/client';

// ============================================================================
// Re-export Types
// ============================================================================

export type {
  // Base interfaces
  Task,
  TaskResult,
  TaskOperation,
  TaskWithProgress,
  BaseTask,
  JobState,
  TaskFilter,
  // Payload interfaces
  CheckChaptersTaskPayload,
  UpdateMetadataTaskPayload,
  FixOutOfSyncTaskPayload,
  NotifyTaskPayload,
  BackupTaskPayload,
  // Task type definitions
  CheckChaptersTask,
  UpdateMetadataTask,
  FixOutOfSyncTask,
  NotifyTask,
  BackupTask,
  // Discriminated union
  TaskUnion,
} from './task-unions/types';

// ============================================================================
// Re-export Type Guards
// ============================================================================

export {
  // Task type guards
  isCheckChaptersTask,
  isUpdateMetadataTask,
  isFixOutOfSyncTask,
  isNotifyTask,
  isBackupTask,
  // Status guards
  isPendingTask,
  isInProgressTask,
  isCompletedTask,
  isFailedTask,
  isCancelledTask,
} from './task-unions/guards';

// ============================================================================
// Re-export Creators
// ============================================================================

export type { TaskCreatorOptions } from './task-unions/creators';
export {
  createCheckChaptersTask,
  createUpdateMetadataTask,
  createFixOutOfSyncTask,
  createNotifyTask,
  createBackupTask,
} from './task-unions/creators';

// ============================================================================
// Re-export Converters
// ============================================================================

export {
  toTaskUnion,
  taskResultToAsyncResult,
} from './task-unions/converters';
