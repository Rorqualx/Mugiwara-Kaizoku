// @ts-nocheck
// TODO: Disabled until WantedItem and ApiMetric Prisma models are implemented in schema.prisma
/**
 * Metrics API Adapter
 *
 * Handles metrics and analytics operations
 */
import { prisma } from '@/server/db';
import type { ApiAuth } from '@/types/api/common';
import type { ApiConfig } from '@/types/api/common';
import type { AsyncResult } from '@/utils/async-result';
import { createSuccessResult, createErrorResult, isSuccess} from '@/utils/async-result';
import { unwrapOr } from '@/utils/async-result';

import { apiAuthService } from '../services/apiAuth';

import { BaseApiAdapter } from './BaseApiAdapter';

// Prisma query result types
interface ApiMetricRecord {
  timestamp: Date;
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime: number;
}

interface AggregateResult {
  _avg: {
    responseTime: number | null;
  };
}

// Metrics types
export interface MetricsQuery {
  startDate?: string;
  endDate?: string;
  interval?: 'hour' | 'day' | 'week' | 'month';
  resources?: string[];
  actions?: string[];
  groupBy?: string[];
}
export interface MetricDataPoint {
  timestamp: string;
  count: number;
  resource?: string;
  action?: string;
  statusCode?: number;
}
export interface SystemMetrics {
  manga: {
    total: number;
    byStatus: Record<string, number>;
    bySource: Record<string, number>;
    recentlyAdded: number;
    recentlyUpdated: number;
  };
  chapters: {
    total: number;
    byStatus: Record<string, number>;
    downloaded: number;
    pending: number;
  };
  downloads: {
    total: number;
    active: number;
    queued: number;
    completed: number;
    failed: number;
    totalSizeBytes: number;
    averageSpeed: number;
  };
  libraries: {
    total: number;
    totalSize: number;
    lastScanTime?: string;
  };
  api: {
    totalRequests: number;
    successRate: number;
    averageResponseTime: number;
    topEndpoints: {endpoint: string;count: number;}[];
    topUsers: {userId: string;count: number;}[];
  };
}
/**
 * MetricsApiAdapter class
 * 
 * Provides metrics and analytics capabilities
 */
export class MetricsApiAdapter extends BaseApiAdapter<ApiConfig> {
  /**
   * Get API usage metrics (private AsyncResult method)
   */
  private async _getApiMetrics(query: MetricsQuery): Promise<AsyncResult<MetricDataPoint[], Error>> {
    try {
      const where: Record<string, unknown> = {};
      // Date range filter
      if (query.startDate ?? query.endDate) {
        where["timestamp"] = {
          ...(query.startDate && { gte: new Date(query.startDate) }),
          ...(query.endDate && { lte: new Date(query.endDate) })
        };
      }
      // Resource filter
      if (query.resources?.length) {
        where["endpoint"] = {
          in: query.resources.map((r) => `/api/v1/${r}`)
        };
      }
      // Get metrics
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const metrics = await prisma.apiMetric.findMany({
        where,
        orderBy: { timestamp: 'asc' }
      }) as ApiMetricRecord[];
      // Group by interval if specified
      const dataPoints = this.groupByInterval(metrics as unknown as Record<string, unknown>[], query.interval ?? 'hour');
      return createSuccessResult(dataPoints);
    } catch (error: unknown) {
      this.log('Failed to get API metrics', error);
      return createErrorResult(
        this.createError(`Failed to get API metrics: ${error instanceof Error ? error.message : String(error)}`, error)
      );
    }
  }
  /**
   * Get API metrics (public method)
   */
  public async getApiMetrics(query: MetricsQuery): Promise<MetricDataPoint[]> {
    const result = await this._getApiMetrics(query);
    return unwrapOr(result, []);
  }
  /**
   * Get system metrics (private AsyncResult method)
   */
  private async _getSystemMetrics(): Promise<AsyncResult<SystemMetrics, Error>> {
    try {
      const now = new Date();
      const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      // Manga metrics
      const [
      mangaTotal,
      mangaByStatus,
      mangaBySource,
      mangaRecentlyAdded,
      mangaRecentlyUpdated] =
      await Promise.all([
      prisma.manga.count(),
      prisma.manga.groupBy({
        by: ['publicationStatus' as const],
        _count: true
      }),
      prisma.manga.groupBy({
        by: ['source' as const],
        _count: true
      }),
      prisma.manga.count({
        where: { createdAt: { gte: lastWeek } }
      }),
      prisma.manga.count({
        where: { updatedAt: { gte: lastWeek } }
      })]
      );
      // Chapter metrics
      const [
      chapterTotal,
      chapterByStatus,
      chapterDownloaded,
      chapterPending] =
      await Promise.all([
      prisma.chapter.count(),
      prisma.chapter.groupBy({
        by: ['downloadStatus'],
        _count: true
      }),
      prisma.chapter.count({
        where: { downloadStatus: 'COMPLETED' }
      }),
      prisma.chapter.count({
        where: { downloadStatus: 'PENDING' }
      })]
      );
      // Download metrics
      // TODO: Add Download model (separate download tracking)
      // Currently using Chapter.downloadStatus instead
      // const [
      // downloadTotal,
      // downloadActive,
      // downloadQueued,
      // downloadCompleted,
      // downloadFailed,
      // downloadTotalSize] =
      // await Promise.all([
      // prisma.download.count(),
      // prisma.download.count({
      //   where: { status: 'DOWNLOADING' }
      // }),
      // prisma.download.count({
      //   where: { status: 'PENDING' }
      // }),
      // prisma.download.count({
      //   where: { status: 'COMPLETED' }
      // }),
      // prisma.download.count({
      //   where: { status: 'FAILED' }
      // }),
      // prisma.download.aggregate({
      //   where: { status: 'COMPLETED' },
      //   _sum: { size: true }
      // })]
      // );
      // Temporary: Use Chapter.downloadStatus instead until Download model is implemented
      const [
      downloadTotal,
      downloadActive,
      downloadQueued,
      downloadCompleted,
      downloadFailed,
      _downloadTotalSize] =
      await Promise.all([
      prisma.chapter.count({ where: { downloadStatus: { not: null } } }),
      prisma.chapter.count({ where: { downloadStatus: 'DOWNLOADING' } }),
      prisma.chapter.count({ where: { downloadStatus: 'PENDING' } }),
      prisma.chapter.count({ where: { downloadStatus: 'COMPLETED' } }),
      prisma.chapter.count({ where: { downloadStatus: 'ERROR' } }),
      Promise.resolve({ _sum: { size: null } })
      ]);
      // Library metrics
      const [libraryTotal, lastScan] = await Promise.all([
      prisma.library.count(),
      prisma.library.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true }
      })]
      );
      // API metrics
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const [
      apiTotalRequests,
      apiSuccessCount,
      apiAvgResponseTime,
      apiTopEndpoints,
      _apiTopUsers] =
      await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      prisma.apiMetric.count(),
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      prisma.apiMetric.count({
        where: {
          statusCode: { gte: 200, lt: 400 }
        }
      }),
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      prisma.apiMetric.aggregate({
        _avg: { responseTime: true }
      }) as AggregateResult,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      prisma.apiMetric.groupBy({
        by: ['endpoint'],
        _count: true,
        orderBy: { endpoint: 'desc' },
        take: 5
      }) as Array<{ endpoint: string; _count: number }>,
      // Note: userId is not a field on ApiMetric, skipping this query
      Promise.resolve([]) as Promise<Array<{ userId: string; _count: number }>>]
      );
      const metrics: SystemMetrics = {
        manga: {
          total: mangaTotal,
          byStatus: Object.fromEntries(
            (mangaByStatus as Array<{ publicationStatus: string; _count: number }>).map((s) => [s.publicationStatus, s._count])
          ),
          bySource: Object.fromEntries(
            (mangaBySource as Array<{ source: string; _count: number }>).map((s) => [s.source, s._count])
          ),
          recentlyAdded: mangaRecentlyAdded,
          recentlyUpdated: mangaRecentlyUpdated
        },
        chapters: {
          total: chapterTotal,
          byStatus: Object.fromEntries(
            (chapterByStatus as Array<{ downloadStatus: string; _count: number }>).map((s) => [s.downloadStatus, s._count])
          ),
          downloaded: chapterDownloaded,
          pending: chapterPending
        },
        downloads: {
          total: downloadTotal,
          active: downloadActive,
          queued: downloadQueued,
          completed: downloadCompleted,
          failed: downloadFailed,
          totalSizeBytes: 0, // Would need to calculate from downloads
          averageSpeed: 0 // Would need to calculate from active downloads
        },
        libraries: {
          total: libraryTotal,
          totalSize: 0, // Would need to calculate from file system
          ...(lastScan?.createdAt && { lastScanTime: lastScan.createdAt.toISOString() })
        },
        api: {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          totalRequests: apiTotalRequests,
          successRate: apiTotalRequests > 0 ?
          apiSuccessCount / apiTotalRequests * 100 :
          0,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
          averageResponseTime: apiAvgResponseTime._avg.responseTime ?? 0,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          topEndpoints: apiTopEndpoints.map((e: { endpoint: string; _count: number }) => ({
            endpoint: e.endpoint,
            count: e._count
          })),
          topUsers: []
        }
      };
      return createSuccessResult(metrics);
    } catch (error: unknown) {
      this.log('Failed to get system metrics', error);
      return createErrorResult(
        this.createError(`Failed to get system metrics: ${error instanceof Error ? error.message : String(error)}`, error)
      );
    }
  }
  /**
   * Get system metrics (public method)
   */
  public async getSystemMetrics(): Promise<SystemMetrics> {
    const result = await this._getSystemMetrics();
    if (isSuccess(result)) {
      return result.data;
    }
    throw new Error('Failed to get system metrics');
  }
  /**
   * Get user activity metrics (private AsyncResult method)
   */
  private async _getUserActivity(userId: string, days: number = 30): Promise<AsyncResult<unknown, Error>> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      // Get user's API activity
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const apiActivity = await prisma.apiMetric.groupBy({
        by: ['endpoint', 'method'],
        where: {
          timestamp: { gte: startDate }
        },
        _count: true
      }) as Array<{ endpoint: string; method: string; _count: number }>;
      // Get user's manga activity
      const mangaCount = await prisma.manga.count({
        where: {
          createdAt: { gte: startDate }
          // Assuming we track who created manga
        }
      });
      // Get user's download activity
      // TODO: Add Download model (separate download tracking)
      // Currently using Chapter.downloadStatus instead
      // const downloadCount = await prisma.download.count({
      //   where: {
      //     createdAt: { gte: startDate }
      //     // Assuming we track who initiated downloads
      //   }
      // });
      // Temporary: Use Chapter.downloadStatus instead until Download model is implemented
      const downloadCount = await prisma.chapter.count({
        where: {
          downloadStatus: { not: null },
          createdAt: { gte: startDate }
        }
      });
      const activity = {
        userId,
        period: {
          start: startDate.toISOString(),
          end: new Date().toISOString(),
          days
        },
        api: {
          totalRequests: apiActivity.reduce((sum: number, a) => sum + a._count, 0),
          byEndpoint: apiActivity.map((a) => ({
            endpoint: a.endpoint,
            method: a.method,
            count: a._count
          }))
        },
        resources: {
          mangaCreated: mangaCount,
          downloadsInitiated: downloadCount
        }
      };
      return createSuccessResult(activity);
    } catch (error: unknown) {
      this.log(`Failed to get user activity for ${userId}`, error);
      return createErrorResult(
        this.createError(`Failed to get user activity: ${error instanceof Error ? error.message : String(error)}`, error)
      );
    }
  }
  /**
   * Get user activity (public method)
   */
  public async getUserActivity(userId: string, days?: number): Promise<unknown> {
    const result = await this._getUserActivity(userId, days);
    return unwrapOr(result, undefined);
  }
  /**
   * Group metrics by time interval
   */
  private groupByInterval(metrics: Record<string, unknown>[], interval: string): MetricDataPoint[] {
    const groups = new Map<string, MetricDataPoint>();
    for (const metric of metrics) {
      const timestamp = metric["timestamp"];
      if (!(timestamp instanceof Date)) continue;
      const key = this.getIntervalKey(timestamp, interval);
      const existing = groups.get(key);
      if (existing) {
        existing.count++;
      } else {
        const endpoint = metric["endpoint"];
        const statusCode = metric["statusCode"];
        groups.set(key, {
          timestamp: key,
          count: 1,
          ...(typeof endpoint === 'string' && { resource: endpoint }),
          ...(typeof statusCode === 'number' && { statusCode: statusCode })
        });
      }
    }
    return Array.from(groups.values());
  }
  /**
   * Get interval key for grouping
   */
  private getIntervalKey(date: Date, interval: string): string {
    const d = new Date(date);
    switch (interval) {
      case 'hour':
        d.setMinutes(0, 0, 0);
        break;
      case 'day':
        d.setHours(0, 0, 0, 0);
        break;
      case 'week': {
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        d.setDate(diff);
        d.setHours(0, 0, 0, 0);
        break;
      }
      case 'month':
        d.setDate(1);
        d.setHours(0, 0, 0, 0);
        break;
      default:
        // Default to hour interval
        d.setMinutes(0, 0, 0);
        break;
    }
    return d.toISOString();
  }
  /**
   * Validate API key implementation
   */
  protected async validateApiKey(key: string): Promise<ApiAuth | null> {
    const result = await apiAuthService.validateApiKey(key);
    if (isSuccess(result)) {
      // Convert apiAuthService ApiAuth to api/common ApiAuth format
      return {
        type: 'apikey',
        credentials: key
      };
    }
    return null;
  }
}
/**
 * Factory function to create MetricsApiAdapter
 */
export function createMetricsApiAdapter(config: ApiConfig): MetricsApiAdapter {
  return new MetricsApiAdapter(config);
}