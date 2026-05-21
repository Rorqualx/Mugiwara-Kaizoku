/**
 * @module server/queue/worker
 * @description Background task worker implementation
 * Provides a worker process that handles task queue processing with:
 * - Concurrent task execution
 * - Graceful shutdown handling
 * - Health monitoring
 * - Automatic task cleanup and rescheduling
 *
 * @example
 * ```ts
 * // Start the worker
 * const cleanup = await startWorker();
 *
 * // Check worker health
 * const health = await checkWorkerHealth();
 *
 * // Gracefully stop the worker
 * await gracefulShutdown();
 * ```
 */
import { setTimeout as setTimeoutPromise } from 'timers/promises';

import { logger } from '@/utils/logger';

import { queueManager } from './queueManager';
/** Maximum time to wait for tasks to complete during shutdown (ms) */
const SHUTDOWN_TIMEOUT = 30000;
/** Interval between task processing attempts (ms) */
const POLLING_INTERVAL = 5000;
/** Maximum number of tasks that can run simultaneously */
const MAX_CONCURRENT_TASKS = 3;
/** Flag indicating if worker is in shutdown process */
let isShuttingDown = false;
/** Number of tasks currently being processed */
let activeTaskCount = 0;
/**
 * Main task processing loop
 * Processes pending tasks while respecting concurrency limits
 *
 * @returns {Promise<void>}
 * @throws {Error} When task processing fails
 *
 * @example
 * ```ts
 * // Process available tasks
 * await processQueue();
 *
 * // Set up periodic processing
 * setInterval(processQueue, 5000);
 * ```
 */
async function processQueue(): Promise<void> {
    if (isShuttingDown || activeTaskCount >= MAX_CONCURRENT_TASKS) {
        return;
    }
    try {
        activeTaskCount++;
        await queueManager.processTasks(); // Removed the Date.now() argument
    }
    catch (error: unknown) {
        logger.error(`Queue processing error: ${error instanceof Error ? error.message : String(error)}`);
    }
    finally {
        activeTaskCount--;
    }
}
/**
 * Handles graceful worker shutdown
 * Waits for active tasks to complete before stopping
 *
 * @returns {Promise<void>}
 * @throws {Error} When shutdown process fails
 *
 * @example
 * ```ts
 * // Handle SIGTERM
 * process.on('SIGTERM', gracefulShutdown);
 *
 * // Manual shutdown
 * await gracefulShutdown();
 * ```
 */
async function gracefulShutdown(): Promise<void> {
    if (isShuttingDown)
        return;
    logger.info('Initiating graceful shutdown...');
    isShuttingDown = true;
    try {
        // Wait for active tasks to complete
        const shutdownStart = Date.now();
        // Sequential polling required for graceful shutdown - must check task count repeatedly
        while (activeTaskCount > 0 && Date.now() - shutdownStart < SHUTDOWN_TIMEOUT) {
            logger.info(`Waiting for ${activeTaskCount} active tasks to complete...`);
            // eslint-disable-next-line no-await-in-loop -- Graceful shutdown requires sequential polling with delays
            await setTimeoutPromise(1000);
        }
        if (activeTaskCount > 0) {
            logger.warn(`Forcing shutdown with ${activeTaskCount} tasks still active`);
        }
        // Cleanup
        // queueManager doesn't have stop method yet
        logger.info('Shutdown completed successfully');
        process.exit(0);
    }
    catch (error: unknown) {
        logger.error(`Error during shutdown: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
    }
}
/**
 * Initializes and starts the queue worker
 * Sets up shutdown handlers, periodic processing, and initial maintenance
 *
 * @returns {Promise<() => void>} Cleanup function to stop the worker
 * @throws {Error} When worker initialization fails
 *
 * @example
 * ```ts
 * // Start worker with cleanup
 * const cleanup = await startWorker();
 *
 * // Later, stop the worker
 * cleanup();
 * ```
 */
async function startWorker(): Promise<() => void> {
    try {
        logger.info('Starting queue worker...');
        // Setup shutdown handlers
        process.on('SIGTERM', () => { void gracefulShutdown(); });
        process.on('SIGINT', () => { void gracefulShutdown(); });
        // Start periodic task processing
        const processingInterval = setInterval(() => {
            if (!isShuttingDown) {
                processQueue().catch(error => {
                    logger.error(`Queue processing error: ${error instanceof Error ? error.message : String(error)}`);
                });
            }
        }, POLLING_INTERVAL);
        // Initial queue stats
        const stats = await queueManager.getQueueStats();
        logger.info(`Initial queue statistics: ${JSON.stringify(stats)}`);
        // Cleanup old tasks
        await queueManager.cleanupOldTasks();
        // Reschedule failed tasks that can be retried
        const rescheduledCount = await queueManager.rescheduleFailed();
        if (rescheduledCount > 0) {
            logger.info(`Rescheduled ${rescheduledCount} failed tasks`);
        }
        logger.info('Queue worker started successfully');
        // Return cleanup function
        return () => {
            clearInterval(processingInterval);
        };
    }
    catch (error: unknown) {
        logger.error(`Failed to start worker: ${error instanceof Error ? error.message : String(error)}`);
        throw error;
    }
}
/**
 * Checks worker health status
 * Returns worker state and queue statistics
 *
 * @returns {Promise<{
 *   isHealthy: boolean;
 *   activeTaskCount: number;
 *   queueStats: {
 *     pending: number;
 *     inProgress: number;
 *     completed: number;
 *     failed: number;
 *   }
 * }>} Worker health information
 * @throws {Error} When health check fails
 *
 * @example
 * ```ts
 * // Monitor worker health
 * const health = await checkWorkerHealth();
 * if (!health.isHealthy) {
 *   console.error('Worker is unhealthy');
 * }
 * ```
 */
interface QueueStatsResponse {
    pending?: number;
    active?: number;
    completed?: number;
    failed?: number;
}

export async function checkWorkerHealth(): Promise<{
    isHealthy: boolean;
    activeTaskCount: number;
    queueStats: {
        pending: number;
        inProgress: number;
        completed: number;
        failed: number;
    };
}> {
    try {
        const queueStats = await queueManager.getQueueStats();
        const stats = queueStats as QueueStatsResponse;
        return {
            isHealthy: !isShuttingDown,
            activeTaskCount,
            queueStats: {
                pending: stats.pending ?? 0,
                inProgress: stats.active ?? 0,
                completed: stats.completed ?? 0,
                failed: stats.failed ?? 0
            }
        };
    }
    catch (error: unknown) {
        logger.error(`Health check failed: ${error instanceof Error ? error.message : String(error)}`);
        throw error;
    }
}
// Start the worker if this is the main module
if (import.meta.url.endsWith('worker.ts')) {
    startWorker().catch(error => {
        logger.error(`Fatal worker error: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
    });
}
// Export for testing purposes
export { processQueue, gracefulShutdown, startWorker };
