/**
 * Pattern Search Operations
 *
 * Search and query operations for pattern matching and similarity.
 * Includes category-based search and vector similarity search.
 *
 * Extracted from: DatabasePatternStore.ts (lines 230-290)
 */

import { logger } from '@/utils/logger';

import { patternFeaturesToVector } from './converters';
import { cosineSimilarity } from './vector-utils';

import type { Pattern } from '../types';
import type { PrismaClient } from '@prisma/client';

/**
 * Find patterns by category
 *
 * Returns all active patterns matching the specified category,
 * ordered by confidence and usage count.
 *
 * NOTE: This function currently uses in-memory cache fallback because
 * ML models (learnedPattern) are not yet added to schema.prisma.
 * See Agent 2 report from Wave 1 for implementation requirements.
 *
 * @param prisma - Prisma client instance
 * @param category - Pattern category to search for
 * @param cache - Cache Map for storing results
 * @returns Array of matching patterns
 */
export async function findByCategory(
  prisma: PrismaClient,
  category: string,
  cache: Map<string, Pattern>
): Promise<Pattern[]> {
  // TODO: Add ML models to schema (see Agent 2 report from Wave 1)
  logger.warn('ML pattern recognition disabled - learnedPattern model not in schema');

  // Fallback: Filter cached patterns by type
  return Promise.resolve(Array.from(cache.values()).filter(p => p.type === category));

  /* Disabled until ML models added to schema:
  try {
    const dbPatterns = await prisma.learnedPattern.findMany({
      where: {
        category,
        isActive: true
      },
      include: {
        variations: true
      },
      orderBy: [
        { confidence: 'desc' },
        { usageCount: 'desc' }
      ]
    });

    return dbPatterns.map((dbp: typeof dbPatterns[number]) => dbPatternToPattern(dbp));
  } catch (error: unknown) {
    logger.error('Error finding patterns by category', { error, category });
    return [];
  }
  */
}

/**
 * Find similar patterns using vector similarity
 *
 * Uses cosine similarity to find patterns with similar feature vectors.
 * Returns patterns sorted by similarity score (highest first).
 *
 * NOTE: Uses in-memory cosine similarity calculation. In production,
 * this should use pgvector for efficient similarity search.
 *
 * NOTE: This function is currently synchronous (operates on cache only).
 * The async signature is maintained for future database integration.
 *
 * @param prisma - Prisma client instance (unused in current implementation)
 * @param featureVector - Feature vector to compare against
 * @param cache - Cache Map for loading patterns
 * @param limit - Maximum number of results (default: 10)
 * @returns Array of similar patterns, sorted by similarity
 */
export function findSimilarPatterns(
  prisma: PrismaClient,
  featureVector: number[],
  cache: Map<string, Pattern>,
  limit: number = 10
): Pattern[] {
  try {
    // Load all patterns from cache
    // NOTE: In the current implementation, we use cache directly to avoid circular dependency
    // When loadPatterns() is extracted, we can import it here
    const allPatterns = Array.from(cache.values());

    // Calculate similarity scores
    const similarities = allPatterns.map((pattern) => ({
      pattern,
      similarity: cosineSimilarity(
        featureVector,
        patternFeaturesToVector(pattern.features)
      )
    }));

    // Sort by similarity (descending)
    similarities.sort((a, b) => b.similarity - a.similarity);

    // Return top N
    return similarities.slice(0, limit).map((s) => s.pattern);
  } catch (error: unknown) {
    logger.error('Error finding similar patterns', {
      error,
      vectorLength: featureVector.length,
      limit
    });
    return [];
  }
}
