/**
 * @module server/queue/type
 * @description Task payload type definitions and validation schemas
 * Provides:
 * - Zod schemas for task payload validation
 * - Type-safe payload type inference
 * - Runtime validation for task data
 * 
 * @example
 * ```ts
 * // Validate task payload
 * const payload = taskPayloadSchemas[JobType.chapter_check].parse({
 *   mangaId: 42,
 *   chapterIndex: 5
 * });
 * 
 * // Type-safe payload access
 * const notifyPayload: TaskPayloads[JobType.NOTIFY] = {
 *   title: 'Update Complete',
 *   message: 'All chapters synced',
 *   level: 'info'
 * };
 * ```
 */
import { z } from 'zod';

// Import JobType as alias for backward compatibility
import { JobType } from '@/utils/job-validation';

/**
 * Zod validation schemas for task payloads
 * Provides runtime validation for each task type
 * 
 * @const {Object.<JobType, z.ZodObject>}
 * 
 * @example
 * ```ts
 * // Validate chapter check payload
 * const isValid = taskPayloadSchemas[JobType.chapter_check]
 *   .safeParse({
 *     mangaId: 42,
 *     chapterIndex: 5
 *   }).success;
 * ```
 */
export const taskPayloadSchemas: Record<string, z.ZodType> = {
  [JobType.chapter_check]: z.object({
    mangaId: z.number(),
    chapterIndex: z.number().optional()
  }),
  
  [JobType.metadata_update]: z.object({
    mangaId: z.number(),
    metadata: z.record(z.unknown())
  }),
  
  [JobType.chapter_sync]: z.object({
    mangaId: z.number(),
    chapterIds: z.array(z.number())
  }),
  
  [JobType.notification_send]: z.object({
    title: z.string(),
    message: z.string(),
    level: z.enum(['info', 'warning', 'error'])
  })
};

/**
 * Type-safe mapping of task types to their payload types
 * Infers types from Zod schemas for compile-time safety
 * 
 * @type {Object.<JobType, any>}
 * 
 * @example
 * ```ts
 * // Type-safe payload definition
 * const payload: TaskPayloads[JobType.NOTIFY] = {
 *   title: 'Success',
 *   message: 'Operation completed',
 *   level: 'info'
 * };
 * ```
 */
export type TaskPayloads = {
  [K in JobType]: K extends keyof typeof taskPayloadSchemas 
    ? z.infer<typeof taskPayloadSchemas[K]> 
    : Record<string, unknown>
};
