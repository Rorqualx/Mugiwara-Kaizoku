/**
 * API Validation Middleware
 * 
 * Provides request validation using Zod schemas
 */
import { z, ZodError } from 'zod';

import { ApiValidationError } from '@/utils/api-helpers';

import type { ZodSchema } from 'zod';
/**
 * Validate request data against a Zod schema
 */
export async function validateRequest<T>(
  data: unknown,
  schema: ZodSchema<T>
): Promise<T> {
  try {
    return await schema.parseAsync(data);
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      const firstError = error.errors[0];
      if (!firstError) {
        throw new ApiValidationError('Validation failed');
      }
      throw new ApiValidationError(
        `${firstError.path.join('.')}: ${firstError.message}`
      );
    }
    throw error;
  }
}
/**
 * Common validation schemas
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});
export const idParamSchema = z.object({
  id: z.union([z.string(), z.coerce.number()]),
});
/**
 * Create a validation middleware for a specific schema
 */
export function createValidationMiddleware<T>(
  schema: ZodSchema<T>,
  source: 'body' | 'query' | 'params' = 'body'
): (req: Record<string, unknown>, res: unknown, next: (error?: unknown) => void) => Promise<void> {
  return async (req: Record<string, unknown>, res: unknown, next: (error?: unknown) => void) => {
    try {
      const data = source === 'body' ? req["body"] :
                   source === 'query' ? req["query"] :
                   req["params"];
      const validated = await validateRequest(data, schema);
      // Replace original data with validated data
      // This is a standard Express middleware pattern that requires modifying req
      /* eslint-disable no-param-reassign */
      if (source === 'body') {
        req["body"] = validated;
      } else if (source === 'query') {
        req["query"] = validated;
      } else {
        req["params"] = validated;
      }
      /* eslint-enable no-param-reassign */
      next();
    } catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
next(errorMessage);
    }
  };
}