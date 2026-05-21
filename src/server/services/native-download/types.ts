/**
 * Native Download Types Module
 *
 * Shared type definitions, interfaces, and schemas used across all
 * native download modules.
 */

import { z } from 'zod';

import type { INativeDownloadAdapter, NativeDownloadSearchOptions } from '@/types/adapters/native-download-types';
import type { MangaSearchResult } from '@/types/search.types';

import type { NativeDownloadStatus } from '@prisma/client';

// ============================================================================
// Re-exports (for convenience)
// ============================================================================

export type {
  NativeDownloadStatus,
  INativeDownloadAdapter,
  NativeDownloadSearchOptions,
  MangaSearchResult
};

// ============================================================================
// Validation Schemas
// ============================================================================

/**
 * Schema for validating source config
 *
 * Accepts arbitrary key-value pairs as the config structure
 * varies by provider implementation.
 */
export const SourceConfigSchema = z.record(z.unknown());

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Active download information
 *
 * Represents a download in progress or queued for processing.
 * Used for real-time status tracking and progress monitoring.
 */
export interface ActiveDownload {
  /** Unique download identifier */
  id: string;

  /** ID of the manga being downloaded */
  mangaId: string | number;

  /** Title of the manga for display purposes */
  mangaTitle: string;

  /** Optional chapter ID if downloading a specific chapter */
  chapterId?: string;

  /** Optional chapter number for display */
  chapterNumber?: number;

  /** Current download status */
  status: NativeDownloadStatus;

  /** Download progress percentage (0-100) */
  progress?: number;

  /** Error message if download failed */
  error?: string;

  /** Timestamp when download was initiated */
  startedAt: Date;

  /** Timestamp of last status update */
  updatedAt: Date;
}
