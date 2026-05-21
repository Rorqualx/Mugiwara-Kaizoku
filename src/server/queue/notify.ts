/**
 * @module server/queue/notify
 * @description Task notification and state management system
 * Provides functionality for:
 * - Type-safe task enqueueing
 * - Task state transitions
 * - Error handling and reporting
 * - Task lifecycle management
 *
 * @example
 * ```ts
 * // Enqueue a new task
 * await enqueue(JobType.JobType.chapter_check, {
 *   mangaId: 42,
 *   chapterIndex: 5
 * });
 *
 * // Process task lifecycle
 * const task = await dequeueTask('CHAPTER_CHECK');
 * if (task) {
 *   try {
 *     // Process task
 *     await markTaskAsCompleted(task["id"]);
 *   } catch (error) {
 *     await markTaskAsFailed(task["id"], error);
 *   }
 * }
 * ```
 */
import { JobType } from '@prisma/client';

import { ValidationError } from '@/utils/errors';



import { prisma } from "../db";

import type { jobs } from '@prisma/client';
/**
 * Enqueues a new task with type-safe payload validation
 *
 * @template K - Task type from TaskPayload keys
 * @param {K} jobType - Type of task to enqueue
 * @param {TaskPayload[K]} payload - Type-safe payload for the task
 * @returns {Promise<void>}
 * @throws {Error} When task creation fails
 *
 * @example
 * ```ts
 * await enqueue(JobType.JobType.chapter_check, {
 *   mangaId: 42,
 *   chapterIndex: 5
 * });
 * ```
 */
export async function enqueueTask<K extends JobType>(jobType: K, payload: unknown): Promise<void> {
  // Ensure job type is a valid JobType
  if (!Object.values(JobType).includes(jobType)) {
    throw new ValidationError(`Invalid job type: ${jobType}`);
  }
  // Use the new queue manager
  const { queueManager } = await import('./queueManager');
  await queueManager.enqueue(jobType, payload);
}
/**
 * Retrieves the next pending task of specified type
 * Orders tasks by creation time to ensure FIFO processing
 *
 * @param {string} jobType - Type of task to dequeue
 * @returns {Promise<TaskEntity | null>} Next available task or null
 * @throws {Error} When dequeuing fails
 *
 * @example
 * ```ts
 * const task = await dequeueTask('CHAPTER_CHECK');
 * if (task) {
 *   // Process task
 * }
 * ```
 */
export async function dequeueTask(jobType: string): Promise<jobs | null> {
  // Convert string to JobType enum
  const prismaJobType = jobType as JobType;

  // Query for pending jobs
  const jobRecords = await prisma.$queryRaw<jobs[]>`
    SELECT * FROM jobs
    WHERE job_type = ${prismaJobType}
      AND status = 'pending'::"JobStatus"
      AND scheduled_for <= NOW()
    ORDER BY created_at ASC
    LIMIT 1
  `;

  return jobRecords[0] ?? null;
}
/**
 * Updates task status to completed
 * Records completion time and cleans up task state
 *
 * @param {number} taskId - ID of task to complete
 * @returns {Promise<void>}
 * @throws {Error} When update fails
 *
 * @example
 * ```ts
 * await markTaskAsCompleted(42);
 * ```
 */
export async function markTaskAsCompleted(jobId: number): Promise<void> {
  const jobIdBigInt = BigInt(jobId);
  await prisma.$queryRaw`
    SELECT complete_job(${jobIdBigInt}::BIGINT, NULL::JSONB)
  `;
}
/**
 * Updates task status to failed with error details
 * Handles both Error objects and string messages
 *
 * @param {number} taskId - ID of task to fail
 * @param {Error | string} error - Error details
 * @returns {Promise<void>}
 * @throws {Error} When update fails
 *
 * @example
 * ```ts
 * await markTaskAsFailed(42, new Error('Download failed'));
 * await markTaskAsFailed(42, 'Invalid chapter index');
 * ```
 */
export async function markTaskAsFailed(jobId: number, error: Error | string): Promise<void> {
  const errorMessage = error instanceof Error ? error.message : error;
  const jobIdBigInt = BigInt(jobId);
  await prisma.$queryRaw`
    SELECT fail_job(${jobIdBigInt}::BIGINT, ${errorMessage}::TEXT)
  `;
}