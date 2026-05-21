/**
 * Common Validation Schemas
 *
 * Shared Zod schemas for consistent validation across the codebase.
 */

import { z } from 'zod';

// =============================================================================
// ID SCHEMAS
// =============================================================================

/** Positive integer ID (for database primary keys) */
export const PositiveIntId = z.coerce.number().int().positive();

/** Non-negative integer (for counts, offsets) */
export const NonNegativeInt = z.coerce.number().int().nonnegative();

/** Page number (1-indexed, minimum 1) */
export const PageNumber = z.coerce.number().int().min(1);

// =============================================================================
// PAGINATION SCHEMAS
// =============================================================================

/** Standard pagination input */
export const PaginationInput = z.object({
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().nonnegative().default(0)
});

/** Cursor-based pagination input */
export const CursorPaginationInput = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20)
});

// =============================================================================
// DATE SCHEMAS
// =============================================================================

/** Date range input for filtering */
export const DateRangeInput = z.object({
  startDate: z.date().optional(),
  endDate: z.date().optional()
});

// =============================================================================
// API RESPONSE SCHEMAS
// =============================================================================

/** Standard error response */
export const ErrorResponseSchema = z.object({
  status: z.literal('error'),
  error: z.object({
    code: z.string(),
    message: z.string(),
    timestamp: z.string(),
    requestId: z.string().optional()
  })
});

/** Standard success response wrapper */
export function createSuccessSchema<T extends z.ZodType>(dataSchema: T): z.ZodObject<{
  status: z.ZodLiteral<'success'>;
  data: T;
}> {
  return z.object({
    status: z.literal('success'),
    data: dataSchema
  });
}

// =============================================================================
// READER-SPECIFIC SCHEMAS
// =============================================================================

/** Chapter info response */
export const ChapterInfoResponseSchema = z.object({
  title: z.string(),
  format: z.string(),
  pageCount: z.number().int().nonnegative()
});

/** Reading progress response */
export const ProgressResponseSchema = z.object({
  currentPage: z.number().int().min(0)
});

/** Page request parameters (for REST API) */
export const PageRequestParamsSchema = z.object({
  mangaId: PositiveIntId,
  chapterId: PositiveIntId,
  pageNumber: PageNumber
});

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
export type ChapterInfoResponse = z.infer<typeof ChapterInfoResponseSchema>;
export type ProgressResponse = z.infer<typeof ProgressResponseSchema>;
export type PageRequestParams = z.infer<typeof PageRequestParamsSchema>;
export type PaginationParams = z.infer<typeof PaginationInput>;
export type DateRangeParams = z.infer<typeof DateRangeInput>;
