/**
 * Parser Cache Management Service
 *
 * Provides cache monitoring, optimization, and statistics for
 * the CachedUnifiedParser.
 *
 * Extracted from: CachedUnifiedParser.ts
 */

import { PostgresCacheProvider } from '../cache/PostgresCacheProvider';
import { CachedUnifiedParser } from '../CachedUnifiedParser';

// ============================================================================
// Type Definitions
// ============================================================================

export interface CacheMetrics {
  hits: number;
  misses: number;
  hitRate: number;
  avgParseTime: number;
  avgCacheTime: number;
  totalSize: number;
}

// ============================================================================
// Cache Management Service
// ============================================================================

export class ParserCacheManager {
  private cache: PostgresCacheProvider;
  private parser: CachedUnifiedParser;

  constructor() {
    this.cache = new PostgresCacheProvider();
    this.parser = new CachedUnifiedParser(this.cache);
  }

  /**
   * Get parser instance
   */
  getParser(): CachedUnifiedParser {
    return this.parser;
  }

  /**
   * Monitor cache performance
   */
  async monitor(): Promise<{
    metrics: CacheMetrics;
    stats: Record<string, unknown>;
    health: 'healthy' | 'degraded' | 'unhealthy';
  }> {
    const metrics = this.parser.getMetrics();
    const stats = await this.cache.getStats();

    // Determine health status
    let health: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (metrics.hitRate < 0.3) {
      health = 'unhealthy';
    } else if (metrics.hitRate < 0.6) {
      health = 'degraded';
    }

    if (stats.totalSize > 1000000000) {
      // 1GB
      health = health === 'healthy' ? 'degraded' : 'unhealthy';
    }

    return { metrics, stats: stats as unknown as Record<string, unknown>, health };
  }

  /**
   * Optimize cache based on usage patterns
   */
  async optimize(): Promise<void> {
    const stats = await this.cache.getStats();

    // Remove least used namespaces if cache is too large
    if (stats.totalSize > 500000000) {
      // 500MB
      const namespaces = stats.namespaces;
      const namespaceKeys = Object.keys(namespaces);
      // Only process if namespaces have entries
      if (namespaceKeys.length > 0) {
        const sortedNamespaces = Object.entries(namespaces).sort(
          ([, a], [, b]) => a.hits - b.hits
        );

        // Remove bottom 20% namespaces
        const toRemove = Math.floor(sortedNamespaces.length * 0.2);
        for (let i = 0; i < toRemove; i++) {
          const namespace = sortedNamespaces[i];
          if (namespace !== undefined) {
            // eslint-disable-next-line no-await-in-loop -- Sequential cache clearing required to avoid race conditions
            await this.cache.clear({ namespace: namespace[0] });
          }
        }
      }
    }

    // Clear old cache entries by namespace
    await this.cache.clear({ namespace: 'parser' });
  }

  /**
   * Export cache statistics for monitoring
   */
  async exportStats(): Promise<string> {
    const { metrics, stats, health } = await this.monitor();

    return JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        health,
        metrics,
        stats,
        recommendations: this.getRecommendations(metrics, stats)
      },
      null,
      2
    );
  }

  /**
   * Get optimization recommendations
   */
  private getRecommendations(
    metrics: CacheMetrics,
    stats: Record<string, unknown>
  ): string[] {
    const recommendations: string[] = [];

    if (metrics.hitRate < 0.5) {
      recommendations.push('Low hit rate - consider increasing TTL or warming cache');
    }

    if (metrics.avgParseTime > 5000) {
      recommendations.push('High parse time - cache is providing significant benefit');
    }

    const totalSize = stats['totalSize'];
    if (typeof totalSize === 'number' && totalSize > 750000000) {
      recommendations.push('Cache size high - consider cleanup or increasing storage');
    }

    const namespaces = stats['namespaces'];
    if (
      namespaces &&
      typeof namespaces === 'object' &&
      Object.keys(namespaces).length > 20
    ) {
      recommendations.push(
        'Many namespaces - consider consolidating or removing unused ones'
      );
    }

    return recommendations;
  }

  /**
   * Cleanup and disconnect
   */
  async disconnect(): Promise<void> {
    await this.parser.disconnect();
  }
}
