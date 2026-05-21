/**
 * Chapter Enricher Types Module
 *
 * Shared type definitions, interfaces, and type guards for chapter enrichment.
 * Used across all chapter enricher modules.
 *
 * Extracted from: chapter-enricher.ts (lines 33-78)
 */

import { ChapterStatus } from '@prisma/client';

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Input for chapter enrichment
 */
export interface EnrichChaptersInput {
  /** Database manga ID */
  mangaId: number;
}

/**
 * Result of chapter enrichment
 */
export interface EnrichChaptersResult {
  /** Number of chapters created */
  createdCount: number;
  /** Number of chapters updated */
  updatedCount: number;
  /** Total chapters processed */
  totalChapters: number;
}

/**
 * Type-safe chapter create input matching Prisma schema
 */
export interface ChapterCreateInput {
  mangaId: number;
  fileName: string;
  index: number;
  title: string;
  size: number;
  downloadStatus: ChapterStatus;
  downloadUrl: string | null;
  coverImage: string | null;
  description: string | null;
  pageCount: number | null;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if value is a Record
 *
 * @param value - Value to check
 * @returns True if value is a non-null object that is not an array
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Safely access property on unknown object
 *
 * @param obj - Object to access
 * @param key - Property key
 * @returns Property value or undefined
 */
export function safeGet(obj: Record<string, unknown>, key: string): unknown {
  return obj[key];
}

// ============================================================================
// Error Handling Helpers
// ============================================================================

/**
 * Convert unknown error to Error type
 *
 * @param error - Error of unknown type
 * @returns Error instance
 */
export function handleError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  return new Error(String(error));
}
