/**
 * FlareSolverr Metrics Service
 *
 * Handles persistent storage and retrieval of FlareSolverr health metrics.
 * Provides recording, querying, aggregation, and cleanup functions.
 *
 * @module flaresolverr/metricsService
 */

import { prisma } from '@/server/db';
import type {
  FlareSolverrAggregatedStats,
  FlareSolverrHourlyMetrics,
  FlareSolverrMetricsConfig,
  FlareSolverrMetricsEntry,
  FlareSolverrMetricsRequestType,
  HealthCheckResult,
} from '@/server/services/flaresolverr/types';
import { logger } from '@/utils/logger';

import type { FlareSolverrMetrics, FlareSolverrRequestType } from '@prisma/client';

// ============================================================================
// Defaults — kept in sync with `prisma/schema.prisma:1133-1135`
// ============================================================================

const DEFAULT_METRICS_ENABLED = true;
const DEFAULT_METRICS_RETENTION_DAYS = 7;
const DEFAULT_HOURLY_RETENTION_DAYS = 30;

// ============================================================================
// Helper Functions
// ============================================================================

/** Round a date down to the start of its hour */
function getHourStart(date: Date): Date {
  const hourStart = new Date(date);
  hourStart.setMinutes(0, 0, 0);
  return hourStart;
}

/**
 * In-memory snapshot of the latest health check, used to populate
 * `recordRequest` rows without a per-call DB lookup. Refreshed on every
 * `recordHealthCheck` call.
 */
let latestHealthSnapshot: { sessionCount: number; healthy: boolean } | null = null;

/** Memoized live aggregation of the current hour's raw metrics. */
const LIVE_HOUR_TTL_MS = 30 * 1000;
let liveHourCache: { hourKey: string; expiresAt: number; entry: FlareSolverrHourlyMetrics | null } | null = null;

/** Calculate percentile value from sorted array */
function calculatePercentile(sortedValues: number[], percentile: number): number | null {
  if (sortedValues.length === 0) return null;
  const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
  return sortedValues[Math.max(0, index)] ?? null;
}

/** Extract non-null response times and sort them */
function extractSortedResponseTimes(metrics: { responseTimeMs: number | null }[]): number[] {
  return metrics
    .map((m) => m.responseTimeMs)
    .filter((rt): rt is number => rt !== null)
    .sort((a, b) => a - b);
}

/** Calculate response time statistics from sorted values */
function calcResponseTimeStats(sortedTimes: number[]): {
  avg: number | null;
  min: number | null;
  max: number | null;
  p95: number | null;
} {
  if (sortedTimes.length === 0) {
    return { avg: null, min: null, max: null, p95: null };
  }
  const sum = sortedTimes.reduce((acc, rt) => acc + rt, 0);
  return {
    avg: sum / sortedTimes.length,
    min: sortedTimes[0] ?? null,
    max: sortedTimes[sortedTimes.length - 1] ?? null,
    p95: calculatePercentile(sortedTimes, 95),
  };
}

/** Calculate uptime percentage from health check metrics */
function calcUptimePercent(metrics: FlareSolverrMetrics[]): number {
  const healthChecks = metrics.filter((m) => m.requestType === 'HEALTH_CHECK');
  if (healthChecks.length === 0) return 0;
  const healthyChecks = healthChecks.filter((m) => m.healthy).length;
  return (healthyChecks / healthChecks.length) * 100;
}

/** Calculate average session count from metrics */
function calcAvgSessionCount(metrics: { sessionCount: number }[]): number {
  if (metrics.length === 0) return 0;
  const sum = metrics.reduce((acc, m) => acc + m.sessionCount, 0);
  return sum / metrics.length;
}

// ============================================================================
// Recording Functions
// ============================================================================

/** Record a health check result as a metric */
export async function recordHealthCheck(result: HealthCheckResult): Promise<void> {
  // Always refresh the in-memory snapshot — even if metrics persistence is
  // disabled, downstream `recordRequest` callers want the latest state.
  latestHealthSnapshot = { healthy: result.healthy, sessionCount: result.sessionCount };

  try {
    const config = await getMetricsConfig();
    if (!config.metricsEnabled) return;

    const now = new Date();
    await prisma.flareSolverrMetrics.create({
      data: {
        timestamp: now,
        healthy: result.healthy,
        responseTimeMs: result.responseTimeMs ?? null,
        version: result.version ?? null,
        sessionCount: result.sessionCount,
        requestType: 'HEALTH_CHECK',
        success: result.healthy,
        errorMessage: result.errorMessage ?? null,
        hour: getHourStart(now),
      },
    });

    logger.debug('[FlareSolverr Metrics] Recorded health check', {
      healthy: result.healthy,
      responseTimeMs: result.responseTimeMs,
    });
  } catch (error) {
    logger.error('[FlareSolverr Metrics] Failed to record health check', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/** Record a request metric (fetch, session operations, etc.) */
export async function recordRequest(
  type: FlareSolverrMetricsRequestType,
  success: boolean,
  responseTimeMs?: number,
  errorMessage?: string
): Promise<void> {
  try {
    const config = await getMetricsConfig();
    if (!config.metricsEnabled) return;

    const now = new Date();
    // Use in-memory snapshot to avoid a DB findFirst on every fetch — the
    // snapshot is refreshed on every `recordHealthCheck`. Falls back to a
    // one-off query only when the process hasn't seen a health check yet.
    let snapshot = latestHealthSnapshot;
    if (!snapshot) {
      const fallback = await prisma.flareSolverrMetrics.findFirst({
        where: { requestType: 'HEALTH_CHECK' },
        orderBy: { timestamp: 'desc' },
        select: { sessionCount: true, healthy: true },
      });
      snapshot = fallback ?? { healthy: false, sessionCount: 0 };
      latestHealthSnapshot = snapshot;
    }

    await prisma.flareSolverrMetrics.create({
      data: {
        timestamp: now,
        healthy: snapshot.healthy,
        responseTimeMs: responseTimeMs ?? null,
        version: null,
        sessionCount: snapshot.sessionCount,
        requestType: type as FlareSolverrRequestType,
        success,
        errorMessage: errorMessage ?? null,
        hour: getHourStart(now),
      },
    });

    logger.debug('[FlareSolverr Metrics] Recorded request', { type, success, responseTimeMs });
  } catch (error) {
    logger.error('[FlareSolverr Metrics] Failed to record request', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// ============================================================================
// Querying Functions
// ============================================================================

/** Get recent raw metrics for time-series display */
export async function getRecentMetrics(hours: number = 24): Promise<FlareSolverrMetricsEntry[]> {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  const metrics = await prisma.flareSolverrMetrics.findMany({
    where: { timestamp: { gte: since } },
    orderBy: { timestamp: 'asc' },
  });

  return metrics.map((m) => ({
    id: m.id,
    timestamp: m.timestamp,
    healthy: m.healthy,
    responseTimeMs: m.responseTimeMs,
    version: m.version,
    sessionCount: m.sessionCount,
    requestType: m.requestType as FlareSolverrMetricsRequestType,
    success: m.success,
    errorMessage: m.errorMessage,
    hour: m.hour,
  }));
}

/** Get hourly aggregated metrics for a date range, including live current hour */
export async function getHourlyMetrics(
  startDate: Date,
  endDate: Date
): Promise<FlareSolverrHourlyMetrics[]> {
  // Get stored hourly aggregations
  const storedMetrics = await prisma.flareSolverrMetricsHourly.findMany({
    where: { hour: { gte: startDate, lte: endDate } },
    orderBy: { hour: 'asc' },
  });

  const results: FlareSolverrHourlyMetrics[] = storedMetrics.map((m) => ({
    id: m.id,
    hour: m.hour,
    totalRequests: m.totalRequests,
    successfulReqs: m.successfulReqs,
    failedReqs: m.failedReqs,
    avgResponseTime: m.avgResponseTime,
    minResponseTime: m.minResponseTime,
    maxResponseTime: m.maxResponseTime,
    p95ResponseTime: m.p95ResponseTime,
    uptimePercent: m.uptimePercent,
    avgSessionCount: m.avgSessionCount,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  }));

  // Also include live aggregation of current hour's raw metrics. Memoize for
  // ~30s — the dashboard polls minute-scale and the live hour is by far the
  // most expensive part of the query (an extra findMany + sort per call).
  const currentHour = getHourStart(new Date());
  const hourKey = currentHour.toISOString();
  const hasCurrentHour = results.some((m) => m.hour.getTime() === currentHour.getTime());

  if (!hasCurrentHour) {
    const liveEntry = await getLiveHourEntry(currentHour, hourKey);
    if (liveEntry) {
      results.push(liveEntry);
    }
  }

  return results.sort((a, b) => a.hour.getTime() - b.hour.getTime());
}

async function getLiveHourEntry(
  currentHour: Date,
  hourKey: string
): Promise<FlareSolverrHourlyMetrics | null> {
  const now = Date.now();
  if (liveHourCache?.hourKey === hourKey && liveHourCache.expiresAt > now) {
    return liveHourCache.entry;
  }

  const rawCurrentHour = await prisma.flareSolverrMetrics.findMany({
    where: { hour: currentHour },
  });

  let entry: FlareSolverrHourlyMetrics | null = null;
  if (rawCurrentHour.length > 0) {
    const totalRequests = rawCurrentHour.length;
    const successfulReqs = rawCurrentHour.filter((m) => m.success).length;
    const failedReqs = totalRequests - successfulReqs;
    const responseTimes = extractSortedResponseTimes(rawCurrentHour);
    const rtStats = calcResponseTimeStats(responseTimes);
    const uptimePercent = rawCurrentHour.some((m) => m.requestType === 'HEALTH_CHECK')
      ? calcUptimePercent(rawCurrentHour)
      : null;
    const avgSessionCount = calcAvgSessionCount(rawCurrentHour);
    entry = {
      id: `live-${hourKey}`,
      hour: currentHour,
      totalRequests,
      successfulReqs,
      failedReqs,
      avgResponseTime: rtStats.avg,
      minResponseTime: rtStats.min,
      maxResponseTime: rtStats.max,
      p95ResponseTime: rtStats.p95,
      uptimePercent,
      avgSessionCount,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  liveHourCache = { hourKey, expiresAt: now + LIVE_HOUR_TTL_MS, entry };
  return entry;
}

/** Build trend comparison between two metric sets */
function buildTrendComparison(
  currentStats: { successRate: number; avgResponseTime: number | null; uptimePercent: number },
  previousMetrics: FlareSolverrMetrics[]
): { successRateChange: number; avgResponseTimeChange: number | null; uptimeChange: number } {
  const prevSuccessful = previousMetrics.filter((m) => m.success).length;
  const prevSuccessRate =
    previousMetrics.length > 0 ? (prevSuccessful / previousMetrics.length) * 100 : 0;

  const prevResponseTimes = extractSortedResponseTimes(previousMetrics);
  const prevAvgResponse =
    prevResponseTimes.length > 0
      ? prevResponseTimes.reduce((s, r) => s + r, 0) / prevResponseTimes.length
      : null;

  const prevUptimePercent = calcUptimePercent(previousMetrics);

  return {
    successRateChange: currentStats.successRate - prevSuccessRate,
    avgResponseTimeChange:
      currentStats.avgResponseTime !== null && prevAvgResponse !== null
        ? currentStats.avgResponseTime - prevAvgResponse
        : null,
    uptimeChange: currentStats.uptimePercent - prevUptimePercent,
  };
}

/** Get aggregated statistics for a time period */
export async function getAggregatedStats(
  period: '1h' | '24h' | '7d'
): Promise<FlareSolverrAggregatedStats> {
  const periodMs = { '1h': 3600000, '24h': 86400000, '7d': 604800000 };
  const now = Date.now();
  const since = new Date(now - periodMs[period]);
  const prevStart = new Date(now - 2 * periodMs[period]);

  const [currentMetrics, previousMetrics] = await Promise.all([
    prisma.flareSolverrMetrics.findMany({
      where: { timestamp: { gte: since } },
      orderBy: { timestamp: 'asc' },
    }),
    prisma.flareSolverrMetrics.findMany({
      where: { timestamp: { gte: prevStart, lt: since } },
    }),
  ]);

  const totalRequests = currentMetrics.length;
  const successfulRequests = currentMetrics.filter((m) => m.success).length;
  const failedRequests = totalRequests - successfulRequests;
  const successRate = totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0;

  const responseTimes = extractSortedResponseTimes(currentMetrics);
  const rtStats = calcResponseTimeStats(responseTimes);
  const uptimePercent = calcUptimePercent(currentMetrics);
  const avgSessionCount = calcAvgSessionCount(currentMetrics);

  const latestMetric = currentMetrics.length > 0 ? currentMetrics[currentMetrics.length - 1] : null;
  const trends = buildTrendComparison(
    { successRate, avgResponseTime: rtStats.avg, uptimePercent },
    previousMetrics
  );

  return {
    period,
    totalRequests,
    successfulRequests,
    failedRequests,
    successRate,
    avgResponseTimeMs: rtStats.avg,
    minResponseTimeMs: rtStats.min,
    maxResponseTimeMs: rtStats.max,
    p95ResponseTimeMs: rtStats.p95,
    uptimePercent,
    avgSessionCount,
    currentSessionCount: latestMetric?.sessionCount ?? 0,
    currentlyHealthy: latestMetric?.healthy ?? false,
    lastChecked: latestMetric?.timestamp ?? null,
    trendsVsPrevious: trends,
  };
}

// ============================================================================
// Aggregation Functions
// ============================================================================

/** Create hourly aggregation record for a set of metrics */
async function createHourlyAggregation(hour: Date, metrics: FlareSolverrMetrics[]): Promise<void> {
  const totalRequests = metrics.length;
  const successfulReqs = metrics.filter((m) => m.success).length;
  const failedReqs = totalRequests - successfulReqs;

  const responseTimes = extractSortedResponseTimes(metrics);
  const rtStats = calcResponseTimeStats(responseTimes);
  const uptimePercent = metrics.some((m) => m.requestType === 'HEALTH_CHECK')
    ? calcUptimePercent(metrics)
    : null;
  const avgSessionCount = calcAvgSessionCount(metrics);

  await prisma.flareSolverrMetricsHourly.upsert({
    where: { hour },
    create: {
      hour,
      totalRequests,
      successfulReqs,
      failedReqs,
      avgResponseTime: rtStats.avg,
      minResponseTime: rtStats.min,
      maxResponseTime: rtStats.max,
      p95ResponseTime: rtStats.p95,
      uptimePercent,
      avgSessionCount,
    },
    update: {
      totalRequests,
      successfulReqs,
      failedReqs,
      avgResponseTime: rtStats.avg,
      minResponseTime: rtStats.min,
      maxResponseTime: rtStats.max,
      p95ResponseTime: rtStats.p95,
      uptimePercent,
      avgSessionCount,
    },
  });
}

/** Aggregate raw metrics into hourly buckets */
export async function aggregateToHourly(): Promise<number> {
  try {
    const latestHourly = await prisma.flareSolverrMetricsHourly.findFirst({
      orderBy: { hour: 'desc' },
      select: { hour: true },
    });

    const startHour = latestHourly
      ? new Date(latestHourly.hour.getTime() + 3600000)
      : new Date(Date.now() - 86400000);
    const endHour = getHourStart(new Date());

    if (startHour >= endHour) {
      logger.debug('[FlareSolverr Metrics] No hours to aggregate');
      return 0;
    }

    const rawMetrics = await prisma.flareSolverrMetrics.findMany({
      where: { hour: { gte: startHour, lt: endHour } },
      orderBy: { hour: 'asc' },
    });

    const hourlyGroups = new Map<string, FlareSolverrMetrics[]>();
    for (const metric of rawMetrics) {
      const hourKey = metric.hour.toISOString();
      const existing = hourlyGroups.get(hourKey) ?? [];
      existing.push(metric);
      hourlyGroups.set(hourKey, existing);
    }

    await Promise.all(
      Array.from(hourlyGroups.entries()).map(([hourKey, metrics]) =>
        createHourlyAggregation(new Date(hourKey), metrics)
      )
    );

    logger.info('[FlareSolverr Metrics] Aggregated hourly metrics', {
      hoursAggregated: hourlyGroups.size,
    });
    return hourlyGroups.size;
  } catch (error) {
    logger.error('[FlareSolverr Metrics] Failed to aggregate hourly', {
      error: error instanceof Error ? error.message : String(error),
    });
    return 0;
  }
}

// ============================================================================
// Cleanup Functions
// ============================================================================

/** Clean up old metrics based on retention configuration */
export async function cleanupOldMetrics(): Promise<{ rawDeleted: number; hourlyDeleted: number }> {
  try {
    const config = await getMetricsConfig();
    const rawCutoff = new Date(Date.now() - config.metricsRetentionDays * 86400000);
    const hourlyCutoff = new Date(Date.now() - config.hourlyRetentionDays * 86400000);

    const [rawResult, hourlyResult] = await Promise.all([
      prisma.flareSolverrMetrics.deleteMany({ where: { timestamp: { lt: rawCutoff } } }),
      prisma.flareSolverrMetricsHourly.deleteMany({ where: { hour: { lt: hourlyCutoff } } }),
    ]);

    logger.info('[FlareSolverr Metrics] Cleaned up old metrics', {
      rawDeleted: rawResult.count,
      hourlyDeleted: hourlyResult.count,
    });
    return { rawDeleted: rawResult.count, hourlyDeleted: hourlyResult.count };
  } catch (error) {
    logger.error('[FlareSolverr Metrics] Failed to cleanup old metrics', {
      error: error instanceof Error ? error.message : String(error),
    });
    return { rawDeleted: 0, hourlyDeleted: 0 };
  }
}

// ============================================================================
// Configuration Functions
// ============================================================================

/** Get metrics configuration from database */
export async function getMetricsConfig(): Promise<FlareSolverrMetricsConfig> {
  const config = await prisma.flareSolverrConfig.findUnique({
    where: { id: 'default' },
    select: { metricsEnabled: true, metricsRetentionDays: true, hourlyRetentionDays: true },
  });
  return {
    metricsEnabled: config?.metricsEnabled ?? DEFAULT_METRICS_ENABLED,
    metricsRetentionDays: config?.metricsRetentionDays ?? DEFAULT_METRICS_RETENTION_DAYS,
    hourlyRetentionDays: config?.hourlyRetentionDays ?? DEFAULT_HOURLY_RETENTION_DAYS,
  };
}

/** Input type for updating metrics config */
export interface UpdateMetricsConfigInput {
  metricsEnabled?: boolean | undefined;
  metricsRetentionDays?: number | undefined;
  hourlyRetentionDays?: number | undefined;
}

/** Update metrics configuration */
export async function updateMetricsConfig(
  config: UpdateMetricsConfigInput
): Promise<FlareSolverrMetricsConfig> {
  const updated = await prisma.flareSolverrConfig.update({
    where: { id: 'default' },
    data: {
      ...(config.metricsEnabled !== undefined && { metricsEnabled: config.metricsEnabled }),
      ...(config.metricsRetentionDays !== undefined && {
        metricsRetentionDays: config.metricsRetentionDays,
      }),
      ...(config.hourlyRetentionDays !== undefined && {
        hourlyRetentionDays: config.hourlyRetentionDays,
      }),
    },
    select: { metricsEnabled: true, metricsRetentionDays: true, hourlyRetentionDays: true },
  });
  logger.info('[FlareSolverr Metrics] Config updated', updated);
  return updated;
}

// ============================================================================
// Exported Service
// ============================================================================

export const flareSolverrMetricsService = {
  recordHealthCheck,
  recordRequest,
  getRecentMetrics,
  getHourlyMetrics,
  getAggregatedStats,
  aggregateToHourly,
  cleanupOldMetrics,
  getMetricsConfig,
  updateMetricsConfig,
};

export default flareSolverrMetricsService;
