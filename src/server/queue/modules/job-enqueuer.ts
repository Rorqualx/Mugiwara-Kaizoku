/**
 * Job enqueueing logic for the queue system
 *
 * @module server/queue/modules/job-enqueuer
 */

import { EventEmitter } from 'events';


import { JobType, JobPriority } from '@prisma/client';

import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';


import { VolatileJobWorker } from '../VolatileJobWorker';

import { jobCircuitBreaker } from './circuit-breaker';
import {
  EnqueueOptions,
  BatchJob,
  JobEvent,
  VOLATILE_JOB_TYPES,
  PRIORITY_MAP
} from './types';

export class JobEnqueuer {
  private eventEmitter: EventEmitter;

  constructor(eventEmitter: EventEmitter) {
    this.eventEmitter = eventEmitter;
  }

  /**
   * Determine if a job should be volatile
   */
  isVolatileJobType(jobType: string): boolean {
    return VOLATILE_JOB_TYPES.has(jobType);
  }

  /**
   * Coalesce the optional manga/chapter/owner references to explicit nulls for
   * the raw INSERT. Extracted so the `??` fallbacks don't inflate `enqueue`'s
   * cyclomatic complexity.
   */
  private entityRefs(options: EnqueueOptions): {
    mangaId: number | null;
    chapterId: number | null;
    initiatedByUserId: string | null;
  } {
    return {
      mangaId: options.mangaId ?? null,
      chapterId: options.chapterId ?? null,
      initiatedByUserId: options.initiatedByUserId ?? null,
    };
  }

  /**
   * Enqueue a new job (routes to volatile or durable queue based on job type)
   */
  async enqueue(
    jobType: JobType | string,
    payload: unknown,
    options: EnqueueOptions = {}
  ): Promise<bigint> {
    try {
      // Check circuit breaker - prevent enqueueing jobs that repeatedly fail
      if (jobCircuitBreaker.isOpen(jobType, payload)) {
        const state = jobCircuitBreaker.getState(jobType, payload);
        logger.warn('Circuit breaker is open - rejecting job', {
          jobType,
          failures: state?.failures,
          cooldownRemaining: state ? this.getCooldownRemaining(state.lastFailure) : 0
        });
        throw new Error(
          `Circuit breaker open for ${jobType}. Too many recent failures. ` +
          `Try again later or reset the circuit.`
        );
      }

      // Check if this should be a volatile job
      if (this.isVolatileJobType(jobType)) {
        return await this.enqueueVolatile(jobType, payload, options);
      }

      // Get priority values - enum for Prisma, numeric for logging
      const priorityEnum = this.getJobPriorityEnum(options.priority);
      const priorityNumeric = this.getPriorityNumericValue(options.priority);

      // Get queue configuration
      const queueName = options.queueName ?? 'default';
      const queueConfig = await prisma.queue_config.findUnique({
        where: { queue_name: queueName }
      });

      if (!queueConfig?.is_active) {
        throw new Error(`Queue '${queueName}' is not active or does not exist`);
      }

      // Use raw SQL with NOW() to avoid JS Date/PostgreSQL timezone mismatch.
      // Prisma's @default(now()) generates JS Date values that get misinterpreted
      // when the DB session timezone differs from UTC.
      const maxAttempts = options.maxAttempts ?? queueConfig.default_max_attempts ?? 3;
      const retryDelay = options.retryDelaySeconds ?? queueConfig.default_retry_delay_seconds ?? 60;
      const payloadJson = JSON.stringify(payload ?? {});
      const metadataJson = JSON.stringify(options.metadata ?? {});
      const { mangaId, chapterId, initiatedByUserId } = this.entityRefs(options);

      // For scheduled jobs, compute delay in seconds from now; otherwise use NOW()
      const delaySec = options.scheduledFor !== undefined
        ? Math.max(0, Math.round((options.scheduledFor.getTime() - Date.now()) / 1000))
        : 0;

      const result = await prisma.$queryRaw<Array<{ id: bigint }>>`
        INSERT INTO jobs (
          queue_name, job_type, priority, payload, metadata,
          scheduled_for, max_attempts, retry_delay_seconds,
          partition_key, manga_id, chapter_id, initiated_by_user_id
        ) VALUES (
          ${queueName},
          ${jobType}::"JobType",
          ${priorityEnum}::"JobPriority",
          ${payloadJson}::jsonb,
          ${metadataJson}::jsonb,
          NOW() + (${delaySec} * INTERVAL '1 second'),
          ${maxAttempts},
          ${retryDelay},
          'active',
          ${mangaId}::integer,
          ${chapterId}::integer,
          ${initiatedByUserId}::text
        )
        RETURNING id
      `;

      const job = result[0];
      if (!job) {
        throw new Error('Failed to insert job - no ID returned');
      }
      const jobId = job.id;

      logger.info(`Enqueued job ${jobId} of type ${jobType} to queue ${queueName}`, {
        priority: priorityNumeric,
        scheduledFor: options.scheduledFor,
        mangaId: options.mangaId,
        chapterId: options.chapterId
      });

      this.emitJobEvent('job:enqueued', {
        jobId,
        jobType,
        queueName,
        priority: priorityNumeric
      });

      return jobId;
    } catch (error) {
      logger.error(`Failed to enqueue job of type ${jobType}:`, error);
      throw error;
    }
  }

  /**
   * Enqueue a volatile job (ephemeral, high-throughput)
   */
  private async enqueueVolatile(
    jobType: string,
    payload: unknown,
    options: EnqueueOptions = {}
  ): Promise<bigint> {
    try {
      const priority = typeof options.priority === 'number'
        ? options.priority
        : 50;

      const jobId = await VolatileJobWorker.enqueue(jobType, payload, {
        queueName: options.queueName ?? 'volatile',
        priority,
        ...(options.scheduledFor !== undefined ? { scheduledFor: options.scheduledFor } : {})
      });

      logger.debug(`Enqueued volatile job ${jobId} of type ${jobType}`, {
        priority,
        scheduledFor: options.scheduledFor
      });

      this.emitJobEvent('job:enqueued:volatile', {
        jobId,
        jobType,
        queueName: 'volatile',
        priority
      });

      return jobId;
    } catch (error) {
      logger.error(`Failed to enqueue volatile job of type ${jobType}:`, error);
      throw error;
    }
  }

  /**
   * Enqueue multiple jobs in a batch
   */
  async enqueueBatch(jobs: BatchJob[]): Promise<bigint[]> {
    // Use a transaction for batch enqueue
    const jobIds = await prisma.$transaction(async () => {
      const ids: bigint[] = [];

      // Process all jobs in parallel within the transaction
      const enqueuePromises = jobs.map(job =>
        this.enqueue(job.jobType, job.payload, job.options)
      );

      const results = await Promise.all(enqueuePromises);
      ids.push(...results);

      return ids;
    });

    logger.info(`Enqueued batch of ${jobIds.length} jobs`);
    return jobIds;
  }

  /**
   * Convert priority to numeric value (for volatile jobs and logging)
   */
  private getPriorityNumericValue(priority?: number | JobPriority): number {
    if (typeof priority === 'string') {
      return PRIORITY_MAP[priority as JobPriority];
    }
    return priority ?? 50;
  }

  /**
   * Get JobPriority enum value for Prisma
   */
  private getJobPriorityEnum(priority?: number | JobPriority): JobPriority {
    if (typeof priority === 'string') {
      return priority as JobPriority;
    }
    // Convert numeric priority to enum (closest match)
    if (priority !== undefined) {
      if (priority >= 500) return JobPriority.critical;
      if (priority >= 75) return JobPriority.high;
      if (priority >= 25) return JobPriority.normal;
      return JobPriority.low;
    }
    return JobPriority.normal; // Default
  }

  /**
   * Emit job event
   */
  private emitJobEvent(event: string, data: JobEvent): void {
    this.eventEmitter.emit(event, data);
  }

  /**
   * Calculate remaining cooldown time in ms
   */
  private getCooldownRemaining(lastFailure: number): number {
    const cooldownPeriod = 5 * 60 * 1000; // 5 minutes
    const elapsed = Date.now() - lastFailure;
    return Math.max(0, cooldownPeriod - elapsed);
  }

  /**
   * Get circuit breaker stats for monitoring
   */
  getCircuitBreakerStats(): { totalCircuits: number; openCircuits: number; keys: string[] } {
    return jobCircuitBreaker.getStats();
  }

  /**
   * Reset circuit breaker for a specific job type/payload
   */
  resetCircuitBreaker(jobType: string, payload: unknown): void {
    jobCircuitBreaker.reset(jobType, payload);
  }

  /**
   * Reset all circuit breakers
   */
  resetAllCircuitBreakers(): void {
    jobCircuitBreaker.resetAll();
  }
}