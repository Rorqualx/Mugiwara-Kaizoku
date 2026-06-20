/**
 * Core types and interfaces for the queue system
 *
 * @module server/queue/modules/types
 */

import { JobType, JobPriority } from '@prisma/client';

// Worker interface with ID
export interface WorkerWithId {
  workerId: string;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  registerHandler: (jobType: JobType, handler: JobHandler) => void;
  on: (event: string, listener: (...args: unknown[]) => void) => void;
}

export interface VolatileWorkerWithId {
  workerId: string;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  registerHandler: (jobType: string, handler: VolatileJobHandler) => void;
  on: (event: string, listener: (...args: unknown[]) => void) => void;
}

export interface EnqueueOptions {
  queueName?: string;
  priority?: number | JobPriority;
  scheduledFor?: Date;
  maxAttempts?: number;
  retryDelaySeconds?: number;
  metadata?: Record<string, unknown>;
  mangaId?: number;
  chapterId?: number;
  /**
   * User who initiated this job. Stamped onto jobs.initiated_by_user_id so the
   * Jobs/Downloads pages can scope per-user (see _shared/library-access.ts
   * ownerScopeWhere). Leave undefined for system/background jobs with no
   * initiating user — such rows are visible only to admins.
   */
  initiatedByUserId?: string;
}

export interface QueueStats {
  [queueName: string]: {
    pending: number;
    active: number;
    completed: number;
    failed: number;
    throughput: number;
    avgWaitTime: number;
    avgProcessingTime: number;
    health: 'HEALTHY' | 'DEGRADED' | 'CRITICAL' | 'NO_WORKERS';
  };
}

export interface JobHandler {
  (job: { id: bigint; payload: unknown }): Promise<void>;
}

export interface VolatileJobHandler {
  (job: { id: bigint; payload: unknown }): Promise<void>;
}

export interface WorkerConfig {
  queueNames?: string[];
  batchSize?: number;
  maxConcurrency?: number;
}

export interface VolatileWorkerConfig {
  queueName?: string;
  batchSize?: number;
  maxConcurrency?: number;
}

export interface BatchJob {
  jobType: JobType;
  payload: unknown;
  options?: EnqueueOptions;
}

export interface JobEvent {
  jobId: bigint;
  jobType: string;
  queueName: string;
  priority: number;
}

export interface WorkerEvent {
  workerId: string;
  error?: unknown;
}

// Volatile job types (ephemeral, don't need durability)
export const VOLATILE_JOB_TYPES = new Set([
  'CACHE_INVALIDATION',
  'METRICS_COLLECTION',
  'NOTIFICATION_BROADCAST',
  'SESSION_CLEANUP',
  'TEMP_COMPUTATION',
  'REALTIME_UPDATE'
]);

// Priority mapping for job enqueueing
export const PRIORITY_MAP: Record<JobPriority, number> = {
  [JobPriority.critical]: 1000,
  [JobPriority.high]: 100,
  [JobPriority.normal]: 50,
  [JobPriority.low]: 10
};