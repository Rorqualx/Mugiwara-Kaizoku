/**
 * Pattern Metrics & Performance Operations
 *
 * Operations for tracking pattern usage metrics and performance statistics.
 * Handles metric updates and aggregate statistics reporting.
 *
 * Extracted from: DatabasePatternStore.ts (lines 292-458)
 */

import { logger } from '@/server/utils/logger';

import type { Pattern, PatternMetrics } from '../types';
import type { PrismaClient, Prisma as _Prisma } from '@prisma/client';

/**
 * Update pattern metrics
 *
 * Updates usage statistics for a pattern including accuracy,
 * usage counts, and success/failure rates.
 *
 * NOTE: Currently a no-op until ML models are added to schema.prisma.
 *
 * @param prisma - Prisma client instance
 * @param id - Pattern ID to update
 * @param metrics - Partial metrics to update
 * @param _cache - Cache Map (unused until ML models added)
 */
export async function updatePatternMetrics(
  prisma: PrismaClient,
  id: string,
  metrics: Partial<PatternMetrics>,
  _cache: Map<string, Pattern>
): Promise<void> {
  // TODO: Add ML models to schema (see Agent 2 report from Wave 1)
  logger.warn('ML pattern recognition disabled - learnedPattern model not in schema');
  logger.debug('Pattern metrics would be updated:', { patternId: id, metrics });

  // Fallback: No-op (cache-only storage doesn't persist metrics)
  return Promise.resolve();

  /* Disabled until ML models added to schema:
  try {
    const updates = {} as Record<string, unknown>;

    // Map PatternMetrics properties to database fields
    if (metrics.averageConfidence !== undefined) {
      updates["accuracy"] = metrics.averageConfidence;
    }
    if (metrics.totalMatches !== undefined) {
      updates["usageCount"] = { increment: metrics.totalMatches };
    }
    if (metrics.successfulExtractions !== undefined) {
      updates["successCount"] = { increment: metrics.successfulExtractions };
    }
    if (metrics.errorRate !== undefined) {
      const failureCount = Math.round(metrics.errorRate * (metrics.totalMatches ?? 1));
      updates["failureCount"] = { increment: failureCount };
    }

    await prisma.learnedPattern.update({
      where: { id },
      data: {
        ...updates,
        lastSeen: metrics.lastUsed ?? new Date()
      } as Prisma.LearnedPatternUpdateInput
    });

    // Record performance metrics
    if (metrics.averageExtractionTime !== undefined || metrics.averageConfidence !== undefined) {
      await recordPerformance(prisma, id, metrics);
    }

    // Clear cache entry to force reload
    cache.delete(id);
  } catch (error: unknown) {
    logger.error('Error updating pattern metrics', { error, patternId: id, metrics });
  }
  */
}

// NOTE: recordPerformance function removed - it was unused (called from commented-out code).
// Will be reactivated when ML models are added to schema.prisma.
// Original location: line 88-108 in metrics-operations.ts
// Original code is preserved in commented-out section of updatePatternMetrics above.

/**
 * Get pattern statistics
 *
 * Returns aggregate statistics about patterns including counts,
 * category breakdowns, and recent performance metrics.
 *
 * @param prisma - Prisma client instance
 * @param cache - Cache Map for cache-only fallback
 * @returns Statistics object
 */
export async function getStatistics(
  prisma: PrismaClient,
  cache: Map<string, Pattern>
): Promise<unknown> {
  // TODO: Add ML models to schema (see Agent 2 report from Wave 1)
  logger.warn('ML pattern recognition disabled - learnedPattern model not in schema');

  // Fallback: Return cache-only statistics
  const patterns = Array.from(cache.values());
  return Promise.resolve({
    totalPatterns: patterns.length,
    activePatterns: patterns.length,
    // FIX: Use immutable reduce pattern (no param-reassignment)
    categoryStats: patterns.reduce((acc: Record<string, number>, p) => {
      return { ...acc, [p.type]: (acc[p.type] ?? 0) + 1 };
    }, {} as Record<string, number>),
    recentPerformance: null,
    cacheSize: cache.size,
    mlDisabled: true
  });

  /* Disabled until ML models added to schema:
  try {
    const totalPatterns = await prisma.learnedPattern.count();
    const activePatterns = await prisma.learnedPattern.count({
      where: { isActive: true }
    });

    const categoryStats = await prisma.learnedPattern.groupBy({
      by: ['category'],
      _count: true,
      _avg: {
        confidence: true,
        accuracy: true
      }
    });

    const recentPerformance = await prisma.patternPerformance.aggregate({
      _avg: {
        successRate: true,
        avgExtractionTime: true
      },
      where: {
        timestamp: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      }
    });

    return {
      totalPatterns,
      activePatterns,
      categoryStats,
      recentPerformance,
      cacheSize: cache.size
    };
  } catch (error: unknown) {
    logger.error('Error getting statistics', { error });
    return {};
  }
  */
}
