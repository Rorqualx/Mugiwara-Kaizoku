/**
 * Worker management logic for the queue system
 *
 * @module server/queue/modules/worker-manager
 */

import { EventEmitter } from 'events';

import { JobType } from '@prisma/client';

import { logger } from '@/utils/logger';



import { PostgreSQLQueueWorker, JobHandler } from '../PostgreSQLQueueWorker';
import { VolatileJobWorker, VolatileJobHandler } from '../VolatileJobWorker';

import {
  WorkerWithId,
  VolatileWorkerWithId,
  WorkerConfig,
  VolatileWorkerConfig,
  WorkerEvent
} from './types';

export class WorkerManager {
  private workers: Map<string, PostgreSQLQueueWorker> = new Map();
  private volatileWorkers: Map<string, VolatileJobWorker> = new Map();
  private handlers: Map<JobType, JobHandler> = new Map();
  private volatileHandlers: Map<string, VolatileJobHandler> = new Map();
  private eventEmitter: EventEmitter;

  constructor(eventEmitter: EventEmitter) {
    this.eventEmitter = eventEmitter;
  }

  /**
   * Register a job handler
   */
  registerHandler(jobType: JobType, handler: JobHandler): void {
    this.handlers.set(jobType, handler);
    logger.info(`Registered handler for job type: ${jobType}`);

    // Update all workers with the new handler
    for (const worker of this.workers.values()) {
      worker.registerHandler(jobType, handler);
    }
  }

  /**
   * Create and start a new worker.
   *
   * Idempotent by `workerId` — concurrent callers (e.g. trpc context bootstrap
   * + queueManager.enqueue auto-init) would otherwise produce multiple
   * instances sharing the same id, each with its own pollTimer + heartbeat
   * setIntervals. The orphaned instances' heartbeats fire after the owning
   * one completes, tripping "lost ownership" warnings on unrelated jobs.
   */
  async createWorker(
    workerId?: string,
    config?: WorkerConfig
  ): Promise<PostgreSQLQueueWorker> {
    if (workerId !== undefined) {
      const existing = this.workers.get(workerId);
      if (existing) {
        logger.debug(`Worker ${workerId} already exists — reusing instance`);
        return existing;
      }
    }
    const worker = new PostgreSQLQueueWorker({
      ...(workerId !== undefined ? { workerId } : {}),
      ...(config ?? {})
    });

    // Register all existing handlers
    for (const [jobType, handler] of this.handlers) {
      worker.registerHandler(jobType, handler);
    }

    // Set up event forwarding
    const typedWorker = worker as unknown as WorkerWithId;
    worker.on('job:completed', (event: unknown) => this.eventEmitter.emit('job:completed', event));
    worker.on('job:failed', (event: unknown) => this.eventEmitter.emit('job:failed', event));
    worker.on('error', (error: unknown) => this.emitWorkerEvent('worker:error', { workerId: typedWorker.workerId, error }));

    await worker.start();

    this.workers.set(typedWorker.workerId, worker);

    // Resume progress loops for any active Prowlarr downloads that survived a restart
    void this.resumeDownloadProgressLoops();

    logger.info(`Created and started worker: ${typedWorker.workerId}`);
    this.emitWorkerEvent('worker:started', { workerId: typedWorker.workerId });

    return worker;
  }

  /**
   * Create and start a new volatile worker. Idempotent by workerId (see
   * createWorker for the same rationale).
   */
  async createVolatileWorker(
    workerId?: string,
    config?: VolatileWorkerConfig
  ): Promise<VolatileJobWorker> {
    if (workerId !== undefined) {
      const existing = this.volatileWorkers.get(workerId);
      if (existing) {
        logger.debug(`Volatile worker ${workerId} already exists — reusing instance`);
        return existing;
      }
    }
    const worker = new VolatileJobWorker({
      ...(workerId !== undefined ? { workerId } : {}),
      ...(config ?? {})
    });

    // Register all existing volatile handlers
    for (const [jobType, handler] of this.volatileHandlers) {
      worker.registerHandler(jobType, handler);
    }

    // Set up event forwarding
    const typedVolatileWorker = worker as unknown as VolatileWorkerWithId;
    worker.on('job:completed', (event: unknown) => this.eventEmitter.emit('job:completed:volatile', event));
    worker.on('job:failed', (event: unknown) => this.eventEmitter.emit('job:failed:volatile', event));
    worker.on('error', (error: unknown) => this.emitWorkerEvent('worker:error:volatile', { workerId: typedVolatileWorker.workerId, error }));

    await worker.start();

    this.volatileWorkers.set(typedVolatileWorker.workerId, worker);

    logger.info(`Created and started volatile worker: ${typedVolatileWorker.workerId}`);
    this.emitWorkerEvent('worker:started:volatile', { workerId: typedVolatileWorker.workerId });

    return worker;
  }

  /**
   * Register a volatile job handler
   */
  registerVolatileHandler(jobType: string, handler: VolatileJobHandler): void {
    this.volatileHandlers.set(jobType, handler);
    logger.info(`Registered volatile handler for job type: ${jobType}`);

    // Update all volatile workers with the new handler
    for (const worker of this.volatileWorkers.values()) {
      worker.registerHandler(jobType, handler);
    }
  }

  /**
   * Stop a worker and remove its event listeners
   */
  async stopWorker(workerId: string): Promise<void> {
    const worker = this.workers.get(workerId);
    if (!worker) {
      throw new Error(`Worker ${workerId} not found`);
    }

    worker.removeAllListeners();
    await worker.stop();
    this.workers.delete(workerId);

    logger.info(`Stopped worker: ${workerId}`);
    this.emitWorkerEvent('worker:stopped', { workerId });
  }

  /**
   * Stop all workers and clean up resources
   */
  async stopAllWorkers(): Promise<void> {
    // Remove listeners before stopping to prevent post-stop event handling
    for (const worker of this.workers.values()) {
      worker.removeAllListeners();
    }
    for (const worker of this.volatileWorkers.values()) {
      worker.removeAllListeners();
    }

    const promises = [
      ...Array.from(this.workers.values()).map(worker => worker.stop()),
      ...Array.from(this.volatileWorkers.values()).map(worker => worker.stop()),
    ];
    await Promise.all(promises);

    this.workers.clear();
    this.volatileWorkers.clear();
    this.handlers.clear();
    this.volatileHandlers.clear();
    logger.info('All workers stopped');
  }

  /**
   * Get all active workers
   */
  getWorkers(): Map<string, PostgreSQLQueueWorker> {
    return this.workers;
  }

  /**
   * Get all active volatile workers
   */
  getVolatileWorkers(): Map<string, VolatileJobWorker> {
    return this.volatileWorkers;
  }

  /**
   * Get all handlers
   */
  getHandlers(): Map<JobType, JobHandler> {
    return this.handlers;
  }

  /**
   * Get all volatile handlers
   */
  getVolatileHandlers(): Map<string, VolatileJobHandler> {
    return this.volatileHandlers;
  }

  /**
   * Resume download progress loops for active Prowlarr jobs after a server restart
   */
  private async resumeDownloadProgressLoops(): Promise<void> {
    try {
      const { DownloadManager } = await import('@/server/services/download/downloadManager');
      const dm = new DownloadManager();
      await dm.resumeActiveProgressLoops();
    } catch (err: unknown) {
      logger.warn('[WorkerManager] Failed to resume progress loops:', err);
    }
  }

  /**
   * Emit worker event
   */
  private emitWorkerEvent(event: string, data: WorkerEvent): void {
    this.eventEmitter.emit(event, data);
  }
}