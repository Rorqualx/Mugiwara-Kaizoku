/**
 * Common tRPC Validation Schemas
 * 
 * Reusable Zod schemas for common patterns across all routers.
 * These ensure consistent validation and type safety.
 * 
 * @module server/trpc/schemas
 */

import { z } from 'zod';

// ============================================
// ID Schemas
// ============================================

/**
 * Numeric ID schema
 */
export const numericIdSchema = z.number().int().positive();

/**
 * String ID schema (for UUIDs or string IDs)
 */
export const stringIdSchema = z.string().min(1);

/**
 * Flexible ID schema (accepts both number and string)
 */
export const idSchema = z.union([numericIdSchema, stringIdSchema]);

/**
 * Object with ID field
 */
export const withIdSchema = z.object({
  id: idSchema,
});

// ============================================
// Pagination Schemas
// ============================================

/**
 * Pagination input schema
 */
export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).optional(),
});

/**
 * Cursor-based pagination schema
 */
export const cursorPaginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
});

// ============================================
// Sorting Schemas
// ============================================

/**
 * Sort direction
 */
export const sortDirectionSchema = z.enum(['asc', 'desc']);

/**
 * Generic sort schema
 */
export const sortSchema = z.object({
  field: z.string(),
  direction: sortDirectionSchema["default"]('asc'),
});

// ============================================
// Search & Filter Schemas
// ============================================

/**
 * Search query schema
 */
export const searchSchema = z.object({
  query: z.string().min(1).max(500),
  fields: z.array(z.string()).optional(),
});

/**
 * Date range filter
 */
export const dateRangeSchema = z.object({
  from: z.date().or(z.string().datetime()),
  to: z.date().or(z.string().datetime()),
});

/**
 * Generic filter schema
 */
export const filterSchema = z.object({
  field: z.string(),
  operator: z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'in', 'nin']),
  value: z.any(),
});

// ============================================
// Response Wrapper Schemas
// ============================================

/**
 * Success response wrapper
 */
export function successResponseSchema<T extends z.ZodType>(dataSchema: T): z.ZodObject<{
  success: z.ZodLiteral<true>;
  data: T;
  timestamp: z.ZodOptional<z.ZodString>;
}> {
  return z.object({
    success: z.literal(true),
    data: dataSchema,
    timestamp: z.string().datetime().optional(),
  });
}

/**
 * Error response wrapper
 */
export const errorResponseSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.any().optional(),
  }),
  timestamp: z.string().datetime().optional(),
});

/**
 * Paginated response wrapper
 */
export function paginatedResponseSchema<T extends z.ZodType>(itemSchema: T): z.ZodObject<{
  items: z.ZodArray<T>;
  total: z.ZodNumber;
  page: z.ZodNumber;
  limit: z.ZodNumber;
  hasMore: z.ZodBoolean;
}> {
  return z.object({
    items: z.array(itemSchema),
    total: z.number().int().min(0),
    page: z.number().int().min(1),
    limit: z.number().int().min(1),
    hasMore: z.boolean(),
  });
}

/**
 * Cursor paginated response wrapper
 */
export function cursorPaginatedResponseSchema<T extends z.ZodType>(itemSchema: T): z.ZodObject<{
  items: z.ZodArray<T>;
  nextCursor: z.ZodNullable<z.ZodString>;
  hasMore: z.ZodBoolean;
}> {
  return z.object({
    items: z.array(itemSchema),
    nextCursor: z.string().nullable(),
    hasMore: z.boolean(),
  });
}

// ============================================
// Common Entity Schemas
// ============================================

/**
 * Timestamp fields
 */
export const timestampsSchema = z.object({
  createdAt: z.date().or(z.string().datetime()),
  updatedAt: z.date().or(z.string().datetime()),
});

/**
 * Soft delete fields
 */
export const softDeleteSchema = z.object({
  deletedAt: z.date().or(z.string().datetime()).nullable(),
  isDeleted: z.boolean().default(false),
});

/**
 * User reference schema
 */
export const userRefSchema = z.object({
  userId: numericIdSchema,
  username: z.string().optional(),
});

// ============================================
// File & Media Schemas
// ============================================

/**
 * File upload schema
 */
export const fileUploadSchema = z.object({
  filename: z.string(),
  mimetype: z.string(),
  size: z.number().int().positive().max(100 * 1024 * 1024), // 100MB max
  data: z.string().or(z.instanceof(Buffer)),
});

/**
 * Image URL schema
 */
export const imageUrlSchema = z.string().url().refine(
  (url) => /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url),
  'Must be a valid image URL'
);

// ============================================
// Validation Helpers
// ============================================

/**
 * Optional field helper
 */
export function optional<T extends z.ZodType>(schema: T): z.ZodNullable<z.ZodOptional<T>> {
  return schema.optional().nullable();
}

/**
 * Array with min/max items
 */
export function arrayWithLimits<T extends z.ZodType>(
  schema: T,
  min = 0,
  max = 100
): z.ZodArray<T> {
  return z.array(schema).min(min).max(max);
}

/**
 * String with length limits
 */
export function stringWithLimits(min = 1, max = 500): z.ZodString {
  return z.string().min(min).max(max);
}

/**
 * Email schema with additional validation
 */
export const emailSchema = z.string().email().toLowerCase().trim();

/**
 * URL schema with additional validation
 */
export const urlSchema = z.string().url().trim();

/**
 * JSON schema
 */
export const jsonSchema = z.string().transform((str, ctx): unknown => {
  try {
    return JSON.parse(str) as unknown;
  } catch (_e) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Invalid JSON',
    });
    return z.NEVER;
  }
});

// ============================================
// Enum Helpers
// ============================================

/**
 * Create enum schema from object values
 */
export function enumFromObject<T extends Record<string, string>>(
  obj: T
): z.ZodEnum<[T[keyof T], ...T[keyof T][]]> {
  const values = Object.values(obj) as [T[keyof T], ...T[keyof T][]];
  return z.enum(values);
}

// ============================================
// Export all schemas
// ============================================

export default {
  // IDs
  id: idSchema,
  numericId: numericIdSchema,
  stringId: stringIdSchema,
  withId: withIdSchema,
  
  // Pagination
  pagination: paginationSchema,
  cursorPagination: cursorPaginationSchema,
  
  // Sorting
  sort: sortSchema,
  sortDirection: sortDirectionSchema,
  
  // Search & Filter
  search: searchSchema,
  filter: filterSchema,
  dateRange: dateRangeSchema,
  
  // Response wrappers
  successResponse: successResponseSchema,
  errorResponse: errorResponseSchema,
  paginatedResponse: paginatedResponseSchema,
  cursorPaginatedResponse: cursorPaginatedResponseSchema,
  
  // Common fields
  timestamps: timestampsSchema,
  softDelete: softDeleteSchema,
  userRef: userRefSchema,
  
  // Files & Media
  fileUpload: fileUploadSchema,
  imageUrl: imageUrlSchema,
  
  // Validation helpers
  email: emailSchema,
  url: urlSchema,
  json: jsonSchema,
  
  // Helper functions
  optional,
  arrayWithLimits,
  stringWithLimits,
  enumFromObject,
};

// ============= OUTPUT VALIDATION SCHEMAS =============

/**
 * Standard success response schema
 */
export const successSchema = z.object({
  success: z.literal(true),
  message: z.string().optional(),
  data: z.any().optional(),
});

/**
 * Success response with value field
 */
export const successWithValueSchema = z.object({
  success: z.literal(true),
  value: z.any(),
  message: z.string().optional(),
});

/**
 * Success response with settings field
 */
export const successWithSettingsSchema = z.object({
  success: z.literal(true),
  settings: z.any(),
  message: z.string().optional(),
});

/**
 * Success response with config field
 */
export const successWithConfigSchema = z.object({
  success: z.literal(true),
  config: z.any(),
  message: z.string().optional(),
});

/**
 * Success response with backupId field
 */
export const successWithBackupIdSchema = z.object({
  success: z.literal(true),
  backupId: z.string(),
  backupPath: z.string().optional(),
  message: z.string().optional(),
});

/**
 * Standard error response schema
 */
export const errorSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  code: z.string().optional(),
  details: z.any().optional(),
});

/**
 * Paginated list response schema factory
 */
export const paginatedSchema = <T extends z.ZodType>(itemSchema: T): z.ZodObject<{
  items: z.ZodArray<T>;
  total: z.ZodNumber;
  page: z.ZodOptional<z.ZodNumber>;
  limit: z.ZodOptional<z.ZodNumber>;
  hasMore: z.ZodBoolean;
}> => z.object({
  items: z.array(itemSchema),
  total: z.number(),
  page: z.number().optional(),
  limit: z.number().optional(),
  hasMore: z.boolean(),
});

/**
 * ID response schema (using existing idSchema)
 */
export const idResponseSchema = withIdSchema;

/**
 * Count response schema
 */
export const countSchema = z.object({
  count: z.number(),
});

/**
 * Boolean result schema
 */
export const booleanResultSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
});

/**
 * List response schema factory
 */
export const listSchema = <T extends z.ZodType>(itemSchema: T): z.ZodArray<T> => z.array(itemSchema);

/**
 * Optional wrapper schema
 */
export const optionalSchema = <T extends z.ZodType>(schema: T): z.ZodOptional<z.ZodNullable<T>> => schema.nullable().optional();
