/**
 * High-Performance PostgreSQL Queue Worker
 *
 * Implements the PostBull pattern for high-throughput job processing
 * with SKIP LOCKED, batch processing, and real-time notifications.
 *
 * Features:
 * - SKIP LOCKED for concurrent job claiming
 * - Batch job processing
 * - LISTEN/NOTIFY for real-time job discovery
 * - Automatic retry with exponential backoff
 * - Worker health monitoring
 * - Graceful shutdown
 *
 * @module server/queue/PostgreSQLQueueWorker
 */

// Node.js global for immediate execution
declare const setImmediate: (callback: () => void) => void;

import { EventEmitter } from 'events';
import { hostname } from 'os';

import { JobType, jobs } from '@prisma/client';
import { Client } from 'pg';

import { realtimeEmitter } from '@/server/services/realtime';
import { logger } from '@/utils/logger';


import { prisma } from '../db';

import { jobCircuitBreaker } from './modules/circuit-breaker';

export interface WorkerConfig {
  workerId?: string;
  queueNames?: string[];
  batchSize?: number;
  pollInterval?: number;
  leaseTimeoutSeconds?: number;
  maxConcurrency?: number;
  heartbeatInterval?: number;
  enableNotifications?: boolean;
  connectionString?: string;
}

export interface JobHandler {
  // signal aborts when the job's `hard_timeout_at` deadline passes — handlers
  // that make long-running network calls should thread it into fetch/axios.
  // Existing handlers that ignore the second arg keep the old contract.
  (job: jobs, signal?: AbortSignal): Promise<void>;
}

export interface JobResult {
  jobId: bigint;
  success: boolean;
  error?: string;
  result?: unknown;
}

/**
 * High-performance PostgreSQL queue worker
 */
export class PostgreSQLQueueWorker extends EventEmitter {
  private readonly config: Required<WorkerConfig>;
  private readonly workerId: string;
  private readonly handlers: Map<JobType, JobHandler> = new Map();
  private notificationClient: Client | null = null;
  private isRunning = false;
  private isShuttingDown = false;
  private activeJobs = new Set<bigint>();
  private processingPromises: Promise<void>[] = [];
  private pollTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private stats = {
    jobsProcessed: 0,
    jobsFailed: 0,
    startTime: new Date()
  };

  constructor(config: WorkerConfig = {}) {
    super();

    // Generate unique worker ID
    this.workerId = config.workerId ?? `worker-${hostname()}-${process.pid}-${Date.now()}`;

    // Apply configuration with defaults
    this.config = {
      workerId: this.workerId,
      queueNames: config.queueNames ?? ['default'],
      batchSize: config.batchSize ?? 10,
      pollInterval: config.pollInterval ?? 1000,
      leaseTimeoutSeconds: config.leaseTimeoutSeconds ?? 300,
      maxConcurrency: config.maxConcurrency ?? 5,
      heartbeatInterval: config.heartbeatInterval ?? 30000,
      enableNotifications: config.enableNotifications !== false,
      connectionString: config.connectionString ?? process.env["DATABASE_URL"] ?? ''
    };

    logger.info(`Worker ${this.workerId} initialized`, {
      config: this.config
    });
  }

  /**
   * Register a job handler for a specific job type
   */
  registerHandler(jobType: JobType, handler: JobHandler): void {
    this.handlers.set(jobType, handler);
    logger.debug(`Registered handler for job type: ${jobType}`);
  }

  /**
   * Start the worker
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Worker is already running');
    }

    this.isRunning = true;
    this.isShuttingDown = false;

    try {
      // Register worker in database
      await this.registerWorker();

      // Reclaim any jobs left in `active` status from a previous incarnation
      // of this worker (e.g. dev-server restart, crash). Without this, jobs
      // sit invisible to claimJobs() until both the lease (5 min) and the
      // stale-job sweep (10 min threshold, polled every 5 min) expire —
      // observed as a ~15 min lag between /restart and downloads resuming.
      await this.recoverOrphanedJobs();

      // Set up notification listener if enabled
      if (this.config.enableNotifications) {
        await this.setupNotificationListener();
      }

      // Start heartbeat
      this.startHeartbeat();

      // Start polling
      this.startPolling();

      // Emit started event
      this.emit('started', { workerId: this.workerId });

      logger.info(`Worker ${this.workerId} started successfully`, {
        queues: this.config.queueNames,
        batchSize: this.config.batchSize,
        maxConcurrency: this.config.maxConcurrency
      });
    } catch (error) {
      this.isRunning = false;
      logger.error(`Failed to start worker ${this.workerId}:`, error);
      throw error;
    }
  }

  /**
   * Stop the worker gracefully
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logger.info(`Stopping worker ${this.workerId}...`);
    this.isShuttingDown = true;

    // Stop polling
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    // Stop heartbeat
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    // Close notification listener
    if (this.notificationClient) {
      await this.notificationClient.end();
      this.notificationClient = null;
    }

    // Wait for active jobs to complete (with 30s timeout)
    if (this.activeJobs.size > 0) {
      logger.info(`Waiting for ${this.activeJobs.size} active jobs to complete...`);
      await Promise.race([
        Promise.all(this.processingPromises),
        new Promise<void>((resolve) => {
          setTimeout(() => {
            logger.warn(`Worker ${this.workerId}: Shutdown timeout after 30s, ${this.activeJobs.size} jobs still active`);
            resolve();
          }, 30_000);
        })
      ]);
    }

    // Unregister worker
    await this.unregisterWorker();

    this.isRunning = false;
    this.emit('stopped', {
      workerId: this.workerId,
      stats: this.getStats()
    });

    logger.info(`Worker ${this.workerId} stopped successfully`);
  }

  /**
   * Process jobs - main work loop
   */
  private async processJobs(): Promise<void> {
    if (this.isShuttingDown || this.processingPromises.length >= this.config.maxConcurrency) {
      return;
    }

    try {
      // Claim a batch of jobs using SKIP LOCKED
      const jobs = await this.claimJobs();

      if (jobs.length === 0) {
        return;
      }

      // Process jobs concurrently up to max concurrency
      for (const job of jobs) {
        if (this.processingPromises.length >= this.config.maxConcurrency) {
          break;
        }

        const promise = this.processJob(job)
          .finally(() => {
            // Remove from active processing
            const index = this.processingPromises.indexOf(promise);
            if (index > -1) {
              void this.processingPromises.splice(index, 1);
            }
          });

        this.processingPromises.push(promise);
      }

      // If we got a full batch, immediately check for more
      if (jobs.length === this.config.batchSize) {
        setImmediate(() => { void this.processJobs(); });
      }
    } catch (error) {
      logger.error(`Error in job processing loop:`, error);
      this.emit('error', error);
    }
  }

  /**
   * Claim jobs from the queue using SKIP LOCKED.
   *
   * Cap the LIMIT at remaining concurrency slots. The processJobs() dispatch
   * loop breaks at `maxConcurrency`, so claiming more than that just leaks
   * `status='active'` ghosts that wait 5-15 min for stale-recovery to release.
   * Symptom: the worker drains pending, leaks all overflow to active, then
   * idles for minutes because pending/retrying is empty. min(1,…) ensures
   * we still claim at least one job when called (the caller already gates
   * on having available slots).
   */
  private async claimJobs(): Promise<jobs[]> {
    try {
      const availableSlots = this.config.maxConcurrency - this.processingPromises.length;
      const claimLimit = Math.max(1, Math.min(this.config.batchSize, availableSlots));
      // Use raw SQL for SKIP LOCKED functionality
      // Note: enum values must be lowercase to match Prisma schema
      // Pick up both 'pending' and 'retrying' jobs when scheduled_for time has passed
      const result = await prisma.$queryRaw<jobs[]>`
        WITH claimed_jobs AS (
          SELECT id
          FROM jobs
          WHERE queue_name = ANY(${this.config.queueNames}::text[])
            AND status IN ('pending'::"JobStatus", 'retrying'::"JobStatus")
            AND scheduled_for <= NOW()
          ORDER BY priority DESC, created_at ASC
          LIMIT ${claimLimit}
          FOR UPDATE SKIP LOCKED
        )
        UPDATE jobs j
        SET
          status = 'active'::"JobStatus",
          worker_id = ${this.workerId},
          started_at = NOW(),
          lease_expires_at = NOW() + (${this.config.leaseTimeoutSeconds} * INTERVAL '1 second'),
          -- Set hard timeout on first claim only (30 minutes absolute deadline)
          hard_timeout_at = COALESCE(hard_timeout_at, NOW() + INTERVAL '30 minutes'),
          attempt_count = attempt_count + 1,
          wait_time_ms = EXTRACT(MILLISECOND FROM (NOW() - created_at))::INTEGER
        FROM claimed_jobs c
        WHERE j."id" = c.id
        RETURNING j.*
      `;

      if (result.length > 0) {
        result.forEach(job => this.activeJobs.add(job["id"]));
        logger.debug(`Worker ${this.workerId} claimed ${result.length} jobs`);
      }

      return result;
    } catch (error) {
      logger.error(`Failed to claim jobs:`, error);
      return [];
    }
  }

  /**
   * Process a single job
   */
  private async processJob(job: jobs): Promise<void> {
    const startTime = Date.now();

    logger.info(`Processing job ${job["id"]} of type ${job.job_type}`, {
      workerId: this.workerId,
      queueName: job.queue_name,
      attempt: job.attempt_count
    });

    // Emit realtime event for job starting
    void realtimeEmitter.emitJobUpdate({
      jobId: String(job["id"]),
      status: 'running',
      progress: 0,
      jobType: job.job_type,
      metadata: {
        workerId: this.workerId,
        queueName: job.queue_name,
        attemptCount: job.attempt_count,
      },
    });

    try {
      // Get handler for job type
      const handler = this.handlers.get(job.job_type);
      if (!handler) {
        throw new Error(`No handler registered for job type: ${job.job_type}`);
      }

      // Hard-timeout enforcement: abort the handler when `hard_timeout_at`
      // (set on first claim, default 30 min) is reached. Without this, a
      // handler hung on a network call rides the unconditional 30s lease
      // heartbeat indefinitely — that's how a batch of mangadex_download
      // jobs spent ~15h "active" before a worker restart finally swept them.
      const abortController = new AbortController();
      let hardTimeoutHandle: NodeJS.Timeout | undefined;

      // Heartbeat. Validates ownership on every tick — if the job has been
      // archived, deleted, or stolen by another worker between ticks, the
      // handler is aborted instead of running on for hours on a job nobody
      // owns anymore (and the failed update no longer crashes the process).
      const progressInterval = setInterval(() => {
        void this.heartbeatLease(job["id"], job.partition_key, abortController);
      }, 30000);

      if (job.hard_timeout_at) {
        const msUntil = job.hard_timeout_at.getTime() - Date.now();
        if (msUntil > 0) {
          hardTimeoutHandle = setTimeout(() => {
            abortController.abort(new Error(`Hard timeout reached (${job.hard_timeout_at?.toISOString() ?? 'unknown'})`));
          }, msUntil);
        } else {
          abortController.abort(new Error('Hard timeout already passed at claim time'));
        }
      }

      try {
        // Execute handler
        await handler(job, abortController.signal);

        // Fetch current job result (handler may have stored data)
        const currentJob = await prisma.jobs.findFirst({
          where: { id: job["id"] },
          select: { result: true, partition_key: true }
        });

        logger.debug('Fetched job result after handler', {
          jobId: String(job["id"]),
          hasResult: !!currentJob?.result,
          resultType: typeof currentJob?.result,
          partitionKey: currentJob?.partition_key
        });

        // Merge handler result with processingTimeMs
        const mergedResult = {
          ...(typeof currentJob?.result === 'object' && currentJob.result !== null
            ? currentJob.result as Record<string, unknown>
            : {}),
          processingTimeMs: Date.now() - startTime
        };

        logger.debug('Merged result', {
          jobId: String(job["id"]),
          mergedKeys: Object.keys(mergedResult)
        });

        // Mark job as completed with merged result
        await this.completeJob(job["id"], mergedResult);

        // Record success in circuit breaker
        jobCircuitBreaker.recordSuccess(job.job_type, job.payload);

        this.stats.jobsProcessed++;

        logger.info(`Job ${job["id"]} completed successfully`, {
          processingTimeMs: Date.now() - startTime
        });

        this.emit('job:completed', { job, processingTimeMs: Date.now() - startTime });

        // Emit realtime event for WebSocket clients
        void realtimeEmitter.emitJobUpdate({
          jobId: String(job["id"]),
          status: 'completed',
          progress: 100,
          jobType: job.job_type,
          metadata: {
            processingTimeMs: Date.now() - startTime,
            queueName: job.queue_name,
          },
        });
      } finally {
        clearInterval(progressInterval);
        if (hardTimeoutHandle) clearTimeout(hardTimeoutHandle);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorDetails = error instanceof Error ? error.stack : undefined;

      logger.error(`Job ${job["id"]} failed:`, error);

      // Record failure in circuit breaker
      jobCircuitBreaker.recordFailure(job.job_type, job.payload, errorMessage);

      // Fail the job with retry logic
      const result = await this.failJob(job["id"], errorMessage, {
        stack: errorDetails,
        workerId: this.workerId
      });

      // Clean up associated PackDownload records when a download job fails permanently
      if (result === 'failed' && job.job_type === 'chapter_download') {
        await this.cleanupPackDownloadOnFailure(job.id);
      }

      this.stats.jobsFailed++;

      this.emit('job:failed', {
        job,
        error: errorMessage,
        willRetry: result === 'retrying'
      });

      // Emit realtime event for WebSocket clients
      void realtimeEmitter.emitJobUpdate({
        jobId: String(job["id"]),
        status: result === 'retrying' ? 'pending' : 'failed',
        error: errorMessage,
        jobType: job.job_type,
        metadata: {
          willRetry: result === 'retrying',
          attemptCount: job.attempt_count,
          queueName: job.queue_name,
        },
      });
    } finally {
      this.activeJobs.delete(job["id"]);
    }
  }

  /**
   * Complete a job successfully
   */
  private async completeJob(jobId: bigint, result?: unknown): Promise<void> {
    await prisma.$executeRaw`
      SELECT complete_job(${jobId}::BIGINT, ${result ? JSON.stringify(result) : null}::JSONB)
    `;
  }

  /**
   * Fail a job with retry logic
   */
  private async failJob(jobId: bigint, error: string, details?: unknown): Promise<string> {
    const result = await prisma.$queryRaw<{ fail_job: string }[]>`
      SELECT fail_job(
        ${jobId}::BIGINT,
        ${error}::TEXT,
        ${details ? JSON.stringify(details) : null}::JSONB
      ) as fail_job
    `;

    return result[0]?.fail_job ?? 'failed';
  }

  /**
   * Clean up associated PackDownload records when a download job fails permanently.
   * Without this, stale DOWNLOADING packs block all future download attempts.
   */
  private async cleanupPackDownloadOnFailure(jobId: bigint): Promise<void> {
    try {
      const updated = await prisma.packDownload.updateMany({
        where: { jobId, status: 'DOWNLOADING' },
        data: { status: 'FAILED' },
      });
      if (updated.count > 0) {
        logger.info(`[Worker] Marked ${updated.count} PackDownload(s) as FAILED for job ${jobId}`);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`[Worker] Failed to cleanup PackDownload for job ${jobId}: ${errorMessage}`);
    }
  }

  /**
   * Heartbeat: extend the lease iff this worker still owns the job.
   * If the row is gone or stolen, count=0 → abort the in-flight handler
   * instead of crashing the process with an unhandled P2025.
   */
  private async heartbeatLease(jobId: bigint, partitionKey: string, abortController: AbortController): Promise<void> {
    try {
      const result = await prisma.jobs.updateMany({
        where: { id: jobId, partition_key: partitionKey, worker_id: this.workerId, status: 'active' },
        data: { lease_expires_at: new Date(Date.now() + this.config.leaseTimeoutSeconds * 1000) },
      });
      if (result.count === 0 && !abortController.signal.aborted) {
        logger.warn(`Job ${jobId} lost ownership during heartbeat — aborting handler`);
        abortController.abort(new Error('Lost job ownership during heartbeat'));
      }
    } catch (err) {
      logger.warn(`Heartbeat failed for job ${jobId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Register worker in database
   */
  private async registerWorker(): Promise<void> {
    await prisma.workers.upsert({
      where: { worker_id: this.workerId },
      create: {
        worker_id: this.workerId,
        hostname: hostname(),
        pid: process.pid,
        queue_names: this.config.queueNames,
        status: 'active',
        started_at: new Date(),
        last_heartbeat_at: new Date(),
        metadata: {
          nodeVersion: process.version,
          platform: process.platform,
          config: this.config
        }
      },
      update: {
        status: 'active',
        last_heartbeat_at: new Date(),
        queue_names: this.config.queueNames
      }
    });
  }

  /**
   * Unregister worker from database
   */
  private async unregisterWorker(): Promise<void> {
    await prisma.workers.update({
      where: { worker_id: this.workerId },
      data: {
        status: 'stopped',
        last_heartbeat_at: new Date(),
        jobs_processed: this.stats.jobsProcessed,
        jobs_failed: this.stats.jobsFailed
      }
    });
  }

  /**
   * Start heartbeat to keep worker registration alive
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      void prisma.workers.update({
        where: { worker_id: this.workerId },
        data: {
          last_heartbeat_at: new Date(),
          jobs_processed: this.stats.jobsProcessed,
          jobs_failed: this.stats.jobsFailed
        }
      }).catch((error: unknown) => {
        logger.error(`Heartbeat failed for worker ${this.workerId}:`, error);
      });
    }, this.config.heartbeatInterval);
  }

  /**
   * Start polling for jobs
   */
  private startPolling(): void {
    // Initial poll
    void this.processJobs();

    // Set up interval polling as fallback
    this.pollTimer = setInterval(() => {
      if (!this.isShuttingDown) {
        void this.processJobs();
      }
    }, this.config.pollInterval);
  }

  /**
   * Set up LISTEN/NOTIFY for real-time job notifications
   */
  private async setupNotificationListener(): Promise<void> {
    try {
      this.notificationClient = new Client({
        connectionString: this.config.connectionString
      });

      await this.notificationClient.connect();

      // Listen to all configured queues in parallel
      await Promise.all(
        this.config.queueNames.map(queueName =>
          this.notificationClient?.query(`LISTEN "job:${queueName}"`)
        )
      );

      this.notificationClient.on('notification', (msg) => {
        if (msg.channel.startsWith('job:')) {
          const queueName = msg.channel.substring(4);
          if (this.config.queueNames.includes(queueName)) {
            // Immediately process jobs when notified
            setImmediate(() => { void this.processJobs(); });
          }
        }
      });

      logger.info(`Notification listener set up for queues: ${this.config.queueNames.join(', ')}`);
    } catch (error) {
      logger.error(`Failed to set up notification listener:`, error);
      // Continue without notifications - polling will still work
    }
  }

  /**
   * Get worker statistics
   */
  getStats(): {
    workerId: string;
    jobsProcessed: number;
    jobsFailed: number;
    activeJobs: number;
    uptime: number;
    throughput: number;
  } {
    const uptime = Date.now() - this.stats.startTime.getTime();
    return {
      workerId: this.workerId,
      jobsProcessed: this.stats.jobsProcessed,
      jobsFailed: this.stats.jobsFailed,
      activeJobs: this.activeJobs.size,
      uptime,
      throughput: this.stats.jobsProcessed / (uptime / 1000)
    };
  }

  /**
   * Reset any jobs still flagged `active` with this worker's id back to
   * `pending`. These are leftovers from a previous incarnation of the
   * worker (dev-server restart, crash). Safe because:
   *   - The new process hasn't started polling yet, so it owns no jobs.
   *   - The queueManager always uses a fixed workerId ('default-worker'),
   *     so jobs claimed by the dead process have the same id as us.
   * Does NOT increment attempt_count — a process restart isn't a real
   * retry, and burning an attempt would prematurely exhaust retry budgets
   * on jobs that never got a fair chance to run.
   */
  private async recoverOrphanedJobs(): Promise<void> {
    try {
      const result = await prisma.$executeRaw`
        UPDATE jobs
        SET status = 'pending'::"JobStatus",
            worker_id = NULL,
            lease_expires_at = NULL,
            started_at = NULL
        WHERE status = 'active'::"JobStatus"
          AND worker_id = ${this.workerId}
      `;
      if (result > 0) {
        logger.info(`Worker ${this.workerId}: recovered ${result} orphaned active job(s) from previous incarnation`);
      }
    } catch (error) {
      logger.error(`Worker ${this.workerId}: failed to recover orphaned jobs at startup:`, error);
    }
  }

  /**
   * Static method to recover stale jobs
   */
  static async recoverStaleJobs(staleThresholdSeconds = 600): Promise<number> {
    const result = await prisma.$queryRaw<{ recover_stale_jobs: number }[]>`
      SELECT recover_stale_jobs(${staleThresholdSeconds}::INTEGER) as recover_stale_jobs
    `;

    const recoveredCount = result[0]?.recover_stale_jobs ?? 0;

    if (recoveredCount > 0) {
      logger.info(`Recovered ${recoveredCount} stale jobs`);
    }

    return recoveredCount;
  }

  /**
   * Static method to get queue metrics
   */
  static async getQueueMetrics(queueName?: string, timeWindow = '1 hour'): Promise<unknown> {
    const result = await prisma.$queryRaw`
      SELECT * FROM get_queue_metrics(
        ${queueName}::TEXT,
        ${timeWindow}::INTERVAL
      )
    `;

    return result;
  }
}