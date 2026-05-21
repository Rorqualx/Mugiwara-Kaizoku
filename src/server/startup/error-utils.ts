/**
 * Error Utilities Module
 *
 * Shared error handling utilities for server startup modules.
 * This module is intentionally minimal to avoid import side effects.
 */

/**
 * Formats error messages consistently across the application
 *
 * @param error - The error to format
 * @returns Formatted error message
 */
export function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
