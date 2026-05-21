/**
 * Queue Monitoring Server Module
 * 
 * This module implements an Express server that provides monitoring and management
 * endpoints for the task queue system. It includes security measures like rate limiting
 * and helmet protection, and exposes endpoints for queue statistics, health checks,
 * and administrative operations.
 * 
 * @module queueMonitor
 */

import express from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';

import { logger } from '../utils/logger';

import { queueManager } from './queue/queueManager';
import { checkWorkerHealth } from './queue/worker';

import type { Request, Response } from 'express';

/**
 * Valid queue status types
 * Represents the possible states a task can be in
 */
type QueueStatuses = 'active' | 'pending' | 'failed' | 'completed';

/**
 * Queue status response structure
 * 
 * @property {QueueStatuses} status - Current status of the queue
 * @property {number} count - Number of tasks in this status
 * @property {string} [lastRun] - ISO timestamp of the last task execution
 */
interface QueueResponse {
  status: QueueStatuses;
  count: number;
  lastRun?: string;
}

/**
 * Error response structure
 * 
 * @property {string} error - Error message
 * @property {string} [details] - Additional error details if available
 * @property {string} timestamp - ISO timestamp when the error occurred
 */
interface ErrorResponse {
  error: string;
  details?: string | undefined;
  timestamp: string;
}

/**
 * Health check response structure
 * 
 * @property {'healthy' | 'unhealthy'} status - Overall health status
 * @property {string} timestamp - ISO timestamp of the health check
 * @property {Object} queues - Current queue statistics
 * @property {number} queues.active - Number of active tasks
 * @property {number} queues.pending - Number of pending tasks
 * @property {number} queues.failed - Number of failed tasks
 * @property {string} [lastProcessed] - ISO timestamp of last processed task
 */
interface HealthResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  queues: {
    active: number;
    pending: number;
    failed: number;
  };
  lastProcessed?: string;
}

const app = express();

// Security middleware configuration
app.use(helmet());
app.use(express.json());

/**
 * Rate limiting configuration
 * Limits each IP to 100 requests per 15 minutes
 */
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

/**
 * Creates a standardized error response
 * 
 * @param {unknown} error - The error to format
 * @returns {ErrorResponse} Formatted error response
 */
function createErrorResponse(error: unknown): ErrorResponse {
  return {
    error: 'Operation failed',
    details: error instanceof Error ? error.message : String(error),
    timestamp: new Date().toISOString()
  };
}

/**
 * Health check endpoint
 * Returns the current health status of the queue system
 * 
 * @route GET /health
 * @returns {HealthResponse} Health status and queue statistics
 * @throws {500} If health check fails
 */
app.get('/health', async (_req: Request, res: Response) => {
  try {
    const health = await checkWorkerHealth();
    const stats = await queueManager.getQueueStats();

    // Sum up all queue stats
    let totalActive = 0;
    let totalPending = 0;
    let totalFailed = 0;

    for (const queueStats of Object.values(stats)) {
      totalActive += queueStats.active;
      totalPending += queueStats.pending;
      totalFailed += queueStats.failed;
    }

    const response: HealthResponse = {
      status: health.isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      queues: {
        active: totalActive,
        pending: totalPending,
        failed: totalFailed
      }
    };

    res.json(response);
  } catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
res["status"](500).json(createErrorResponse(errorMessage));
  }
});

/**
 * Queue statistics endpoint
 * Returns detailed statistics for all queue statuses
 * 
 * @route GET /admin/queues/stats
 * @returns {QueueResponse[]} Array of queue statistics by status
 * @throws {500} If statistics retrieval fails
 */
app.get('/admin/queues/stats', async (_req: Request, res: Response) => {
  try {
    const stats = await queueManager.getQueueStats();

    // Sum up all queue stats
    let totalActive = 0;
    let totalPending = 0;
    let totalFailed = 0;
    let totalCompleted = 0;

    for (const queueStats of Object.values(stats)) {
      totalActive += queueStats.active;
      totalPending += queueStats.pending;
      totalFailed += queueStats.failed;
      totalCompleted += queueStats.completed;
    }

    const response: QueueResponse[] = [
      {
        status: 'pending',
        count: totalPending,
        lastRun: new Date().toISOString()
      },
      {
        status: 'active',
        count: totalActive,
        lastRun: new Date().toISOString()
      },
      {
        status: 'failed',
        count: totalFailed,
        lastRun: new Date().toISOString()
      },
      {
        status: 'completed',
        count: totalCompleted,
        lastRun: new Date().toISOString()
      }
    ];

    res.json(response);
  } catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
res["status"](500).json(createErrorResponse(errorMessage));
  }
});

/**
 * Retry failed tasks endpoint
 * Reschedules all failed tasks for another attempt
 * 
 * @route POST /admin/queues/retry
 * @returns {Object} Success status and count of rescheduled tasks
 * @throws {500} If rescheduling fails
 */
app.post('/admin/queues/retry', async (_req: Request, res: Response) => {
  try {
    const count = await queueManager.rescheduleFailed();
    res.json({
      success: true,
      count,
      message: `Rescheduled ${count} failed tasks`
    });
  } catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
res["status"](500).json(createErrorResponse(errorMessage));
  }
});

/**
 * Cleanup old tasks endpoint
 * Removes tasks older than the specified number of days
 * 
 * @route DELETE /admin/queues/cleanup/:days
 * @param {string} days - Number of days to keep (defaults to 7)
 * @returns {Object} Success status and cleanup message
 * @throws {500} If cleanup fails
 */
app.delete('/admin/queues/cleanup/:days', async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.params['days'] ?? '7', 10);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    await queueManager.cleanupOldTasks(days);
    
    res.json({
      success: true,
      message: `Cleaned up tasks older than ${days} days`
    });
  } catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
res["status"](500).json(createErrorResponse(errorMessage));
  }
});

// Server configuration
const PORT = process.env['MONITOR_PORT'] ?? 3001;

/**
 * Starts the queue monitor server
 * 
 * @throws {Error} If server fails to start
 */
function startServer(): void {
  try {
    app.listen(PORT, () => {
      logger.info(`Queue monitor server running on port ${PORT}`);
    });
  } catch (error: unknown) {
    logger.error('Failed to start queue monitor server:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Graceful shutdown handlers
process.on('SIGTERM', () => {
  logger.info('Received SIGTERM. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('Received SIGINT. Shutting down gracefully...');
  process.exit(0);
});

// Start server if this is the main module
if (import.meta.url === process.argv[1]) {
  try {
    startServer();
  } catch (error) {
    logger.error('Fatal error starting monitor server:', error);
    process.exit(1);
  }
}

export { startServer, app };
