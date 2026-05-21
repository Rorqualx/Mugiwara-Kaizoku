/**
 * Manga Transaction Client Types
 * 
 * This file provides type definitions for Prisma transaction clients
 * for manga-related operations to provide type safety when using transactions.
 */

import type { JobStatus } from '../utils/job-validation';

/**
 * Chapter client for transaction operations
 */
export interface ChapterClient {
  /**
   * Delete a chapter by ID
   */
  delete: (params: {
    where: { id: number };
  }) => Promise<unknown>;
}

/**
 * Out-of-sync chapter client for transaction operations
 */
export interface OutOfSyncChapterClient {
  /**
   * Delete an out-of-sync chapter by ID
   */
  delete: (params: {
    where: { id: number };
  }) => Promise<unknown>;
}

/**
 * Manga client for transaction operations
 */
export interface MangaClient {
  /**
   * Update a manga with the given data
   */
  update: (params: {
    where: { id: number };
    data: {
      status: JobStatus;
      lastChecked: Date;
      [key: string]: unknown;
    };
  }) => Promise<unknown>;
}

/**
 * Transaction client with typed operations for manga processing
 */
export interface MangaTransactionClient {
  chapter: ChapterClient;
  outOfSyncChapter: OutOfSyncChapterClient;
  manga: MangaClient;
  [key: string]: unknown;
}