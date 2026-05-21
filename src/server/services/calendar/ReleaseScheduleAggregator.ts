/**
 * Release Schedule Aggregator Service
 *
 * Orchestrates schedule data aggregation from multiple metadata providers.
 * Implements fallback mechanisms, consensus algorithms, and caching.
 *
 * Architecture:
 * - calendar-utils.ts - Foundation types and helpers (94 lines)
 * - provider-operations.ts - Provider fetching (309 lines, 3 functions)
 * - aggregation-logic.ts - Aggregation logic (256 lines, 4 functions)
 * - database-operations.ts - Database ops (225 lines, 2 functions)
 * - cache-manager.ts - Cache management (195 lines, class)
 * - ReleaseScheduleAggregator.ts - Main orchestrator (this file)
 *
 * Total: ~1,350 lines across 6 modules (was 573 lines in 1 file)
 * Reduction: Complexity isolated, maintainability improved
 */

import { createSuccessResult, createErrorResult, isSuccess } from '@/utils/async-result';
import type { AsyncResult } from '@/utils/async-result';
import { createLogger } from '@/utils/logger';

// Import types and helpers

// Import specialized modules

import {
  aggregateScheduleData,
} from './aggregation-logic';
import { ScheduleCacheManager } from './cache-manager';
import {
  saveAggregatedSchedule,
} from './database-operations';
import {
  initializeProviders,
  fetchProviderSchedule,
  getProviderMangaId,
} from './provider-operations';

import type {
  AggregatedReleaseSchedule,
  ProviderScheduleData,
  ScheduleAggregatorConfig,
} from './calendar-utils';
import type { PrismaClient } from '@prisma/client';

const logger = createLogger('ReleaseScheduleAggregator');

export class ReleaseScheduleAggregator {
  private readonly prisma: PrismaClient;
  private readonly providers: Map<string, unknown>;
  private readonly minimumConfidence: number;
  private readonly consensusThreshold: number;
  private readonly cacheManager: ScheduleCacheManager;

  constructor(prisma: PrismaClient, config: ScheduleAggregatorConfig = {}) {
    this.prisma = prisma;
    this.minimumConfidence = config.minimumConfidence ?? 0.5;
    this.consensusThreshold = config.consensusThreshold ?? 0.7;

    // Initialize cache manager
    this.cacheManager = new ScheduleCacheManager({
      enabled: config.cacheEnabled ?? false,
      ttl: config.cacheTTL ?? 3600,
    });

    // Initialize providers
    this.providers = new Map();
    initializeProviders(this.providers, config.providers);
  }

  /**
   * Get aggregated release schedule for a manga (ORCHESTRATION ONLY)
   */
  async getAggregatedSchedule(mangaId: number): Promise<AsyncResult<AggregatedReleaseSchedule, Error>> {
    try {
      // 1. Check cache
      if (this.cacheManager.isEnabled()) {
        const cached = this.cacheManager.getFromCache(mangaId);
        if (cached) {
          return createSuccessResult(cached);
        }
      }

      // 2. Get manga metadata
      const manga = await this.prisma.manga.findUnique({
        where: { id: mangaId },
        include: { Metadata: true },
      });

      if (!manga) {
        return createErrorResult(new Error(`Manga not found: ${mangaId}`));
      }

      // 3. Collect provider data
      const providerData: ProviderScheduleData[] = [];
      const providerPromises = Array.from(this.providers).map(
        async ([providerName, provider]) => {
          const providerId = getProviderMangaId(manga, providerName);
          if (!providerId) return null;

          try {
            const scheduleResult = await fetchProviderSchedule(
              provider as Record<string, unknown>,
              providerId,
              providerName
            );

            if (isSuccess(scheduleResult)) {
              return scheduleResult.data;
            }
          } catch (error: unknown) {
            logger.error(`Provider ${providerName} failed`, {
              providerName,
              mangaId,
              error: error instanceof Error ? error.message : String(error),
            });
          }
          return null;
        }
      );

      const results = await Promise.all(providerPromises);
      results.forEach((result) => {
        if (result) {
          providerData.push(result);
        }
      });

      // 4. Aggregate results
      const aggregated = aggregateScheduleData(
        providerData,
        this.minimumConfidence,
        this.consensusThreshold
      );
      aggregated.lastSynced = new Date();

      // 5. Cache result
      if (this.cacheManager.isEnabled()) {
        this.cacheManager.cacheResult(mangaId, aggregated);
      }

      // 6. Save to database
      await saveAggregatedSchedule(this.prisma, mangaId, aggregated);

      return createSuccessResult(aggregated);
    } catch (error: unknown) {
      logger.error('Failed to get aggregated schedule', {
        mangaId,
        error: error instanceof Error ? error.message : String(error),
      });
      return createErrorResult(
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Clear cache for specific manga or all
   */
  clearCache(mangaId?: number): void {
    this.cacheManager.clearCache(mangaId);
  }

  /**
   * Force refresh schedule from all providers
   */
  async refreshSchedule(mangaId: number): Promise<AsyncResult<AggregatedReleaseSchedule, Error>> {
    this.clearCache(mangaId);
    return this.getAggregatedSchedule(mangaId);
  }

  /**
   * Get provider health status
   */
  getProviderStatus(): Record<string, { available: boolean; lastSuccess?: Date }> {
    const status: Record<string, { available: boolean; lastSuccess?: Date }> = {};

    for (const [name, provider] of Array.from(this.providers)) {
      const providerObj = provider as Record<string, unknown>;
      const isEnabled = providerObj['isEnabled'];

      // Type guard to safely call isEnabled if it's a function
      const available = typeof isEnabled === 'function'
        ? (isEnabled as () => boolean)()
        : true;

      status[name] = {
        available,
      };
    }

    return status;
  }
}

/**
 * Factory function to create schedule aggregator
 */
export function createScheduleAggregator(
  prisma: PrismaClient,
  config?: ScheduleAggregatorConfig
): ReleaseScheduleAggregator {
  return new ReleaseScheduleAggregator(prisma, config);
}
