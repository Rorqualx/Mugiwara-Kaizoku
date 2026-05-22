/**
 * System Lifecycle Router
 *
 * Handles application restart and shutdown operations with graceful handling.
 *
 * Procedures:
 * - restart: Initiate graceful application restart
 * - shutdown: Initiate graceful application shutdown
 *
 * Extracted from: system.ts (lines 1093-1374)
 */

import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { env } from '@/env/server';
import { prisma } from '@/server/db';
import { eventEmitter } from '@/server/services/eventEmitter';
import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { adminProcedure } from '@/server/trpc/procedures';
import { router } from '@/server/trpc/trpc';
import {
  createSuccessResult,
  createErrorResult,
  createContextualError
} from '@/utils/async-result';
import type { AsyncResult } from '@/utils/async-result';
import { logger } from '@/utils/logging';

/** Input schema for restart and shutdown operations */
const lifecycleInputSchema = z.object({
  force: z.boolean().default(false),
  reason: z.string().optional()
});

/** Response type for restart operation */
interface RestartResponse {
  message: string;
  warnings: string[];
  restartTime: string;
  requiresManualRestart: boolean;
  isDocker: boolean;
}

/** Response type for shutdown operation */
interface ShutdownResponse {
  message: string;
  warnings: string[];
  shutdownTime: string;
  isDocker: boolean;
  isDevelopment: boolean;
}

/** Environment info for lifecycle operations */
interface EnvironmentInfo {
  isDocker: boolean;
  isDevelopment: boolean;
}

/** Gets count of active jobs in the database */
async function getActiveJobCount(): Promise<number> {
  const result = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*) as count FROM jobs WHERE status IN ('pending', 'active')
  `;
  return Number(result[0].count);
}

/** Gets environment type information */
function getEnvironmentInfo(): EnvironmentInfo {
  return {
    isDocker: env.DOCKER === 'true',
    isDevelopment: env.NODE_ENV === 'development'
  };
}

/** Checks active jobs and returns error result if blocked */
async function checkActiveJobsBlocked(
  force: boolean,
  operation: string
): Promise<{ blocked: boolean; activeJobs: number; warnings: string[] }> {
  const activeJobs = await getActiveJobCount();
  const warnings: string[] = [];

  logger.info(`${operation}:active-jobs-check`, {
    activeJobs,
    willProceed: force || activeJobs === 0
  });

  if (activeJobs > 0 && !force) {
    warnings.push(`${activeJobs} active tasks are running`);
    logger.warn(`${operation}:blocked-by-active-jobs`, {
      activeJobs,
      message: `Use force=true to ${operation} anyway`
    });
    return { blocked: true, activeJobs, warnings };
  }

  if (activeJobs > 0) {
    warnings.push(`Forcing ${operation} with ${activeJobs} active tasks`);
    logger.warn(`${operation}:forcing-with-active-jobs`, { activeJobs });
  }

  return { blocked: false, activeJobs, warnings };
}

/** Handles restart based on environment type */
async function executeRestart(
  envInfo: EnvironmentInfo,
  _force: boolean
): Promise<{ message: string; requiresManualRestart: boolean }> {
  const { RESTART_DELAYS } = await import('@/server/constants/system');

  logger.info('restart:environment-detected', envInfo);

  // SIGTERM routes through the canonical handler in server-shutdown.ts which
  // closes HTTP/WebSocket/schedulers/queues/Suwayomi/FlareSolverr in order
  // before `process.exit(0)`. The parallel `graceful-shutdown.ts` path skipped
  // those — under Bun the still-listening HTTP server kept the process alive,
  // so the container never recycled.
  if (envInfo.isDocker) {
    logger.info('restart:docker-mode', { message: 'Scheduling SIGTERM for container restart' });
    setTimeout(() => process.kill(process.pid, 'SIGTERM'), RESTART_DELAYS.RESPONSE_BUFFER_MS);
    return {
      message: 'Container restart initiated. Docker will handle the restart based on container policy.',
      requiresManualRestart: false
    };
  }

  if (envInfo.isDevelopment) {
    logger.warn('restart:development-mode', { message: 'Manual restart required' });
    return {
      message: 'Development mode: Please restart manually with "npm run dev"',
      requiresManualRestart: true
    };
  }

  logger.info('restart:production-mode', { message: 'Using process manager for restart' });
  if (typeof process.send === 'function') {
    process.send('shutdown');
    logger.info('restart:pm2-signal-sent');
  }
  setTimeout(() => process.kill(process.pid, 'SIGTERM'), RESTART_DELAYS.RESPONSE_BUFFER_MS);
  return { message: 'Application restart initiated', requiresManualRestart: false };
}

/** Handles shutdown based on environment type */
async function executeShutdown(
  envInfo: EnvironmentInfo,
  _force: boolean
): Promise<string> {
  const { RESTART_DELAYS } = await import('@/server/constants/system');

  logger.info('shutdown:environment-detected', envInfo);

  let message: string;
  if (envInfo.isDocker) {
    message = 'Container shutdown initiated. Container will stop and may restart based on Docker policy.';
    logger.info('shutdown:docker-mode', { message: 'Container will be stopped' });
  } else if (envInfo.isDevelopment) {
    message = 'Application shutdown initiated. You will need to manually restart with "npm run dev".';
    logger.info('shutdown:development-mode', { message: 'Manual restart will be required' });
  } else {
    message = 'Application shutdown initiated';
    logger.info('shutdown:production-mode', { message: 'Process manager may restart based on configuration' });
  }

  // Same SIGTERM routing as restart — the canonical handler in server-shutdown.ts
  // is the only code path that closes the HTTP server + child processes cleanly.
  setTimeout(() => process.kill(process.pid, 'SIGTERM'), RESTART_DELAYS.RESPONSE_BUFFER_MS);
  return message;
}

/** System Lifecycle Router - Restart and shutdown operations */
export const systemLifecycleRouter = router({
  /** Restarts the application with graceful handling */
  restart: adminProcedure
    .input(lifecycleInputSchema)
    .mutation(async ({ input }): Promise<AsyncResult<RestartResponse, Error>> => {
      try {
        logger.info('restart:initiated', {
          force: input.force,
          reason: input.reason ?? 'user-requested',
          timestamp: new Date().toISOString()
        });

        const { blocked, activeJobs, warnings } = await checkActiveJobsBlocked(input.force, 'restart');
        if (blocked) {
          return createErrorResult(
            createContextualError('Active operations are in progress', 'ACTIVE_OPERATIONS', { activeJobs, warnings })
          );
        }

        const envInfo = getEnvironmentInfo();
        const { message, requiresManualRestart } = await executeRestart(envInfo, input.force);

        // Emit WebSocket event for real-time sync
        void realtimeEmitter.emitSystemEvent({
          eventType: 'system:restarting',
          source: 'system-lifecycle',
          message: message,
          data: {
            reason: input.reason ?? 'user-requested',
            force: input.force,
            requiresManualRestart,
            isDocker: envInfo.isDocker,
          },
        });

        logger.info('restart:response-sent', { message, warnings, requiresManualRestart });

        return createSuccessResult({
          message,
          warnings,
          restartTime: new Date().toISOString(),
          requiresManualRestart,
          isDocker: envInfo.isDocker
        });
      } catch (error: unknown) {
        logger.error('restart:failed', error instanceof Error ? error.message : String(error));
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to initiate restart' });
      }
    }),

  /** Shuts down the application gracefully */
  shutdown: adminProcedure
    .input(lifecycleInputSchema)
    .mutation(async ({ input }): Promise<AsyncResult<ShutdownResponse, Error>> => {
      try {
        logger.info('shutdown:initiated', {
          force: input.force,
          reason: input.reason ?? 'user-requested',
          timestamp: new Date().toISOString()
        });

        const { blocked, activeJobs, warnings } = await checkActiveJobsBlocked(input.force, 'shutdown');
        if (blocked) {
          return createErrorResult(
            createContextualError('Active operations are in progress', 'ACTIVE_OPERATIONS', { activeJobs, warnings })
          );
        }

        await eventEmitter.emit('system:shutdown', { timestamp: new Date() });

        const envInfo = getEnvironmentInfo();
        const message = await executeShutdown(envInfo, input.force);

        // Emit WebSocket event for real-time sync
        void realtimeEmitter.emitSystemEvent({
          eventType: 'system:shuttingDown',
          source: 'system-lifecycle',
          message: message,
          data: {
            reason: input.reason ?? 'user-requested',
            force: input.force,
            isDocker: envInfo.isDocker,
            isDevelopment: envInfo.isDevelopment,
          },
        });

        logger.info('shutdown:response-sent', { message, warnings });

        return createSuccessResult({
          message,
          warnings,
          shutdownTime: new Date().toISOString(),
          isDocker: envInfo.isDocker,
          isDevelopment: envInfo.isDevelopment
        });
      } catch (error: unknown) {
        logger.error('shutdown:failed', error instanceof Error ? error.message : String(error));
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to initiate shutdown' });
      }
    })
});
