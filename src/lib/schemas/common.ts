/**
 * Common Zod Schemas for External API Responses
 *
 * This module provides reusable Zod schemas for validating external API responses.
 * These schemas ensure runtime type safety for untrusted external data.
 *
 * @module schemas/common
 */

import { z } from 'zod';

/**
 * Base error schema for API responses
 */
export const ApiErrorSchema = z.object({
  message: z.string(),
  code: z.string().optional(),
  statusCode: z.number().optional(),
  details: z.unknown().optional(),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;

/**
 * Pagination schema for paginated responses
 */
export const PaginationSchema = z.object({
  total: z.number(),
  perPage: z.number().optional(),
  currentPage: z.number().optional(),
  lastPage: z.number().optional(),
  hasNextPage: z.boolean().optional(),
});

export type Pagination = z.infer<typeof PaginationSchema>;

/**
 * Generic paginated response wrapper
 */
export const createPaginatedResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T): z.ZodObject<{
  data: z.ZodArray<T>;
  pagination: z.ZodOptional<typeof PaginationSchema>;
}> =>
  z.object({
    data: z.array(dataSchema),
    pagination: PaginationSchema.optional(),
  });

/**
 * Generic API response wrapper
 * Supports both success and error states
 */
export const createApiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T): z.ZodUnion<[
  z.ZodObject<{ success: z.ZodLiteral<true>; data: T }>,
  z.ZodObject<{ success: z.ZodLiteral<false>; error: typeof ApiErrorSchema }>
]> =>
  z.union([
    z.object({
      success: z.literal(true),
      data: dataSchema,
    }),
    z.object({
      success: z.literal(false),
      error: ApiErrorSchema,
    }),
  ]);

/**
 * Date string schema with validation
 * Accepts ISO 8601 date strings
 */
export const DateStringSchema = z.string().refine(
  (val) => !isNaN(Date.parse(val)),
  { message: 'Invalid date string' }
);

/**
 * URL schema with validation
 */
export const UrlSchema = z.string().url();

/**
 * Nullable string that converts null/undefined to undefined
 */
export const NullableString = z.string().nullable().transform((val): string | null => val);

/**
 * Nullable number that converts null/undefined to undefined
 */
export const NullableNumber = z.number().nullable().transform((val): number | null => val);

/**
 * Array that defaults to empty array if null/undefined
 */
export const createDefaultArraySchema = <T extends z.ZodTypeAny>(itemSchema: T): z.ZodEffects<z.ZodNullable<z.ZodArray<T>>, z.infer<T>[]> =>
  z.array(itemSchema).nullable().transform((val): z.infer<T>[] => val ?? []);

/**
 * Helper to create a lenient schema that accepts unknown fields
 * Useful for external APIs where we only care about specific fields
 */
export const createLenientSchema = <T extends z.ZodRawShape>(shape: T): z.ZodObject<T, 'passthrough'> =>
  z.object(shape).passthrough();

/**
 * Image URL schema with validation
 */
export const ImageUrlSchema = z.string().url().or(z.string().startsWith('/'));

/**
 * ID schema - accepts string or number
 */
export const IdSchema = z.union([z.string(), z.number()]);

/**
 * Common metadata schema for external entities
 */
export const ExternalMetadataSchema = z.object({
  id: IdSchema,
  title: z.string(),
  description: NullableString,
  coverUrl: NullableString,
  bannerUrl: NullableString,
  tags: createDefaultArraySchema(z.string()),
  genres: createDefaultArraySchema(z.string()),
  status: NullableString,
  updatedAt: DateStringSchema.optional(),
  createdAt: DateStringSchema.optional(),
});

export type ExternalMetadata = z.infer<typeof ExternalMetadataSchema>;
