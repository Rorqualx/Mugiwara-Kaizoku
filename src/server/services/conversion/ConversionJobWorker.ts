/**
 * Conversion Job Worker
 *
 * Background worker for processing file format conversion jobs.
 * Polls the ConversionJob table, claims jobs (SKIP LOCKED in
 * `ConversionJobWorker/worker-claim.ts`), and executes conversions via
 * FormatConversionService. Retry/failure/recovery logic lives in
 * `ConversionJobWorker/worker-retry.ts`.
 *
 * @module server/services/conversion/ConversionJobWorker
 */

import { EventEmitter } from 'events';
import { hostname } from 'os';

import type { AsyncResult } from '@/utils/async-result';
import { isSuccess } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import { claimJobs as claimJobsImpl, type ClaimedJob } from './ConversionJobWorker/worker-claim';
import {
  getQueueMetrics as getQueueMetricsImpl,
  persistJobFailure,
  recoverStaleJobs as recoverStaleJobsImpl,
  type QueueMetrics
} from './ConversionJobWorker/worker-retry';

import { getConversionService } from './index';

export interface ConversionWorkerConfig {
  workerId?: string;
  batchSize?: number;
  pollInterval?: number;
  maxConcurrency?: number;
  heartbeatInterval?: number;
}

export interface ConversionJobStats {
  jobsProcessed: number;
  jobsFailed: number;
  startTime: Date;
  uptime: number;
  throughput: number;
}

export class ConversionJobWorker extends EventEmitter {
  private readonly config: Required<ConversionWorkerConfig>;
  private readonly workerId: string;
  private isRunning = false;
  private isShuttingDown = false;
  private activeJobs = new Set<string>();
  private processingPromises: Promise<void>[] = [];
  private pollTimer: NodeJS.Timeout | null = null;
  private stats = {
    jobsProcessed: 0,
    jobsFailed: 0,
    startTime: new Date()
  };

  constructor(config: ConversionWorkerConfig = {}) {
    super();

    this.workerId = config.workerId
      ?? `conversion-worker-${hostname()}-${process.pid}-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    this.config = {
      workerId: this.workerId,
      batchSize: config.batchSize ?? 5,
      pollInterval: config.pollInterval ?? 2000,
      maxConcurrency: config.maxConcurrency ?? 3,
      heartbeatInterval: config.heartbeatInterval ?? 30000
    };

    logger.info(`[ConversionWorker] Worker ${this.workerId} initialized`, { config: this.config });
  }

  start(): Promise<void> {
    if (this.isRunning) {
      return Promise.reject(new Error('Conversion worker is already running'));
    }

    this.isRunning = true;
    this.isShuttingDown = false;

    logger.info(`[ConversionWorker] Starting worker ${this.workerId}`);

    this.startPolling();
    this.emit('started', { workerId: this.workerId });

    logger.info(`[ConversionWorker] Worker ${this.workerId} started successfully`, {
      batchSize: this.config.batchSize,
      maxConcurrency: this.config.maxConcurrency
    });

    return Promise.resolve();
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;

    logger.info(`[ConversionWorker] Stopping worker ${this.workerId}...`);
    this.isShuttingDown = true;

    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    if (this.activeJobs.size > 0) {
      logger.info(`[ConversionWorker] Waiting for ${this.activeJobs.size} active jobs to complete...`);
      await Promise.all(this.processingPromises);
    }

    this.isRunning = false;
    this.emit('stopped', { workerId: this.workerId, stats: this.getStats() });

    logger.info(`[ConversionWorker] Worker ${this.workerId} stopped successfully`);
  }

  private async processJobs(): Promise<void> {
    if (this.isShuttingDown || this.processingPromises.length >= this.config.maxConcurrency) {
      return;
    }

    try {
      const jobs = await this.claimJobs();
      if (jobs.length === 0) return;

      for (const job of jobs) {
        if (this.processingPromises.length >= this.config.maxConcurrency) break;
        this.spawnJobPromise(job);
      }

      if (jobs.length === this.config.batchSize) {
        globalThis.queueMicrotask(() => { void this.processJobs(); });
      }
    } catch (error: unknown) {
      logger.error('[ConversionWorker] Error in job processing loop:', error);
      this.emit('error', error);
    }
  }

  private async claimJobs(): Promise<ClaimedJob[]> {
    const jobs = await claimJobsImpl(this.config.batchSize, this.workerId);
    jobs.forEach(job => this.activeJobs.add(job.id));
    return jobs;
  }

  private spawnJobPromise(job: ClaimedJob): void {
    const promise = this.processJob(job).finally(() => {
      const index = this.processingPromises.indexOf(promise);
      if (index > -1) {
        void this.processingPromises.splice(index, 1);
      }
    });
    this.processingPromises.push(promise);
  }

  private async processJob(job: ClaimedJob): Promise<void> {
    const startTime = Date.now();

    logger.info(`[ConversionWorker] Processing conversion job ${job.id}`, {
      workerId: this.workerId,
      sourceFormat: job.sourceFormat,
      targetFormat: job.targetFormat,
      attempt: job.attempts + 1
    });

    try {
      const conversionService = getConversionService();
      const result: AsyncResult<unknown, Error> = await conversionService.executeConversionJob(job.id);

      if (!isSuccess(result)) {
        if (result.status !== 'error') throw new Error('Unexpected result status');
        throw result.error;
      }

      this.stats.jobsProcessed++;
      const processingTimeMs = Date.now() - startTime;
      logger.info(`[ConversionWorker] Job ${job.id} completed successfully`, { processingTimeMs });
      this.emit('job:completed', { job, processingTimeMs });
    } catch (error: unknown) {
      await this.recordJobFailure(job, error);
    } finally {
      this.activeJobs.delete(job.id);
    }
  }

  private async recordJobFailure(job: ClaimedJob, error: unknown): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`[ConversionWorker] Job ${job.id} failed:`, error);

    const { shouldRetry, newAttempts } = await persistJobFailure(
      job.id,
      job.attempts,
      job.maxAttempts,
      errorMessage
    );

    this.stats.jobsFailed++;
    this.emit('job:failed', { job, error: errorMessage, willRetry: shouldRetry });

    if (shouldRetry) {
      logger.info(`[ConversionWorker] Job ${job.id} will be retried (attempt ${newAttempts}/${job.maxAttempts})`);
    } else {
      logger.error(`[ConversionWorker] Job ${job.id} permanently failed after ${newAttempts} attempts`);
    }
  }

  private startPolling(): void {
    void this.processJobs();
    this.pollTimer = setInterval(() => {
      if (!this.isShuttingDown) {
        void this.processJobs();
      }
    }, this.config.pollInterval);
  }

  getStats(): ConversionJobStats {
    const uptime = Date.now() - this.stats.startTime.getTime();
    return {
      jobsProcessed: this.stats.jobsProcessed,
      jobsFailed: this.stats.jobsFailed,
      startTime: this.stats.startTime,
      uptime,
      throughput: this.stats.jobsProcessed / (uptime / 1000)
    };
  }

  static recoverStaleJobs(staleThresholdMinutes = 30): Promise<number> {
    return recoverStaleJobsImpl(staleThresholdMinutes);
  }

  static getQueueMetrics(): Promise<QueueMetrics> {
    return getQueueMetricsImpl();
  }
}
