/**
 * Volatile Job Worker - High-Performance Ephemeral Job Processing
 *
 * Processes jobs from the UNLOGGED jobs_volatile table for maximum
 * throughput. These jobs don't need durability but require speed.
 *
 * Use cases:
 * - Cache invalidation
 * - Real-time notifications
 * - Metrics collection
 * - Temporary computations
 *
 * Features:
 * - 2-3x write performance with UNLOGGED table
 * - No WAL overhead
 * - Automatic cleanup on restart
 * - Fire-and-forget semantics
 *
 * @module server/queue/VolatileJobWorker
 */

import { EventEmitter } from 'events';
import { hostname } from 'os';

import { logger } from '@/utils/logger';

import { prisma } from '../db';

export interface VolatileJobConfig {
  workerId?: string;
  queueName?: string;
  batchSize?: number;
  pollInterval?: number;
  maxConcurrency?: number;
  autoDelete?: boolean; // Delete completed jobs immediately
}

export interface VolatileJob {
  id: bigint;
  queueName: string;
  jobType: string;
  priority: number;
  payload: unknown;
  status: string;
  createdAt: Date;
  scheduledFor: Date;
}

export type VolatileJobHandler = (job: VolatileJob) => Promise<void>;

/**
 * High-performance worker for volatile jobs
 */
export class VolatileJobWorker extends EventEmitter {
  private readonly config: Required<VolatileJobConfig>;
  private readonly workerId: string;
  private readonly handlers: Map<string, VolatileJobHandler> = new Map();
  private isRunning = false;
  private isShuttingDown = false;
  private activeJobs = new Set<bigint>();
  private processingPromises: Promise<void>[] = [];
  private pollTimer: NodeJS.Timeout | null = null;
  private stats = {
    processed: 0,
    failed: 0,
    startTime: new Date()
  };

  constructor(config: VolatileJobConfig = {}) {
    super();

    this.workerId = config.workerId ?? `volatile-${hostname()}-${process.pid}-${Date.now()}`;

    this.config = {
      workerId: this.workerId,
      queueName: config.queueName ?? 'volatile',
      batchSize: config.batchSize ?? 50, // Larger batches for volatile jobs
      pollInterval: config.pollInterval ?? 100, // Faster polling
      maxConcurrency: config.maxConcurrency ?? 20, // Higher concurrency
      autoDelete: config.autoDelete !== false
    };

    logger.info(`VolatileJobWorker ${this.workerId} initialized`, {
      config: this.config
    });
  }

  /**
   * Register a job handler
   */
  registerHandler(jobType: string, handler: VolatileJobHandler): void {
    this.handlers.set(jobType, handler);
    logger.debug(`Registered volatile handler for job type: ${jobType}`);
  }

  /**
   * Start the worker
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('VolatileJobWorker already running');
      return;
    }

    this.isRunning = true;
    this.isShuttingDown = false;

    logger.info(`VolatileJobWorker ${this.workerId} starting`);

    // Clean up any stale jobs (since UNLOGGED tables don't persist)
    await this.cleanupStaleJobs();

    // Start polling
    this.startPolling();

    this.emit('started');
  }

  /**
   * Stop the worker
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logger.info(`VolatileJobWorker ${this.workerId} stopping`);

    this.isShuttingDown = true;

    // Stop polling
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    // Wait for active jobs to complete
    if (this.activeJobs.size > 0) {
      logger.info(`Waiting for ${this.activeJobs.size} active jobs to complete`);
      await Promise.allSettled(this.processingPromises);
    }

    this.isRunning = false;

    logger.info(`VolatileJobWorker ${this.workerId} stopped`, {
      stats: this.getStats()
    });

    this.emit('stopped');
  }

  /**
   * Start polling for jobs
   */
  private startPolling(): void {
    const poll = async (): Promise<void> => {
      if (this.isShuttingDown) {
        return;
      }

      // Check concurrency limit
      if (this.activeJobs.size >= this.config.maxConcurrency) {
        return;
      }

      try {
        const jobs = await this.claimJobs();

        if (jobs.length > 0) {
          // Process jobs concurrently
          const promises = jobs.map(job => this.processJob(job));
          this.processingPromises.push(...promises);

          // Clean up completed promises
          // Note: Direct promise completion checking is not reliable in JavaScript
          // Relying on natural promise resolution and garbage collection
          // this.processingPromises = this.processingPromises.filter(
          //   p => p.constructor["name"] !== 'Promise' ?? !p
          // );
        }
      } catch (error) {
        logger.error('Polling error:', error);
      }
    };

    // Initial poll
    void poll();

    // Set up interval
    this.pollTimer = setInterval(() => { void poll(); }, this.config.pollInterval);
  }

  /**
   * Claim jobs from the volatile queue
   */
  private async claimJobs(): Promise<VolatileJob[]> {
    try {
      // Use raw SQL for SKIP LOCKED with UNLOGGED table
      const result = await prisma.$queryRaw<VolatileJob[]>`
        WITH claimed_jobs AS (
          SELECT id
          FROM jobs_volatile
          WHERE queue_name = ${this.config.queueName}
            AND status = 'PENDING'
            AND scheduled_for <= NOW()
          ORDER BY priority DESC, created_at ASC
          LIMIT ${this.config.batchSize}
          FOR UPDATE SKIP LOCKED
        )
        UPDATE jobs_volatile j
        SET
          status = 'ACTIVE',
          worker_id = ${this.workerId},
          started_at = NOW(),
          lease_expires_at = NOW() + INTERVAL '30 seconds'
        FROM claimed_jobs c
        WHERE j["id"] = c.id
        RETURNING j.*
      `;

      if (result.length > 0) {
        logger.debug(`Claimed ${result.length} volatile jobs`);
        result.forEach(job => this.activeJobs.add(job["id"]));
      }

      return result;
    } catch (error) {
      logger.error('Failed to claim volatile jobs:', error);
      return [];
    }
  }

  /**
   * Process a single job
   */
  private async processJob(job: VolatileJob): Promise<void> {
    const startTime = Date.now();

    try {
      // Get handler
      const handler = this.handlers.get(job.jobType);
      if (!handler) {
        throw new Error(`No handler registered for job type: ${job.jobType}`);
      }

      // Execute handler
      await handler(job);

      // Mark as completed
      if (this.config.autoDelete) {
        // Delete immediately for volatile jobs
        await prisma.$executeRaw`
          DELETE FROM jobs_volatile WHERE id = ${job["id"]}
        `;
      } else {
        // Just mark as completed
        await prisma.$executeRaw`
          UPDATE jobs_volatile
          SET
            status = 'COMPLETED',
            completed_at = NOW(),
            processing_time_ms = ${Date.now() - startTime}
          WHERE id = ${job["id"]}
        `;
      }

      this.stats.processed++;
      this.emit('job:completed', job);

      logger.debug(`Volatile job ${job["id"]} completed in ${Date.now() - startTime}ms`);
    } catch (error) {
      logger.error(`Volatile job ${job["id"]} failed:`, error);

      // Mark as failed (volatile jobs typically don't retry)
      await prisma.$executeRaw`
        UPDATE jobs_volatile
        SET
          status = 'FAILED',
          completed_at = NOW(),
          processing_time_ms = ${Date.now() - startTime}
        WHERE id = ${job["id"]}
      `;

      this.stats.failed++;
      this.emit('job:failed', job, error);
    } finally {
      this.activeJobs.delete(job["id"]);
    }
  }

  /**
   * Clean up stale jobs (called on startup)
   */
  private async cleanupStaleJobs(): Promise<void> {
    try {
      // Since UNLOGGED tables are wiped on crash, this mainly handles
      // jobs that were marked as ACTIVE but the worker died gracefully
      const cleaned = await prisma.$executeRaw`
        UPDATE jobs_volatile
        SET status = 'PENDING', worker_id = NULL
        WHERE status = 'ACTIVE'
          AND lease_expires_at < NOW()
      `;

      if (cleaned > 0) {
        logger.info(`Cleaned up ${cleaned} stale volatile jobs`);
      }

      // Also delete old completed/failed jobs
      const deleted = await prisma.$executeRaw`
        DELETE FROM jobs_volatile
        WHERE status IN ('COMPLETED', 'FAILED')
          AND completed_at < NOW() - INTERVAL '1 hour'
      `;

      if (deleted > 0) {
        logger.info(`Deleted ${deleted} old volatile jobs`);
      }
    } catch (error) {
      logger.error('Failed to clean up stale jobs:', error);
    }
  }

  /**
   * Get worker statistics
   */
  getStats(): {
    workerId: string;
    processed: number;
    failed: number;
    active: number;
    throughput: number;
    uptime: number;
  } {
    const runtime = Date.now() - this.stats.startTime.getTime();
    const throughput = runtime > 0 ? (this.stats.processed / (runtime / 1000)) : 0;

    return {
      workerId: this.workerId,
      processed: this.stats.processed,
      failed: this.stats.failed,
      active: this.activeJobs.size,
      throughput: Math.round(throughput * 100) / 100,
      uptime: Math.floor(runtime / 1000)
    };
  }

  /**
   * Enqueue a volatile job
   */
  static async enqueue(
    jobType: string,
    payload: unknown,
    options: {
      queueName?: string;
      priority?: number;
      scheduledFor?: Date;
    } = {}
  ): Promise<bigint> {
    try {
      const result = await prisma.$queryRaw<{ id: bigint }[]>`
        INSERT INTO jobs_volatile (
          queue_name,
          job_type,
          payload,
          priority,
          scheduled_for
        ) VALUES (
          ${options.queueName ?? 'volatile'},
          ${jobType},
          ${JSON.stringify(payload)}::jsonb,
          ${options.priority ?? 50},
          ${options.scheduledFor ?? new Date()}
        )
        RETURNING id
      `;

      const jobId = result[0]?.id;
      if (!jobId) {
        throw new Error('Failed to enqueue job: no ID returned');
      }
      logger.debug(`Enqueued volatile job ${jobId} of type ${jobType}`);

      return jobId;
    } catch (error) {
      logger.error('Failed to enqueue volatile job:', error);
      throw error;
    }
  }

  /**
   * Bulk enqueue volatile jobs
   */
  static async enqueueBulk(
    jobs: Array<{
      jobType: string;
      payload: unknown;
      priority?: number;
      scheduledFor?: Date;
    }>,
    queueName: string = 'volatile'
  ): Promise<number> {
    try {
      const values = jobs.map(job => ({
        queue_name: queueName,
        job_type: job.jobType,
        payload: job.payload,
        priority: job.priority ?? 50,
        scheduled_for: job.scheduledFor ?? new Date()
      }));

      // Use raw SQL for bulk insert since model might not be exposed
      // Use transaction for atomic batch insert
      await prisma.$transaction(
        values.map((value) =>
          prisma.$executeRaw`
            INSERT INTO jobs_volatile (queue_name, job_type, payload, priority, scheduled_for)
            VALUES (${value.queue_name}, ${value.job_type}, ${value.payload}::jsonb, ${value.priority}, ${value.scheduled_for})
          `
        )
      );
      const insertedCount = values.length;

      logger.info(`Bulk enqueued ${insertedCount} volatile jobs`);
      return insertedCount;
    } catch (error) {
      logger.error('Failed to bulk enqueue volatile jobs:', error);
      throw error;
    }
  }
}