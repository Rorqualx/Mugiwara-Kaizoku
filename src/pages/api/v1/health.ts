/**
 * Health Check Endpoint
 * 
 * Public endpoint to check API health status with enhanced monitoring integration
 */

import { monitoringService } from '@/server/api/services/monitoringService';
import { performanceService } from '@/server/api/services/performanceService';
import { websocketService } from '@/server/api/services/websocketService';
import { getFlareSolverrStatus } from '@/server/services/shared/protectedFetch';
import { createApiRoute, successResponse } from '@/utils/api-route-factory';

// Response types handled by routeFactory

interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  checks: Record<string, {
    status: 'healthy' | 'degraded' | 'unhealthy';
    message?: string;
    lastCheck: Date;
    metadata?: Record<string, unknown>;
  }>;
  performance?: {
    cache: {
      hitRate: number;
      size: number;
      itemCount: number;
    };
    api: {
      avgResponseTime: number;
      requestsPerSecond: number;
      errorRate: number;
    };
    websocket: {
      totalClients: number;
      totalChannels: number;
    };
  };
  services?: {
    flaresolverr: {
      enabled: boolean;
      healthy: boolean;
      url: string;
      version: string | null;
    };
  };
}

export default createApiRoute({
  handlers: {
    GET: async (req, res): Promise<void> => {
      // Get health status from monitoring service
      const healthStatus = monitoringService.getHealthStatus();
      const performanceMetrics = performanceService.getMetrics();
      const cacheStats = performanceService.getCacheStats();
      const wsStats = await websocketService.getStats();

      // Include performance metrics if requested
      const queryParams = req["query"] as Record<string, unknown> | undefined;
      const includePerformance = queryParams?.["includePerformance"] === 'true';

      const checksRecord: Record<string, { status: "healthy" | "degraded" | "unhealthy"; message?: string; lastCheck: Date; metadata?: Record<string, unknown>; }> = {};
      for (const check of healthStatus.checks) {
        const checkObj = check as unknown as Record<string, unknown>;
        const checkName = String(checkObj['name']);
        const checkData: { status: "healthy" | "degraded" | "unhealthy"; message?: string; lastCheck: Date; metadata?: Record<string, unknown>; } = {
          status: checkObj['status'] as "healthy" | "degraded" | "unhealthy",
          lastCheck: checkObj['lastCheck'] as Date,
        };
        if (checkObj['message'] !== undefined) {
          checkData.message = String(checkObj['message']);
        }
        if (checkObj['metadata'] !== undefined) {
          checkData.metadata = checkObj['metadata'] as Record<string, unknown>;
        }
        checksRecord[checkName] = checkData;
      }

      const health: HealthCheck = {
        status: healthStatus["status"],
        timestamp: healthStatus.timestamp.toISOString(),
        version: process.env["API_VERSION"] ?? 'v1',
        uptime: process.uptime(),
        checks: checksRecord,
      };

      if (includePerformance) {
        health.performance = {
          cache: {
            hitRate: cacheStats.hitRate,
            size: cacheStats.size,
            itemCount: cacheStats.itemCount,
          },
          api: {
            avgResponseTime: performanceMetrics.avgResponseTime,
            requestsPerSecond: performanceMetrics.requestsPerSecond,
            errorRate: performanceMetrics.errorRate,
          },
          websocket: {
            totalClients: wsStats.totalClients,
            totalChannels: wsStats.totalChannels,
          },
        };
      }

      // Include FlareSolverr status (for Cloudflare bypass)
      const includeServices = queryParams?.["includeServices"] === 'true';
      if (includeServices) {
        const flaresolverrStatus = await getFlareSolverrStatus();
        health.services = {
          flaresolverr: flaresolverrStatus,
        };
      }

      const statusCode = health["status"] === 'healthy' ? 200 :
                        health["status"] === 'degraded' ? 200 : 503;

      const responseWithStatus = res["status"] as (code: number) => { json: (data: unknown) => void };
      responseWithStatus(statusCode).json(successResponse(health));
    }
  },
  requireAuth: false // Public health check endpoint
});