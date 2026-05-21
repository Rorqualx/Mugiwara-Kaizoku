/**
 * Download and Task Types Module
 *
 * Types for download management, task entities, and library operations.
 * Includes download client enums and task status tracking.
 *
 * Extracted from: search.types.ts
 */

// ============================================================================
// Imports
// ============================================================================

import type { Prisma } from '@prisma/client';

// ============================================================================
// Re-exports from Enums Module
// ============================================================================

// Re-export download-related enums
export {
  DownloadClient,
  DownloadMode,
  DownloadPriority
} from './enums.types';

// Re-export job error types
export type { JobError } from './enums.types';

// ============================================================================
// Task Types
// ============================================================================

export interface TaskEntity {
  id: number;
  type: string;
  status: string;
  priority?: string;
  payload?: unknown;
  result?: unknown;
  error?: string;
  created_at: Date;
  updated_at: Date;
  started_at?: Date;
  completed_at?: Date;
}

// ============================================================================
// Library Types
// ============================================================================

/**
 * Library types - Use Prisma Library type directly
 */
export type LibraryEntity = Prisma.LibraryGetPayload<Record<string, never>>;
