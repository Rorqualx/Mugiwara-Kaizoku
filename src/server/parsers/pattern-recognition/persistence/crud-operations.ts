/**
 * Pattern CRUD Operations
 *
 * Database create, read, update, delete operations for patterns.
 * All functions accept cache Map as parameter for state coordination.
 *
 * Extracted from: DatabasePatternStore.ts (lines 61-228, 367-395, 463-484)
 */

import { logger } from '@/server/utils/logger';

import type { dbPatternToPattern as _dbPatternToPattern, toPrismaJson as _toPrismaJson, patternFeaturesToVector as _patternFeaturesToVector } from './converters';
import type { Pattern, PatternVariation as _PatternVariation } from '../types';
import type { PrismaClient, Prisma as _Prisma } from '@prisma/client';

/**
 * Save pattern to database
 *
 * Persists a pattern to the database using upsert semantics (insert or update).
 * Falls back to cache-only storage if database models are not available.
 *
 * @param prisma - Prisma client instance
 * @param pattern - Pattern to save
 * @param cache - Pattern cache for fallback storage
 */
export async function savePattern(
  prisma: PrismaClient,
  pattern: Pattern,
  cache: Map<string, Pattern>
): Promise<void> {
  // TODO: Add ML models to schema (see Agent 2 report from Wave 1)
  logger.warn('ML pattern recognition disabled - learnedPattern model not in schema');
  logger.debug('Pattern would be saved:', { patternId: pattern["id"], type: pattern.type });

  // Fallback: Store in memory cache only
  cache.set(pattern["id"], pattern);

  return Promise.resolve();

  /* Disabled until ML models added to schema:
  try {
    // Convert pattern to database format
    // Cast pattern to record to access extended properties
    const extPattern = pattern as Record<string, unknown>;
    const dbPattern = await prisma.learnedPattern.upsert({
      where: { id: pattern["id"] },
      update: {
        category: (extPattern.category as string | undefined) ?? pattern.type,
        signature: toPrismaJson(extPattern.signature),
        selectors: (extPattern.selectors as string[] | undefined) ?? [pattern.selector],
        features: toPrismaJson(pattern.features),
        featureVector: patternFeaturesToVector(pattern.features),
        confidence: pattern.confidence,
        accuracy: pattern.accuracy ?? 0,
        usageCount: pattern.usageCount ?? 0,
        successCount: (extPattern.successCount as number | undefined) ?? 0,
        failureCount: (extPattern.failureCount as number | undefined) ?? 0,
        lastSeen: (extPattern.lastSeen as Date | undefined) ?? pattern.lastUsed ?? new Date(),
        version: (extPattern.version as number | undefined) ?? 1,
        sourceUrls: (extPattern["source"] as string[] | undefined) ?? [],
        metadata: toPrismaJson(extPattern["metadata"] ?? {}),
        isActive: true,
        updatedAt: new Date()
      },
      create: {
        id: pattern["id"],
        category: (extPattern.category as string | undefined) ?? pattern.type,
        signature: toPrismaJson(extPattern.signature),
        selectors: (extPattern.selectors as string[] | undefined) ?? [pattern.selector],
        features: toPrismaJson(pattern.features),
        featureVector: patternFeaturesToVector(pattern.features),
        confidence: pattern.confidence,
        accuracy: pattern.accuracy ?? 0,
        usageCount: pattern.usageCount ?? 0,
        successCount: (extPattern.successCount as number | undefined) ?? 0,
        failureCount: (extPattern.failureCount as number | undefined) ?? 0,
        lastSeen: (extPattern.lastSeen as Date | undefined) ?? pattern.lastUsed ?? new Date(),
        version: (extPattern.version as number | undefined) ?? 1,
        sourceUrls: (extPattern["source"] as string[] | undefined) ?? [],
        metadata: toPrismaJson(extPattern["metadata"] ?? {}),
        isActive: true
      }
    });

    // Save variations if present
    const patternExt = pattern as Record<string, unknown>;
    const patternMetadata = pattern["metadata"] as Record<string, unknown> | undefined;
    const variations = (patternExt.variations as PatternVariation[] | undefined) ?? (patternMetadata?.["variations"] as PatternVariation[] | undefined);
    if (variations && variations.length > 0) {
      await saveVariations(prisma, pattern["id"], variations);
    }

    // Update cache
    cache.set(pattern["id"], pattern);
  } catch (error: unknown) {
    logger.error('Error saving pattern to database', { error });
    throw error;
  }
  */
}

/**
 * Load all active patterns from database
 *
 * Retrieves all active patterns with their variations and performance metrics.
 * Falls back to returning cached patterns if database models are unavailable.
 *
 * @param prisma - Prisma client instance
 * @param cache - Pattern cache for fallback storage
 * @returns Array of patterns
 */
export async function loadPatterns(
  prisma: PrismaClient,
  cache: Map<string, Pattern>
): Promise<Pattern[]> {
  // TODO: Add ML models to schema (see Agent 2 report from Wave 1)
  logger.warn('ML pattern recognition disabled - learnedPattern model not in schema');

  // Fallback: Return cached patterns only
  return Promise.resolve(Array.from(cache.values()));

  /* Disabled until ML models added to schema:
  try {
    const dbPatterns = await prisma.learnedPattern.findMany({
      where: { isActive: true },
      include: {
        variations: true,
        performance: {
          orderBy: { timestamp: 'desc' },
          take: 10
        }
      }
    });

    return dbPatterns.map((dbp: typeof dbPatterns[number]) => dbPatternToPattern(dbp));
  } catch (error: unknown) {
    logger.error('Error loading patterns from database', { error });
    return [];
  }
  */
}

/**
 * Get pattern by ID (checks cache first)
 *
 * Retrieves a specific pattern by ID, checking the cache first for performance.
 * Falls back to cache-only lookup if database models are unavailable.
 *
 * @param prisma - Prisma client instance
 * @param id - Pattern ID
 * @param cache - Pattern cache
 * @returns Pattern if found, null otherwise
 */
export async function getPattern(
  prisma: PrismaClient,
  id: string,
  cache: Map<string, Pattern>
): Promise<Pattern | null> {
  // TODO: Add ML models to schema (see Agent 2 report from Wave 1)
  // Fallback: Check cache only
  return Promise.resolve(cache.get(id) ?? null);

  /* Disabled until ML models added to schema:
  // Check cache first
  if (cache.has(id)) {
    return cache.get(id)!;
  }

  try {
    const dbPattern = await prisma.learnedPattern.findUnique({
      where: { id },
      include: {
        variations: true,
        performance: {
          orderBy: { timestamp: 'desc' },
          take: 10
        }
      }
    });

    if (!dbPattern) return null;

    const pattern = dbPatternToPattern(dbPattern);
    cache.set(id, pattern);
    return pattern;
  } catch (error: unknown) {
    logger.error('Error getting pattern from database', { error });
    return null;
  }
  */
}

/**
 * Delete pattern from database and cache
 *
 * Removes a pattern from both the database and cache.
 * Falls back to cache-only deletion if database models are unavailable.
 *
 * @param prisma - Prisma client instance
 * @param id - Pattern ID to delete
 * @param cache - Pattern cache
 */
export async function deletePattern(
  prisma: PrismaClient,
  id: string,
  cache: Map<string, Pattern>
): Promise<void> {
  // TODO: Add ML models to schema (see Agent 2 report from Wave 1)
  logger.warn('ML pattern recognition disabled - learnedPattern model not in schema');

  // Fallback: Remove from cache only
  cache.delete(id);

  return Promise.resolve();

  /* Disabled until ML models added to schema:
  try {
    await prisma.learnedPattern.delete({
      where: { id }
    });
    cache.delete(id);
  } catch (error: unknown) {
    logger.error('Error deleting pattern', { error });
    throw error;
  }
  */
}

/**
 * Warm cache with frequently used patterns
 *
 * Preloads the most frequently used patterns into the cache for improved performance.
 * Loads top 100 patterns sorted by usage count and confidence.
 *
 * NOTE: Currently a no-op until ML models are added to schema.prisma.
 * Will be reactivated when learnedPattern model is available.
 *
 * @param _prisma - Prisma client instance (unused until ML models added)
 * @param _cache - Pattern cache to populate (unused until ML models added)
 */
export function warmCache(
  _prisma: PrismaClient,
  _cache: Map<string, Pattern>
): Promise<void> {
  try {
    // TODO: Reactivate when ML models added to schema
    // FIX Line 465: Add type assertion for unsafe assignment
    // const topPatterns = await (prisma as PrismaClient).learnedPattern.findMany({
    //   where: { isActive: true },
    //   orderBy: [
    //     { usageCount: 'desc' },
    //     { confidence: 'desc' }
    //   ],
    //   take: 100,
    //   include: {
    //     variations: true
    //   }
    // });

    // for (const dbPattern of topPatterns) {
    //   const pattern = dbPatternToPattern(dbPattern);
    //   cache.set(pattern["id"], pattern);
    // }
    return Promise.resolve();
  } catch (error: unknown) {
    logger.error('Error warming cache', { error });
    return Promise.resolve();
  }
}
