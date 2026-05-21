/**
 * FlareSolverr Metrics Procedures
 *
 * Split out from `flaresolverr.ts` to keep the parent router under the
 * 800-line ESLint cap. Procedures are spread back into the parent router's
 * record so client call sites (`trpc.flaresolverr.getRecentMetrics`, etc.)
 * stay unchanged.
 *
 * @module server/trpc/routers/flaresolverr-metrics
 */

import { z } from 'zod';

import { realtimeEmitter } from '@/server/services/realtime/RealtimeEventEmitter';
import { protectedProcedure } from '@/server/trpc/procedures';

/** Lazily import the metrics service so we don't pay for it at router init. */
async function metricsService(): Promise<typeof import('@/server/services/flaresolverr/metricsService').flareSolverrMetricsService> {
  const mod = await import('@/server/services/flaresolverr/metricsService');
  return mod.flareSolverrMetricsService;
}

export const flareSolverrMetricsProcedures = {
  /** Get recent raw metrics for time-series display */
  getRecentMetrics: protectedProcedure
    .input(z.object({ hours: z.number().int().min(1).max(168).default(24) }))
    .query(async ({ input }) => {
      const svc = await metricsService();
      return svc.getRecentMetrics(input.hours);
    }),

  /** Get hourly aggregated metrics for a date range */
  getHourlyMetrics: protectedProcedure
    .input(z.object({ days: z.number().int().min(1).max(30).default(7) }))
    .query(async ({ input }) => {
      const svc = await metricsService();
      const endDate = new Date();
      const startDate = new Date(Date.now() - input.days * 24 * 60 * 60 * 1000);
      return svc.getHourlyMetrics(startDate, endDate);
    }),

  /** Get aggregated statistics for a time period */
  getAggregatedStats: protectedProcedure
    .input(z.object({ period: z.enum(['1h', '24h', '7d']).default('24h') }))
    .query(async ({ input }) => {
      const svc = await metricsService();
      return svc.getAggregatedStats(input.period);
    }),

  /** Get metrics configuration */
  getMetricsConfig: protectedProcedure.query(async () => {
    const svc = await metricsService();
    return svc.getMetricsConfig();
  }),

  /** Update metrics configuration */
  updateMetricsConfig: protectedProcedure
    .input(
      z.object({
        metricsEnabled: z.boolean().optional(),
        metricsRetentionDays: z.number().int().min(1).max(90).optional(),
        hourlyRetentionDays: z.number().int().min(1).max(365).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const svc = await metricsService();
      const updated = await svc.updateMetricsConfig(input);

      void realtimeEmitter.emitSystemEvent({
        eventType: 'flaresolverr:metricsConfigUpdated',
        source: 'flaresolverr-router',
        message: 'FlareSolverr metrics configuration updated',
        data: {
          metricsEnabled: updated.metricsEnabled,
          metricsRetentionDays: updated.metricsRetentionDays,
          hourlyRetentionDays: updated.hourlyRetentionDays,
        },
      });

      return { success: true, config: updated };
    }),

  /** Manually trigger hourly aggregation (admin/maintenance) */
  aggregateMetrics: protectedProcedure.mutation(async () => {
    const svc = await metricsService();
    const count = await svc.aggregateToHourly();
    return { success: true, hoursAggregated: count };
  }),

  /** Manually trigger metrics cleanup (admin/maintenance) */
  cleanupMetrics: protectedProcedure.mutation(async () => {
    const svc = await metricsService();
    const result = await svc.cleanupOldMetrics();
    return { success: true, ...result };
  }),
};
