import type {} from '@prisma/client';
/**
 * Health Check Router
 *
 * Provides health check endpoints for monitoring system status.
 * This router offers basic ping/pong functionality to verify that
 * the server is responding and system components are working.
 *
 * @module server/trpc/router/health
 */
import { prisma } from '@/server/db';

import { publicProcedure } from '../procedures';
import { router } from '../trpc';
export const healthRouter = router({
  /**
   * Basic health check query
   *
   * Responds with a simple status message to confirm API is working.
   * Can be used for load balancer health checks or monitoring.
   *
   * @returns Object with status message
   */
  check: publicProcedure.query(() => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      message: 'API is operational'
    };
  }),
  /**
   * Database connection test
   *
   * Performs a simple database query to verify that the connection is working.
   * This is useful for checking that the database is accessible.
   *
   * @returns Object with database connection status
   */
  dbCheck: publicProcedure.query(async () => {
    try {
      // Run a simple query to check database connection
      await prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        message: 'Database connection successful',
        timestamp: new Date().toISOString()
      };
    }
    catch (error: unknown) {
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown database error',
        timestamp: new Date().toISOString()
      };
    }
  })
});