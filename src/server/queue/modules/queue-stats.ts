/**
 * Queue statistics and monitoring logic
 *
 * @module server/queue/modules/queue-stats
 */

import { EventEmitter } from 'events';


import { JobStatus, jobs } from '@prisma/client';

import { prisma } from '@/server/db';
import { logger } from '@/utils/logger';


import { PostgreSQLQueueWorker } from '../PostgreSQLQueueWorker';

import { QueueStats } from './types';

export class QueueStatsManager {
  private eventEmitter: EventEmitter;

  constructor(eventEmitter: EventEmitter) {
    this.eventEmitter = eventEmitter;
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<QueueStats> {
    // Get queue statistics directly from jobs table
    const stats = await prisma.jobs.groupBy({
      by: ['queue_name', 'status'],
      _count: { _all: true }
    });

    const result: QueueStats = {};

    // Initialize queue stats
    for (const stat of stats) {
      result[stat.queue_name] ??= {
        pending: 0,
        active: 0,
        completed: 0,
        failed: 0,
        throughput: 0,
        avgWaitTime: 0,
        avgProcessingTime: 0,
        health: 'HEALTHY' as const
      };

      const queueStats = result[stat.queue_name];
      if (queueStats !== undefined) {
        switch (stat['status']) {
          case JobStatus.pending:
            queueStats.pending = stat._count._all;
            break;
          case JobStatus.active:
            queueStats.active = stat._count._all;
            break;
          case JobStatus.completed:
            queueStats.completed = stat._count._all;
            break;
          case JobStatus.failed:
            queueStats.failed = stat._count._all;
            break;
          default:
            // Handle any unexpected status values
            break;
        }
      }
    }

    // Get processing time stats using Prisma
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const processingStats = await prisma.jobs.groupBy({
      by: ['queue_name'],
      where: {
        completed_at: { gt: oneHourAgo },
        processing_time_ms: { not: null }
      },
      _avg: {
        processing_time_ms: true
      }
    });

    for (const stat of processingStats) {
      const queueStats = result[stat.queue_name];
      if (queueStats !== undefined && stat._avg.processing_time_ms !== null) {
        queueStats.avgProcessingTime = stat._avg.processing_time_ms / 1000;
      }
    }

    return result;
  }

  /**
   * Get detailed metrics for a specific queue
   */
  async getQueueMetrics(queueName?: string, timeWindow = '1 hour'): Promise<unknown> {
    return PostgreSQLQueueWorker.getQueueMetrics(queueName, timeWindow);
  }

  /**
   * Get active workers
   */
  async getActiveWorkers(): Promise<unknown[]> {
    return prisma.workers.findMany({
      where: {
        status: 'active',
        last_heartbeat_at: {
          gte: new Date(Date.now() - 60000) // Active in last minute
        }
      },
      orderBy: {
        started_at: 'desc'
      }
    });
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
    return this.getStats();
  }

  /**
   * Update statistics and emit event
   */
  async updateAndEmitStats(): Promise<void> {
    try {
      const stats = await this.getStats();
      this.eventEmitter.emit('stats:updated', stats);
    } catch (error) {
      logger.error('Failed to update statistics:', error);
    }
  }
}