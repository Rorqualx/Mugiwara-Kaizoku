/**
 * Zod schemas for common API responses
 *
 * Used for validating response.json() data from internal and external APIs
 */

import { z } from 'zod';

/**
 * Standard success/error API response
 */
export const ApiResponseSchema = z.object({
  success: z.boolean(),
  data: z.unknown().optional(),
  error: z.string().optional(),
  message: z.string().optional(),
});

export type ApiResponse<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
};

/**
 * User CRUD operation response
 */
export const UserCrudResponseSchema = z.object({
  success: z.boolean(),
  userId: z.string().optional(),
  error: z.string().optional(),
});

export type UserCrudResponse = z.infer<typeof UserCrudResponseSchema>;

/**
 * Authentication response with JWT token
 */
export const AuthResponseSchema = z.object({
  token: z.string(),
  expiresIn: z.number().optional(),
  refreshToken: z.string().optional(),
  userId: z.string().optional(),
});

export type AuthResponse = z.infer<typeof AuthResponseSchema>;

/**
 * Chapter info response for reader
 */
export const ChapterInfoResponseSchema = z.object({
  id: z.number(),
  chapterNumber: z.number(),
  title: z.string().optional(),
  mangaId: z.number(),
  pages: z.array(z.object({
    url: z.string().url(),
    pageNumber: z.number(),
  })),
  nextChapterId: z.number().optional(),
  previousChapterId: z.number().optional(),
});

export type ChapterInfoResponse = z.infer<typeof ChapterInfoResponseSchema>;

/**
 * Reading progress response
 */
export const ReadingProgressResponseSchema = z.object({
  chapterId: z.number(),
  mangaId: z.number(),
  currentPage: z.number(),
  totalPages: z.number(),
  lastReadAt: z.string().datetime(),
  completed: z.boolean(),
});

export type ReadingProgressResponse = z.infer<typeof ReadingProgressResponseSchema>;

/**
 * Prowlarr indexer response
 */
export const ProwlarrIndexerSchema = z.object({
  id: z.number(),
  name: z.string(),
  fields: z.array(z.object({
    name: z.string(),
    value: z.unknown(),
  })),
  implementationName: z.string().optional(),
  implementation: z.string().optional(),
  configContract: z.string().optional(),
  protocol: z.string().optional(),
  priority: z.number().optional(),
  enable: z.boolean().optional(),
});

export type ProwlarrIndexer = z.infer<typeof ProwlarrIndexerSchema>;

/**
 * Generic paginated response
 */
export function createPaginatedResponseSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    items: z.array(itemSchema),
    total: z.number(),
    page: z.number(),
    pageSize: z.number(),
    hasMore: z.boolean(),
  });
}

/**
 * Error response with details
 */
export const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
  statusCode: z.number().optional(),
  details: z.unknown().optional(),
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

/**
 * Safe API response parser with error handling
 */
export function parseApiResponse<T>(
  data: unknown,
  dataSchema?: z.ZodType<T>
): ApiResponse<T> | null {
  const result = ApiResponseSchema.safeParse(data);
  if (!result.success) {
    console.error('ApiResponse validation failed:', result.error.issues);
    return null;
  }

  // If dataSchema provided, validate the data field
  if (dataSchema && result.data.data !== undefined) {
    const dataResult = dataSchema.safeParse(result.data.data);
    if (!dataResult.success) {
      console.error('ApiResponse.data validation failed:', dataResult.error.issues);
      return null;
    }
    return {
      ...result.data,
      data: dataResult.data,
    };
  }

  return result.data as ApiResponse<T>;
}
