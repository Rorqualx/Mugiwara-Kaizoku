/**
 * Common Type Definitions
 *
 * Single source of truth for common types used throughout the application.
 * This file consolidates duplicate type definitions to improve maintainability.
 *
 * @module types/common
 */

/**
 * Generic ID type that can be either string or number.
 * Used for flexible ID handling across different data sources.
 *
 * - Prisma User/Account/Session models use string IDs (CUID)
 * - Prisma Manga/Library/Chapter models use number IDs (autoincrement)
 */
export type ID = string | number;

/**
 * String-based ID type, typically used for:
 * - User IDs (CUID)
 * - Session tokens
 * - External API identifiers
 */
export type StringID = string;

/**
 * Numeric ID type, typically used for:
 * - Manga IDs
 * - Library IDs
 * - Chapter IDs
 */
export type NumericID = number;

/**
 * Flexible date type that can accept multiple formats.
 * Used for date fields that may come from different sources.
 */
export type DateLike = Date | string | number;

/**
 * Utility type for nullable values.
 * Provides explicit null handling.
 */
export type Nullable<T> = T | null;

/**
 * Utility type for optional values.
 * Includes both undefined and null.
 */
export type Optional<T> = T | null | undefined;

/**
 * Deep partial utility type.
 * Makes all properties and nested properties optional.
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends Record<string, unknown> ? DeepPartial<T[P]> : T[P];
};

/**
 * Type guard to check if a value is a valid ID.
 */
export function isValidId(value: unknown): value is ID {
  return typeof value === 'string' || (typeof value === 'number' && !isNaN(value));
}

/**
 * Type guard to check if a value is a string ID.
 */
export function isStringId(value: unknown): value is StringID {
  return typeof value === 'string';
}

/**
 * Type guard to check if a value is a numeric ID.
 */
export function isNumericId(value: unknown): value is NumericID {
  return typeof value === 'number' && !isNaN(value);
}

/**
 * Common status types used across the application
 */
export type Status = 'idle' | 'loading' | 'success' | 'error';

/**
 * Common sort direction type
 */
export type SortDirection = 'asc' | 'desc';

/**
 * Common pagination interface
 */
export interface Pagination {
  page: number;
  limit: number;
  total?: number;
  hasMore?: boolean;
}

/**
 * Common error response interface
 */
export interface ErrorResponse {
  error: string;
  message?: string;
  code?: string;
  statusCode?: number;
}

/**
 * Common success response interface
 */
export interface SuccessResponse<T = unknown> {
  success: true;
  data: T;
  message?: string;
}