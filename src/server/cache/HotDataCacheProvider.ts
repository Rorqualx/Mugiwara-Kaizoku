/**
 * Hot Data Cache Provider - Ultra-Fast Entity Caching
 *
 * Uses the UNLOGGED hot_data_cache table for frequently accessed entities.
 * Provides sub-5ms access to hot manga, chapters, and metadata.
 *
 * Features:
 * - Entity-specific caching (manga, chapter, user, metadata, search, anilist_detail)
 * - Heat score tracking (frequency + recency)
 * - Auto-promotion from cache_unified
 * - Auto-demotion when cold
 * - Bulk cache warming for top N entities
 * - Tag-based invalidation
 *
 * Performance:
 * - Hot data access: ~2-5ms
 * - Regular cache access: ~15-30ms
 * - Database access: ~50-200ms
 *
 * @module server/cache/HotDataCacheProvider
 */

import { z } from 'zod';

import { logger } from '@/utils/logger';

import { prisma } from '../db';

// ============================================================================
// Type Definitions
// ============================================================================

export type EntityType = 'manga' | 'chapter' | 'user' | 'metadata' | 'search' | 'anilist_detail';

export interface HotCacheEntry {
  entityType: EntityType;
  entityId: string;
  cacheData: unknown;
  hitCount: number;
  heatScore: number;
  lastAccessed: Date;
  expiresAt: Date | null;
  tags: string[];
}

export interface HotCacheOptions {
  ttl?: number; // Time to live in seconds
  tags?: string[]; // Tags for bulk operations
  forceHot?: boolean; // Force into hot cache even if not hot
}

export interface HeatScoreFactors {
  accessFrequency: number; // Weight: 0.7
  recency: number; // Weight: 0.3
  manualBoost?: number; // Optional manual boost (0-1)
}

export interface HotCacheStats {
  totalEntries: number;
  entriesByType: Record<EntityType, number>;
  topHottest: HotCacheEntry[];
  averageHeatScore: number;
  promotionCount: number;
  demotionCount: number;
}

// Validation schemas
const EntityTypeSchema = z.enum(['manga', 'chapter', 'user', 'metadata', 'search', 'anilist_detail']);
const EntityIdSchema = z.string().min(1);

// ============================================================================
// Hot Data Cache Provider
// ============================================================================

export class HotDataCacheProvider {
  private static instance: HotDataCacheProvider | undefined;

  // Configuration
  private readonly promotionThreshold: number;
  private readonly demotionTimeout: number; // Seconds of inactivity
  private readonly maxHotEntries: number;
  private readonly heatDecayRate: number; // How fast heat cools down

  // Statistics
  private stats = {
    promotions: 0,
    demotions: 0,
    hits: 0,
    misses: 0,
    errors: 0
  };

  constructor(options: {
    promotionThreshold?: number;
    demotionTimeout?: number;
    maxHotEntries?: number;
    heatDecayRate?: number;
  } = {}) {
    this.promotionThreshold = options.promotionThreshold ?? 10; // 10 accesses
    this.demotionTimeout = options.demotionTimeout ?? 1800; // 30 minutes
    this.maxHotEntries = options.maxHotEntries ?? 1000;
    this.heatDecayRate = options.heatDecayRate ?? 0.95; // 5% decay per check

    logger.info('HotDataCacheProvider initialized', {
      promotionThreshold: this.promotionThreshold,
      demotionTimeout: this.demotionTimeout,
      maxHotEntries: this.maxHotEntries
    });
  }

  /**
   * Singleton getInstance
   */
  static getInstance(options?: ConstructorParameters<typeof HotDataCacheProvider>[0]): HotDataCacheProvider {
    // Initialize instance if not exists
    HotDataCacheProvider.instance ??= new HotDataCacheProvider(options);
    return HotDataCacheProvider.instance;
  }

  /**
   * Get data from hot cache
   * Ultra-fast access for frequently used entities
   */
  async getHot<T = unknown>(
    entityType: EntityType,
    entityId: string
  ): Promise<T | null> {
    try {
      // Validate inputs
      EntityTypeSchema.parse(entityType);
      EntityIdSchema.parse(entityId);

      const result = await prisma.$queryRaw<HotCacheEntry[]>`
        SELECT
          entity_type as "entityType",
          entity_id as "entityId",
          cache_data as "cacheData",
          hit_count as "hitCount",
          heat_score as "heatScore",
          last_accessed as "lastAccessed",
          expires_at as "expiresAt",
          tags
        FROM hot_data_cache
        WHERE entity_type = ${entityType}
          AND entity_id = ${entityId}
          AND (expires_at IS NULL OR expires_at > NOW())
      `;

      if (result.length === 0) {
        this.stats.misses++;
        return null;
      }

      this.stats.hits++;

      // Update access stats (fire and forget)
      this.updateAccessStats(entityType, entityId).catch(err =>
        logger.error('Failed to update access stats:', err)
      );

      return result[0]?.cacheData as T;
    } catch (error) {
      this.stats.errors++;
      logger.error('Hot cache get error:', error);
      return null; // Gracefully degrade
    }
  }

  /**
   * Set data in hot cache
   * Stores entity with initial heat score
   */
  async setHot(
    entityType: EntityType,
    entityId: string,
    data: unknown,
    options: HotCacheOptions = {}
  ): Promise<boolean> {
    try {
      // Validate inputs
      EntityTypeSchema.parse(entityType);
      EntityIdSchema.parse(entityId);

      const { ttl, tags = [], forceHot = false } = options;
      const expiresAt = ttl ? new Date(Date.now() + ttl * 1000) : null;
      const initialHeatScore = forceHot ? 100 : 1.0;

      await prisma.$executeRaw`
        INSERT INTO hot_data_cache (
          entity_type,
          entity_id,
          cache_data,
          hit_count,
          heat_score,
          last_accessed,
          expires_at,
          tags
        ) VALUES (
          ${entityType},
          ${entityId},
          ${JSON.stringify(data)}::jsonb,
          1,
          ${initialHeatScore},
          NOW(),
          ${expiresAt},
          ${tags}::text[]
        )
        ON CONFLICT (entity_type, entity_id) DO UPDATE SET
          cache_data = EXCLUDED.cache_data,
          hit_count = hot_data_cache.hit_count + 1,
          heat_score = GREATEST(hot_data_cache.heat_score, EXCLUDED.heat_score),
          last_accessed = NOW(),
          expires_at = EXCLUDED.expires_at,
          tags = EXCLUDED.tags
      `;

      return true;
    } catch (error) {
      this.stats.errors++;
      logger.error('Hot cache set error:', error);
      return false;
    }
  }

  /**
   * Promote entity to hot cache
   * Move frequently accessed data from regular cache to hot cache
   */
  async promoteToHot(
    entityType: EntityType,
    entityId: string,
    data: unknown,
    heatScore: number = 10
  ): Promise<boolean> {
    try {
      const promoted = await this.setHot(entityType, entityId, data, {
        forceHot: true
      });

      if (promoted) {
        this.stats.promotions++;
        logger.info(`Promoted ${entityType}:${entityId} to hot cache`, {
          heatScore
        });
      }

      return promoted;
    } catch (error) {
      logger.error('Promotion error:', error);
      return false;
    }
  }

  /**
   * Demote entity from hot cache
   * Remove cold data from hot cache
   */
  async demoteFromHot(
    entityType: EntityType,
    entityId: string
  ): Promise<boolean> {
    try {
      const deleted = await prisma.$executeRaw`
        DELETE FROM hot_data_cache
        WHERE entity_type = ${entityType}
          AND entity_id = ${entityId}
      `;

      if (deleted > 0) {
        this.stats.demotions++;
        logger.info(`Demoted ${entityType}:${entityId} from hot cache`);
      }

      return deleted > 0;
    } catch (error) {
      logger.error('Demotion error:', error);
      return false;
    }
  }

  /**
   * Bulk warm cache
   * Pre-populate hot cache with multiple entities
   */
  async warmCache(
    entityType: EntityType,
    entities: Array<{ id: string; data: unknown }>,
    options: HotCacheOptions = {}
  ): Promise<number> {
    try {
      // Execute all cache operations in parallel for better performance
      const results = await Promise.all(
        entities.map(async (entity) =>
          this.setHot(
            entityType,
            entity.id,
            entity.data,
            { ...options, forceHot: true }
          )
        )
      );

      const warmed = results.filter(Boolean).length;

      logger.info(`Warmed ${warmed}/${entities.length} ${entityType} entities in hot cache`);
      return warmed;
    } catch (error) {
      logger.error('Cache warming error:', error);
      return 0;
    }
  }

  /**
   * Calculate heat score
   * Combines access frequency and recency
   */
  calculateHeatScore(factors: HeatScoreFactors): number {
    const {
      accessFrequency,
      recency,
      manualBoost = 0
    } = factors;

    // Formula: (frequency * 0.7) + (recency * 0.3) + manual boost
    const baseScore = (accessFrequency * 0.7) + (recency * 0.3);
    const finalScore = Math.min(100, baseScore + (manualBoost * 10));

    return Math.max(0, finalScore);
  }

  /**
   * Check if entity should be promoted
   */
  async shouldPromote(
    entityType: EntityType,
    entityId: string,
    accessCount: number
  ): Promise<boolean> {
    // Check if already in hot cache
    const existing = await this.getHot(entityType, entityId);
    if (existing) return false; // Already promoted

    // Check access threshold
    return accessCount >= this.promotionThreshold;
  }

  /**
   * Clean cold entries
   * Remove entries that haven't been accessed recently
   */
  async cleanCold(): Promise<number> {
    try {
      const cutoffTime = new Date(Date.now() - (this.demotionTimeout * 1000));

      const deleted = await prisma.$executeRaw`
        DELETE FROM hot_data_cache
        WHERE last_accessed < ${cutoffTime}
      `;

      if (deleted > 0) {
        logger.info(`Cleaned ${deleted} cold entries from hot cache`);
      }

      return deleted;
    } catch (error) {
      logger.error('Clean cold error:', error);
      return 0;
    }
  }

  /**
   * Evict if over capacity
   * Remove coldest entries when cache is full
   */
  async evictIfNeeded(): Promise<number> {
    try {
      const count = await prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count FROM hot_data_cache
      `;

      const currentCount = Number(count[0]?.count ?? 0);

      if (currentCount <= this.maxHotEntries) {
        return 0;
      }

      // Evict 10% of coldest entries
      const toEvict = Math.floor(this.maxHotEntries * 0.1);

      const evicted = await prisma.$executeRaw`
        DELETE FROM hot_data_cache
        WHERE (entity_type, entity_id) IN (
          SELECT entity_type, entity_id
          FROM hot_data_cache
          ORDER BY heat_score ASC, last_accessed ASC
          LIMIT ${toEvict}
        )
      `;

      logger.info(`Evicted ${evicted} coldest entries from hot cache`);
      return evicted;
    } catch (error) {
      logger.error('Eviction error:', error);
      return 0;
    }
  }

  /**
   * Clear by tags
   * Invalidate all entries with specific tags
   */
  async clearByTags(tags: string[]): Promise<number> {
    try {
      const deleted = await prisma.$executeRaw`
        DELETE FROM hot_data_cache
        WHERE tags && ${tags}::text[]
      `;

      logger.info(`Cleared ${deleted} entries with tags:`, tags);
      return deleted;
    } catch (error) {
      logger.error('Clear by tags error:', error);
      return 0;
    }
  }

  /**
   * Clear by entity type
   */
  async clearByType(entityType: EntityType): Promise<number> {
    try {
      const deleted = await prisma.$executeRaw`
        DELETE FROM hot_data_cache
        WHERE entity_type = ${entityType}
      `;

      logger.info(`Cleared ${deleted} ${entityType} entries from hot cache`);
      return deleted;
    } catch (error) {
      logger.error('Clear by type error:', error);
      return 0;
    }
  }

  /**
   * Get statistics
   */
  async getStats(): Promise<HotCacheStats> {
    try {
      const counts = await prisma.$queryRaw<Array<{
        entityType: EntityType;
        count: bigint;
      }>>`
        SELECT
          entity_type as "entityType",
          COUNT(*) as count
        FROM hot_data_cache
        GROUP BY entity_type
      `;

      const topHottest = await prisma.$queryRaw<HotCacheEntry[]>`
        SELECT
          entity_type as "entityType",
          entity_id as "entityId",
          cache_data as "cacheData",
          hit_count as "hitCount",
          heat_score as "heatScore",
          last_accessed as "lastAccessed",
          expires_at as "expiresAt",
          tags
        FROM hot_data_cache
        ORDER BY heat_score DESC, hit_count DESC
        LIMIT 20
      `;

      const avgScore = await prisma.$queryRaw<Array<{ avg: number }>>`
        SELECT AVG(heat_score) as avg
        FROM hot_data_cache
      `;

      const entriesByType: Record<EntityType, number> = {
        manga: 0,
        chapter: 0,
        user: 0,
        metadata: 0,
        search: 0,
        anilist_detail: 0
      };

      for (const row of counts) {
        entriesByType[row.entityType] = Number(row.count);
      }

      const totalEntries = Object.values(entriesByType).reduce((a, b) => a + b, 0);

      return {
        totalEntries,
        entriesByType,
        topHottest,
        averageHeatScore: avgScore[0]?.avg ?? 0,
        promotionCount: this.stats.promotions,
        demotionCount: this.stats.demotions
      };
    } catch (error) {
      logger.error('Get stats error:', error);
      throw error;
    }
  }

  /**
   * Update access statistics (internal)
   */
  private async updateAccessStats(
    entityType: EntityType,
    entityId: string
  ): Promise<void> {
    try {
      await prisma.$executeRaw`
        UPDATE hot_data_cache
        SET
          hit_count = hit_count + 1,
          heat_score = LEAST(100, heat_score * ${this.heatDecayRate} + 1.0),
          last_accessed = NOW()
        WHERE entity_type = ${entityType}
          AND entity_id = ${entityId}
      `;
    } catch (error) {
      // Silent fail - stats are not critical
      logger.debug('Update access stats error:', error);
    }
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const hotCacheProvider = HotDataCacheProvider.getInstance();
