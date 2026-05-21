/**
 * Database Pattern Store
 *
 * Production-grade database persistence layer for pattern recognition.
 * Orchestrates pattern CRUD, search, and metrics operations via specialized modules.
 *
 * Architecture:
 * - converters.ts - Type conversions (220 lines)
 * - vector-utils.ts - Vector similarity (65 lines)
 * - crud-operations.ts - CRUD ops (311 lines)
 * - search-operations.ts - Search ops (115 lines)
 * - metrics-operations.ts - Metrics ops (181 lines)
 *
 * Total: 722 lines → 892 lines across 6 modules (improved maintainability)
 *
 * NOTE: ML models (learnedPattern, patternVariation, patternPerformance) are disabled.
 * See Phase 1 documentation for implementation requirements.
 */

import { prisma as sharedPrisma } from '@/server/db';
import { logger } from '@/utils/logger';

// Import extracted modules
import {
  savePattern as savePat,
  loadPatterns as loadPats,
  getPattern as getPat,
  deletePattern as deletePat
} from './crud-operations';
import {
  updatePatternMetrics as updateMetrics,
  getStatistics as getStats
} from './metrics-operations';
import {
  findByCategory as findByCat,
  findSimilarPatterns as findSimilar
} from './search-operations';

import type {
  Pattern,
  PatternMetrics
} from '../types';
import type { PrismaClient } from '@prisma/client';

/**
 * Database Pattern Store
 *
 * Main orchestrator class for pattern persistence operations.
 * Delegates to specialized modules for actual implementation.
 */
export class DatabasePatternStore {
  private prisma: PrismaClient;
  private cache: Map<string, Pattern> = new Map();

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma ?? sharedPrisma;
  }

  /**
   * Initialize the store
   */
  async initialize(): Promise<void> {
    await this.prisma.$connect();

    logger.warn('ML pattern recognition disabled - learnedPattern, packDownload, and mLModelWeight models not in schema');
    logger.info('Pattern store initialized in read-only mode with fallback behavior');

    // Warm cache with frequently used patterns (disabled until models added)
    // await warm(this.prisma, this.cache);
  }

  /**
   * Save a pattern to database
   */
  async savePattern(pattern: Pattern): Promise<void> {
    return savePat(this.prisma, pattern, this.cache);
  }

  /**
   * Load all patterns from database
   */
  async loadPatterns(): Promise<Pattern[]> {
    return loadPats(this.prisma, this.cache);
  }

  /**
   * Get pattern by ID
   */
  async getPattern(id: string): Promise<Pattern | null> {
    return getPat(this.prisma, id, this.cache);
  }

  /**
   * Delete a pattern
   */
  async deletePattern(id: string): Promise<void> {
    return deletePat(this.prisma, id, this.cache);
  }

  /**
   * Find patterns by category
   */
  async findByCategory(category: string): Promise<Pattern[]> {
    return findByCat(this.prisma, category, this.cache);
  }

  /**
   * Find similar patterns using vector similarity
   */
  findSimilarPatterns(
    featureVector: number[],
    limit: number = 10
  ): Pattern[] {
    return findSimilar(this.prisma, featureVector, this.cache, limit);
  }

  /**
   * Update pattern metrics
   */
  async updatePatternMetrics(
    id: string,
    metrics: Partial<PatternMetrics>
  ): Promise<void> {
    return updateMetrics(this.prisma, id, metrics, this.cache);
  }

  /**
   * Get pattern statistics
   */
  async getStatistics(): Promise<unknown> {
    return getStats(this.prisma, this.cache);
  }

  /**
   * Cleanup old data
   */
  cleanup(): void {
    logger.warn('ML pattern recognition disabled - cleanup skipped');
    this.cache.clear();
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
