/**
 * High-Performance Queue Manager
 *
 * Central management system for the PostBull-style PostgreSQL queue.
 * Handles job enqueueing, worker management, and monitoring.
 *
 * @module server/queue/QueueManager
 */

import { EventEmitter } from 'events';

import { JobType, jobs, JobStatus } from '@prisma/client';

import { logger } from '@/utils/logger';



import { prisma } from '../db';

import { registerAllHandlers } from './handlers/index';
import { JobEnqueuer } from './modules/job-enqueuer';
import { MaintenanceManager } from './modules/maintenance';
import { QueueStatsManager } from './modules/queue-stats';
import {
  EnqueueOptions,
  JobHandler,
  QueueStats,
  VolatileJobHandler
} from './modules/types';
import { WorkerManager } from './modules/worker-manager';
import { PostgreSQLQueueWorker } from './PostgreSQLQueueWorker';
import { VolatileJobWorker } from './VolatileJobWorker';

export type { QueueStats } from './modules/types';

/**
 * Singleton Queue Manager for high-performance job processing
 */
export class QueueManager extends EventEmitter {
  private static instance: QueueManager | undefined;
  private isInitialized = false;
  /** Shared in-flight init promise so concurrent ensureInitialized() callers
   *  don't all race past the isInitialized check and each spin up their own
   *  `default-worker` instance (see fix for "lost ownership" warnings). */
  private initPromise: Promise<void> | null = null;

  // Module instances
  private jobEnqueuer: JobEnqueuer;
  private workerManager: WorkerManager;
  private queueStatsManager: QueueStatsManager;
  private maintenanceManager: MaintenanceManager;

  private constructor() {
    super();

    // Initialize modules
    this.jobEnqueuer = new JobEnqueuer(this);
    this.workerManager = new WorkerManager(this);
    this.queueStatsManager = new QueueStatsManager(this);
    this.maintenanceManager = new MaintenanceManager(this);
  }

  /**
   * Get singleton instance
   */
  static getInstance(): QueueManager {
    QueueManager.instance ??= new QueueManager();
    return QueueManager.instance;
  }

  /**
   * Initialize the queue system
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Recover any stale jobs
      const recovered = await PostgreSQLQueueWorker.recoverStaleJobs();
      if (recovered > 0) {
        logger.info(`Queue system recovered ${recovered} stale jobs`);
      }

      // Load queue configurations
      const configs = await prisma.queue_config.findMany({
        where: { is_active: true }
      });

      // Register all job handlers
      registerAllHandlers(this);
      logger.info(`Registered job handlers for ${this.workerManager.getHandlers().size} job types`);

      logger.info(`Queue system initialized with ${configs.length} active queues`);
      this.isInitialized = true;

      // Start periodic maintenance
      this.maintenanceManager.startMaintenance();

      this.emit('initialized');
    } catch (error) {
      logger.error('Failed to initialize queue system:', error);
      throw error;
    }
  }

  /**
   * Enqueue a new job (routes to volatile or durable queue based on job type)
   * Auto-initializes the queue system if not already initialized.
   */
  async enqueue(
    jobType: JobType | string,
    payload: unknown,
    options: EnqueueOptions = {}
  ): Promise<bigint> {
    // Auto-initialize if not already done
    await this.ensureInitialized();
    return this.jobEnqueuer.enqueue(jobType, payload, options);
  }

  /**
   * Ensure queue system is initialized with workers
   * Creates a default worker if none exist
   */
  private async ensureInitialized(): Promise<void> {
    if (this.isInitialized) return;
    if (this.initPromise) return this.initPromise;
    this.initPromise = this.runInitialization();
    try {
      await this.initPromise;
    } finally {
      this.initPromise = null;
    }
  }

  private async runInitialization(): Promise<void> {
    // Ensure the default queue_config row exists. The original seed
    // migration was deleted in the public-release history squash, so on
    // fresh installs the row is missing and every enqueue throws
    // "Queue 'default' is not active or does not exist". Upsert here
    // so the queue self-heals on every boot regardless of migration
    // state. ON CONFLICT keeps any user customizations (priority,
    // max_concurrent_jobs, etc.) intact.
    await prisma.queue_config.upsert({
      where: { queue_name: 'default' },
      update: {},
      create: {
        queue_name: 'default',
        is_active: true,
        max_concurrent_jobs: 10,
        default_priority: 50,
        default_max_attempts: 3,
        default_retry_delay_seconds: 60,
      },
    });

    await this.initialize();
    const workers = this.workerManager.getWorkers();
    if (workers.size === 0) {
      logger.info('Creating default queue worker...');
      await this.createWorker('default-worker', {
        queueNames: ['default'],
        batchSize: 10,
        maxConcurrency: 3,
      });
      logger.info('Default queue worker created');
    }
  }

  /**
   * Enqueue multiple jobs in a batch
   */
  async enqueueBatch(
    jobs: Array<{
      jobType: JobType;
      payload: unknown;
      options?: EnqueueOptions;
    }>
  ): Promise<bigint[]> {
    return this.jobEnqueuer.enqueueBatch(jobs);
  }

  /**
   * Register a job handler
   */
  registerHandler(jobType: JobType, handler: JobHandler): void {
    this.workerManager.registerHandler(jobType, handler);
  }

  /**
   * Create and start a new worker
   */
  async createWorker(
    workerId?: string,
    config?: {
      queueNames?: string[];
      batchSize?: number;
      maxConcurrency?: number;
    }
  ): Promise<PostgreSQLQueueWorker> {
    return this.workerManager.createWorker(workerId, config);
  }

  /**
   * Create and start a new volatile worker
   */
  async createVolatileWorker(
    workerId?: string,
    config?: {
      queueName?: string;
      batchSize?: number;
      maxConcurrency?: number;
    }
  ): Promise<VolatileJobWorker> {
    return this.workerManager.createVolatileWorker(workerId, config);
  }

  /**
   * Register a volatile job handler
   */
  registerVolatileHandler(jobType: string, handler: VolatileJobHandler): void {
    this.workerManager.registerVolatileHandler(jobType, handler);
  }

  /**
   * Stop a worker
   */
  async stopWorker(workerId: string): Promise<void> {
    return this.workerManager.stopWorker(workerId);
  }

  /**
   * Stop all workers
   */
  async stopAllWorkers(): Promise<void> {
    return this.workerManager.stopAllWorkers();
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<QueueStats> {
    return this.queueStatsManager.getStats();
  }

  /**
   * Get detailed metrics for a specific queue
   */
  async getQueueMetrics(queueName?: string, timeWindow = '1 hour'): Promise<unknown> {
    return this.queueStatsManager.getQueueMetrics(queueName, timeWindow);
  }

  /**
   * Cancel a job
   */
  async cancelJob(jobId: bigint): Promise<boolean> {
    return this.maintenanceManager.cancelJob(jobId);
  }

  /**
   * Retry a failed job
   */
  async retryJob(jobId: bigint): Promise<boolean> {
    return this.maintenanceManager.retryJob(jobId);
  }

  /**
   * Clean up old completed jobs
   */
  async cleanup(daysToKeep = 7): Promise<number> {
    return this.maintenanceManager.cleanup(daysToKeep);
  }

  /**
   * Get active workers
   */
  async getActiveWorkers(): Promise<unknown[]> {
    return this.queueStatsManager.getActiveWorkers();
  }

  /**
   * Get job by ID
   */
  async getJob(jobId: bigint): Promise<jobs | null> {
    return prisma.jobs.findUnique({
      where: {
        id_partition_key: {
          id: jobId,
          partition_key: 'active'
        }
      }
    });
  }

  /**
   * Get jobs by status
   */
  async getJobsByStatus(
    status: JobStatus,
    queueName?: string,
    limit = 100
  ): Promise<jobs[]> {
    return prisma.jobs.findMany({
      where: {
        status,
        ...(queueName && { queue_name: queueName })
      },
      orderBy: {
        created_at: 'desc'
      },
      take: limit
    });
  }

  /**
   * Get queue statistics (alias for getStats for compatibility)
   */
  async getQueueStats(): Promise<QueueStats> {
    return this.queueStatsManager.getQueueStats();
  }

  /**
   * Clean up old jobs from the database
   */
  async cleanupOldTasks(days: number = 30): Promise<void> {
    return this.maintenanceManager.cleanupOldTasks(days);
  }

  /**
   * Reschedule failed jobs for retry
   */
  async rescheduleFailed(): Promise<number> {
    return this.maintenanceManager.rescheduleFailed();
  }

  /**
   * Process pending tasks (compatibility method)
   */
  processTasks(): Promise<void> {
    return this.maintenanceManager.processTasks();
  }

  /**
   * Shutdown the queue system
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down queue system...');

    // Stop maintenance intervals before workers
    this.maintenanceManager.stopMaintenance();

    // Stop all workers
    await this.workerManager.stopAllWorkers();

    // Clear handlers
    this.workerManager.getHandlers().clear();

    this.isInitialized = false;
    this.initPromise = null;
    this.emit('shutdown');

    logger.info('Queue system shut down successfully');
  }
}

// Export singleton instance
export const queueManager = QueueManager.getInstance();