/**
 * Calendar Provider Integration - Schedule Detection
 *
 * Analyzes historical release data to detect recurring patterns
 * and predict future release schedules.
 *
 * Uses statistical analysis of day-of-week frequencies and
 * release intervals to identify weekly/biweekly/monthly patterns.
 *
 * Algorithm:
 * 1. Fetch recent release history (last 20 releases within max historical age)
 * 2. Count releases by day of week
 * 3. Find most common day of week
 * 4. Calculate confidence as (max_count / total_releases)
 * 5. If confidence meets threshold, predict next release date
 * 6. Return schedule with confidence and next release prediction
 *
 * Extracted from: CalendarProviderIntegrationService.ts (lines 474-534)
 */

// ============================================================================
// External Imports
// ============================================================================

import type { ID } from '@/types/search.types';
import type { AsyncResult } from '@/utils/async-result';
import { createSuccessResult, createErrorResult } from '@/utils/async-result';
import { toNumberId } from '@/utils/id-converters';

// ============================================================================
// Internal Imports
// ============================================================================

import type { ProviderIntegrationConfig, ProviderReleaseSchedule } from './types';

// ============================================================================
// Exported Functions
// ============================================================================

/**
 * Detect release schedule from historical data
 *
 * Analyzes recent release history to identify recurring patterns.
 * Requires minimum 3 releases within the configured historical age window.
 *
 * The function:
 * - Fetches up to 20 recent releases within the fallback strategy's max historical age
 * - Calculates day-of-week frequency distribution
 * - Identifies most common release day
 * - Calculates confidence metric as (count of most common day / total releases)
 * - Returns schedule if confidence meets minimum threshold
 * - Predicts next release based on most common day of week
 *
 * @param config - Service configuration with Prisma client and fallback strategy
 * @param mangaId - Manga ID to analyze
 * @returns AsyncResult containing detected schedule or null if no pattern found
 *
 * @example
 * ```typescript
 * const result = await detectScheduleFromHistory(config, mangaId);
 * if (result.isOk()) {
 *   if (result.value) {
 *     console.log(`Schedule detected: ${result.value.pattern}`);
 *     console.log(`Confidence: ${result.value.confidence}`);
 *   } else {
 *     console.log('No schedule pattern detected');
 *   }
 * }
 * ```
 */
export async function detectScheduleFromHistory(
  config: ProviderIntegrationConfig,
  mangaId: ID
): Promise<AsyncResult<ProviderReleaseSchedule | null, Error>> {
  try {
    const numericMangaId = toNumberId(mangaId);

    // Get recent release history
    const history = await config.prisma.releaseHistory.findMany({
      where: {
        mangaId: numericMangaId,
        releaseDate: {
          gte: new Date(
            Date.now() - config.fallbackStrategy.maxHistoricalAge * 24 * 60 * 60 * 1000
          )
        }
      },
      orderBy: {
        releaseDate: 'desc'
      },
      take: 20
    });

    // Require minimum releases for analysis
    if (history.length < 3) {
      return createSuccessResult(null);
    }

    // Analyze release pattern by day of week
    // This is a simplified version - real implementation would use
    // the ReleasePatternAnalyzer service
    const dayOfWeekCounts = new Map<number, number>();
    history.forEach((h: typeof history[number]) => {
      const count = dayOfWeekCounts.get(h.dayOfWeek) ?? 0;
      dayOfWeekCounts.set(h.dayOfWeek, count + 1);
    });

    // Find most common day of week
    let mostCommonDay = 0;
    let maxCount = 0;
    dayOfWeekCounts.forEach((count, day) => {
      if (count > maxCount) {
        maxCount = count;
        mostCommonDay = day;
      }
    });

    // Calculate confidence metric
    const confidence = maxCount / history.length;

    // Return schedule if confidence threshold met
    if (confidence >= config.fallbackStrategy.minConfidence) {
      // Calculate next release date
      const firstHistory = history[0];
      if (firstHistory === undefined) {
        return createSuccessResult(null);
      }

      const lastRelease = firstHistory.releaseDate;
      const nextRelease = new Date(lastRelease);
      const daysUntilNext = (mostCommonDay - lastRelease.getDay() + 7) % 7 || 7;
      nextRelease.setDate(lastRelease.getDate() + daysUntilNext);

      return createSuccessResult({
        provider: 'internal',
        pattern: 'weekly',
        type: 'weekly',
        dayOfWeek: mostCommonDay,
        confidence,
        nextRelease
      } as ProviderReleaseSchedule);
    }

    return createSuccessResult(null);
  } catch (error: unknown) {
    return createErrorResult(error instanceof Error ? error : new Error(String(error)));
  }
}
