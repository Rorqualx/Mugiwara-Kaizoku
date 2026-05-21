/**
 * Core Utilities and Type Definitions
 *
 * This module serves as the central export point for common utilities, types,
 * and helper functions used throughout the application. It organizes exports
 * into logical categories for better maintainability.
 *
 * @module utils
 */
import { logger } from './logging';
// Database error types - these don't exist in search.types, define locally
export interface DatabaseError extends Error {
  code: string;
  query?: string;
}
// Job error types - import from canonical source
export type { JobError } from '@/utils/job-validation';
/**
 * Frontend Utility Exports
 * Client-side helper functions and types
 */
export { sanitizer, getCronLabel, isCronValid, formatChapterTitle, type ChapterFromLocal, type RemoteChapter } from '@/utils/client/frontendHelpers';
/**
 * Server-side Utility Exports
 * Backend helper functions for file system and cron operations
 */
export { getDetailedCronLabel, validateCronExpression, getChaptersFromLocal, findMissingChapterFiles, checkFileExists } from '@/utils/server/serverHelpers';
// Logging Utilities
export { logger } from '@/server/utils/logger'; // Updated import path
// Path Utilities
export { getBasePath, resolvePath, joinPath, getSrcPath, getSourcePath, paths, validatePath, getAliasEntries // Add export for the function
} from "@/utils/pathUtils";
// Chapter Management
export { formatChapterTitle as formatChapterNumber, createChapterFromLocal } from './chapter';
export type { ChapterCreateInput } from '@/types/chapter-metadata';
// Manga Management
export { getMangaLibraryPath, validateMangaPath, type LibraryPathError } from './manga';
export type { HasLibrary } from './manga';
// Error Handlers
export { setupUncaughtExceptionHandler, setupUnhandledRejectionHandler, setupGracefulShutdown, expressErrorHandler, isDatabaseError, isConfigurationError, isServerError, type ConfigurationError, type ServerError } from './errorHandlers';
// Database Testing
export { testDatabaseConnection, verifyDatabaseSchema, checkDatabaseHealth, type PrismaClientError } from './databaseTest';
/**
 * Integration Types and Interfaces
 * Type definitions for manga-related operations
 * @interface MangaArgs
 * @property {Object} include - Inclusion flags for related data
 */
export interface MangaArgs {
  include: {
    Metadata: true;
    library: true;
    Chapter: true;
  };
}
/**
 * Common Type Definitions
 * Shared type definitions used across the application
 */
export interface WithTransaction {
  <T>(fn: (tx: unknown) => Promise<T>): Promise<T>;
}
/**
 * Metadata Update Interface
 * Defines the structure for metadata updates
 *
 * @interface MetadataUpdateInput
 * @property {string} [coverLarge] - Large cover image URL
 * @property {string} [coverMedium] - Medium cover image URL
 * @property {string} [coverSmall] - Small cover image URL
 * @property {string} [summary] - Manga summary
 * @property {string[]} [genres] - Genre list
 * @property {string} [status] - Publication status
 * @property {Date} [startDate] - Publication start date
 * @property {Date} [endDate] - Publication end date
 * @property {string[]} [authors] - Author list
 * @property {string[]} [tags] - Tag list
 */
export interface MetadataUpdateInput {
  coverLarge?: string | null;
  coverMedium?: string | null;
  coverSmall?: string | null;
  summary?: string;
  genres?: string[];
  status?: string;
  startDate?: Date;
  endDate?: Date;
  authors?: string[];
  tags?: string[];
}
/**
 * Task Configuration Interface
 * Defines options for scheduled tasks
 *
 * @interface TaskOptions
 * @property {Date} [scheduledAt] - Scheduled execution time
 * @property {string} [interval] - Execution interval
 * @property {number} [priority] - Task priority
 * @property {number} [maxRetries] - Maximum retry attempts
 */
export interface TaskOptions {
  scheduledAt?: Date;
  interval?: string;
  priority?: number;
  maxRetries?: number;
}
/**
 * File System Error Interface
 * Extended Error type for file system operations
 *
 * @interface FileSystemError
 * @extends Error
 * @property {string} code - Error code
 * @property {string} path - File path where error occurred
 */
export interface FileSystemError extends Error {
  code: string;
  path: string;
}
/**
 * Integration Result Interface
 * Standard response format for integration operations
 *
 * @interface IntegrationResult
 * @property {boolean} success - Operation success status
 * @property {string} message - Result message
 * @property {unknown} [data] - Optional result data
 */
export interface IntegrationResult {
  success: boolean;
  message: string;
  data?: unknown;
}
/**
 * Validation Result Type
 * Standard format for validation results
 *
 * @typedef {Object} ValidationResult
 * @property {boolean} isValid - Validation status
 * @property {string[]} [errors] - Optional validation errors
 */
export type ValidationResult = {
  isValid: boolean;
  errors?: string[];
};
/**
 * Utility Type Definitions
 * Generic type utilities for common patterns
 */
export type DeepPartial<T> = { [P in
keyof T]?: T[P] extends Record<string, unknown> ? DeepPartial<T[P]> : T[P] };

export type RequiredKeys<T, K extends keyof T> = Required<Pick<T, K>> & Omit<T, K>;
/**
 * Handles async operations with standardized error handling
 *
 * Wraps async operations with consistent error logging and propagation.
 *
 * @template T
 * @param {() => Promise<T>} operation - Async operation to execute
 * @param {string} errorMessage - Error message prefix
 * @returns {Promise<T>} Operation result
 * @throws {Error} Propagates original error after logging
 */
// Helper function to handle async operations with proper error handling
export async function withErrorHandling<T>(operation: () => Promise<T>, _errorMessage: string): Promise<T> {
  try {
    return await operation();
  }
  catch (error: unknown) {
    logger.error((error instanceof Error ? error.message : String(error)), error instanceof Error ? (error instanceof Error ? error.message : String(error)) : String(error));
    throw error;
  }
}
/**
 * Performs runtime type assertion with custom error message
 *
 * @template T
 * @param {unknown} value - Value to check
 * @param {(value: unknown) => value is T} check - Type guard function
 * @param {string} message - Error message if assertion fails
 * @throws {TypeError} If type assertion fails
 */
export function assertType<T>(value: unknown, check: (value: unknown) => value is T, message: string): asserts value is T {
  if (!check(value)) {
    throw new TypeError(message);
  }
}