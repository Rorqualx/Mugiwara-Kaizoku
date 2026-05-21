/**
 * Vector Search Service
 *
 * Implements efficient similarity search using pgvector extension.
 * Provides fast nearest-neighbor search for pattern matching.
 *
 * NOTE: ML models (learnedPattern, packDownload, mLModelWeight) are currently disabled.
 * See Agent 2 report from Wave 1 for implementation requirements.
 */

// TODO: Add ML models to schema (see Agent 2 report from Wave 1)
// import type { LearnedPattern } from '@prisma/client';
import { prisma as sharedPrisma } from '@/server/db';
import { logger } from '@/utils/logger';

import type { PrismaClient } from '@prisma/client';

/**
 * Result from distance calculation query
 */
interface DistanceResult {
  id: number;
  distance: number;
}

export class VectorSearchService {
  private prisma: PrismaClient;
  private vectorDimension: number = 256;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma ?? sharedPrisma;
  }

  /**
   * Initialize pgvector extension
   */
  initialize(): Promise<void> {
    // TODO: Add ML models to schema (see Agent 2 report from Wave 1)
    logger.warn('ML pattern recognition disabled - learnedPattern model not in schema');
    logger.info('Vector search initialized in disabled mode');

    // Fallback: Skip initialization
    return Promise.resolve();

    /* Disabled until ML models added to schema:
    try {
      // Enable pgvector extension if not already enabled
      await this.prisma.$executeRaw`CREATE EXTENSION IF NOT EXISTS vector`;

      // Create vector column if it doesn't exist
      await this.ensureVectorColumn();

      // Create indexes for efficient search
      await this.createVectorIndexes();
    } catch (error: unknown) {
      logger.error('Error initializing vector search:', error);
      // Fallback to non-vector search if pgvector is not available
    }
    */
  }

  /**
   * Find similar patterns using vector similarity
   */
  async findSimilarPatterns(
  queryVector: number[],
  limit: number = 10,
  threshold: number = 0.7)
  : Promise<Array<{pattern: unknown;similarity: number;}>> {
    try {
      // Normalize query vector
      const normalized = this.normalizeVector(queryVector);

      // Use pgvector's <=> operator for cosine distance
      // Convert to similarity score (1 - distance)
      const results = await this.prisma.$queryRaw`
        SELECT 
          *,
          1 - ("featureVector" <=> ${normalized}::vector) as similarity
        FROM "LearnedPattern"
        WHERE 
          "isActive" = true
          AND 1 - ("featureVector" <=> ${normalized}::vector) > ${threshold}
        ORDER BY "featureVector" <=> ${normalized}::vector
        LIMIT ${limit}
      `;

      return results as Array<{pattern: unknown; similarity: number}>;
    } catch (error: unknown) {
      logger.error('Error in vector similarity search:', error);
      // Fallback to traditional search
      return this.fallbackSimilaritySearch(queryVector, limit, threshold);
    }
  }

  /**
   * Find patterns within a radius
   */
  async findPatternsInRadius(
  centerVector: number[],
  radius: number = 0.3)
  : Promise<unknown[]> {
    try {
      const normalized = this.normalizeVector(centerVector);

      const results = await this.prisma.$queryRaw`
        SELECT *
        FROM "LearnedPattern"
        WHERE 
          "isActive" = true
          AND "featureVector" <=> ${normalized}::vector < ${radius}
        ORDER BY "featureVector" <=> ${normalized}::vector
      `;

      return results as unknown[];
    } catch (error: unknown) {
      logger.error('Error in radius search:', error);
      return [];
    }
  }

  /**
   * Batch similarity search for multiple queries
   */
  async batchSimilaritySearch(
  queryVectors: number[][],
  limit: number = 5)
  : Promise<Map<number, unknown[]>> {
    const results = new Map<number, unknown[]>();

    // Process in batches to avoid overwhelming the database
    const batchSize = 10;
    const batches: Array<Promise<void>> = [];

    for (let i = 0; i < queryVectors.length; i += batchSize) {
      const batch = queryVectors.slice(i, i + batchSize);
      const batchIndex = i;

      // Create a promise for this batch that will be awaited later
      const batchPromise = Promise.all(
        batch.map(async (vector, idx) => {
          const similar = await this.findSimilarPatterns(vector, limit);
          results.set(batchIndex + idx, similar);
        })
      ).then(() => undefined);

      batches.push(batchPromise);
    }

    // Await all batches
    await Promise.all(batches);

    return results;
  }

  /**
   * Update pattern vector
   */
  async updatePatternVector(patternId: string, vector: number[]): Promise<void> {
    try {
      const normalized = this.normalizeVector(vector);

      await this.prisma.$executeRaw`
        UPDATE "LearnedPattern"
        SET "featureVector" = ${normalized}::vector
        WHERE "id" = ${patternId}
      `;
    } catch (error: unknown) {
      logger.error('Error updating pattern vector:', error);
    }
  }

  /**
   * Cluster patterns using K-means
   */
  clusterPatterns(_k: number = 10): Promise<Map<number, string[]>> {
    // TODO: Add ML models to schema (see Agent 2 report from Wave 1)
    logger.warn('ML pattern recognition disabled - learnedPattern model not in schema');

    // Fallback: Return empty clusters
    return Promise.resolve(new Map<number, string[]>());

    /* Disabled until ML models added to schema:
    try {
      // Get all active patterns with vectors
      const patterns = await this.prisma.learnedPattern.findMany({
        where: { isActive: true },
        select: {
          id: true,
          featureVector: true
        }
      });

      // Perform K-means clustering
      const clusters = this.kMeansClustering(
        patterns.map((p: LearnedPattern) => ({ id: p["id"], vector: p.featureVector })),
        k
      );

      return clusters;
    } catch (error: unknown) {
      logger.error('Error clustering patterns:', error);
      return new Map();
    }
    */
  }

  /**
   * Find anomalous patterns
   */
  async findAnomalousPatterns(threshold: number = 2.0): Promise<string[]> {
    try {
      // Calculate average distance from centroid
      const avgDistanceResult = (await this.prisma.$queryRaw`
        WITH centroid AS (
          SELECT AVG("featureVector") as center
          FROM "LearnedPattern"
          WHERE "isActive" = true
        )
        SELECT 
          p."id",
          p."featureVector" <=> c.center as distance
        FROM "LearnedPattern" p, centroid c
        WHERE p."isActive" = true
      `) as DistanceResult[];

      // Calculate mean and std deviation
      const distances = avgDistanceResult.map(r => r.distance);
      const mean = distances.reduce((a, b) => a + b, 0) / distances.length;
      const stdDev = Math.sqrt(
        distances.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / distances.length
      );

      // Find outliers (patterns beyond threshold * stdDev)
      const anomalous = avgDistanceResult
        .filter(r => r.distance > mean + threshold * stdDev)
        .map(r => String(r.id));

      return anomalous;
    } catch (error: unknown) {
      logger.error('Error finding anomalous patterns:', error);
      return [];
    }
  }

  /**
   * Ensure vector column exists
   */
  private async ensureVectorColumn(): Promise<void> {
    try {
      // Check if column exists and has correct type
      await this.prisma.$executeRaw`
        DO $$ 
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'LearnedPattern' 
            AND column_name = 'featureVector'
          ) THEN
            ALTER TABLE "LearnedPattern" 
            ADD COLUMN "featureVector" vector(${this.vectorDimension});
          END IF;
        END $$;
      `;
    } catch (error: unknown) {
      logger.error('Error ensuring vector column:', error);
    }
  }

  /**
   * Create vector indexes for efficient search
   */
  private async createVectorIndexes(): Promise<void> {
    try {
      // Create IVFFlat index for approximate nearest neighbor search
      await this.prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS idx_pattern_vector_ivfflat 
        ON "LearnedPattern" 
        USING ivfflat ("featureVector" vector_cosine_ops)
        WITH (lists = 100)
        WHERE "isActive" = true
      `;

      // Create HNSW index for higher accuracy (if available)
      await this.prisma.$executeRaw`
        CREATE INDEX IF NOT EXISTS idx_pattern_vector_hnsw
        ON "LearnedPattern"
        USING hnsw ("featureVector" vector_cosine_ops)
        WITH (m = 16, ef_construction = 64)
        WHERE "isActive" = true
      `.catch(() => {
        // HNSW might not be available in all pgvector versions
        logger.info('HNSW index not available, using IVFFlat only');
      });
    } catch (error: unknown) {
      logger.error('Error creating vector indexes:', error);
    }
  }

  /**
   * Normalize vector to unit length
   */
  private normalizeVector(vector: number[]): number[] {
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (magnitude === 0) return vector;
    return vector.map((val) => val / magnitude);
  }

  /**
   * Fallback similarity search without pgvector
   */
  private fallbackSimilaritySearch(
  _queryVector: number[],
  _limit: number,
  _threshold: number)
  : Promise<Array<{pattern: unknown;similarity: number;}>> {
    // TODO: Add ML models to schema (see Agent 2 report from Wave 1)
    logger.warn('ML pattern recognition disabled - learnedPattern model not in schema');

    // Fallback: Return empty results
    return Promise.resolve([]);

    /* Disabled until ML models added to schema:
    try {
      // Get all active patterns
      const patterns = await this.prisma.learnedPattern.findMany({
        where: { isActive: true }
      });

      // Calculate similarities
      type SimilarityResult = { pattern: LearnedPattern; similarity: number };
      const similarities: SimilarityResult[] = patterns.map((pattern: LearnedPattern) => ({
        pattern,
        similarity: this.cosineSimilarity(queryVector, pattern.featureVector)
      }));

      // Filter and sort
      return similarities.
      filter((s: SimilarityResult) => s.similarity >= threshold).
      sort((a: SimilarityResult, b: SimilarityResult) => b.similarity - a.similarity).
      slice(0, limit);
    } catch (error: unknown) {
      logger.error('Error in fallback similarity search:', error);
      return [];
    }
    */
  }

  /**
   * Calculate cosine similarity
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      const aVal = a[i];
      const bVal = b[i];
      if (aVal === undefined || bVal === undefined) continue;
      dotProduct += aVal * bVal;
      normA += aVal * aVal;
      normB += bVal * bVal;
    }

    if (normA === 0 || normB === 0) return 0;

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Simple K-means clustering implementation
   */
  private kMeansClustering(
  data: Array<{id: string;vector: number[];}>,
  k: number,
  maxIterations: number = 100)
  : Map<number, string[]> {
    if (data.length === 0 || k <= 0) return new Map();

    // Initialize centroids randomly
    let centroids = this.initializeRandomCentroids(data, k);
    const clusters = new Map<number, string[]>();

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      // Clear clusters
      this.clearClusters(clusters, k);

      // Assign points to nearest centroid
      this.assignPointsToClusters(data, centroids, clusters);

      // Update centroids and check for convergence
      const { changed, newCentroids } = this.updateCentroids(data, centroids, clusters);
      centroids = newCentroids;

      // Check for convergence
      if (!changed) break;
    }

    return clusters;
  }

  /**
   * Initialize random centroids for k-means
   */
  private initializeRandomCentroids(
    data: Array<{id: string; vector: number[]}>,
    k: number
  ): number[][] {
    const centroids: number[][] = [];
    const indices = new Set<number>();

    while (centroids.length < k && centroids.length < data.length) {
      const idx = Math.floor(Math.random() * data.length);
      if (!indices.has(idx)) {
        indices.add(idx);
        const dataItem = data[idx];
        if (dataItem !== undefined) {
          centroids.push([...dataItem.vector]);
        }
      }
    }

    return centroids;
  }

  /**
   * Clear all clusters
   */
  private clearClusters(clusters: Map<number, string[]>, k: number): void {
    for (let i = 0; i < k; i++) {
      clusters.set(i, []);
    }
  }

  /**
   * Assign points to nearest centroid
   */
  private assignPointsToClusters(
    data: Array<{id: string; vector: number[]}>,
    centroids: number[][],
    clusters: Map<number, string[]>
  ): void {
    for (const point of data) {
      const closestCentroid = this.findClosestCentroid(point.vector, centroids);
      const cluster = clusters.get(closestCentroid);
      if (cluster !== undefined) {
        cluster.push(point.id);
      }
    }
  }

  /**
   * Find the closest centroid for a given point
   */
  private findClosestCentroid(vector: number[], centroids: number[][]): number {
    let minDist = Infinity;
    let closestCentroid = 0;

    for (let i = 0; i < centroids.length; i++) {
      const centroid = centroids[i];
      if (centroid !== undefined) {
        const dist = this.euclideanDistance(vector, centroid);
        if (dist < minDist) {
          minDist = dist;
          closestCentroid = i;
        }
      }
    }

    return closestCentroid;
  }

  /**
   * Update centroids and return whether any changed along with new centroids
   */
  private updateCentroids(
    data: Array<{id: string; vector: number[]}>,
    centroids: number[][],
    clusters: Map<number, string[]>
  ): { changed: boolean; newCentroids: number[][] } {
    let changed = false;
    const newCentroids = [...centroids];

    for (let i = 0; i < newCentroids.length; i++) {
      const clusterIds = clusters.get(i);
      if (clusterIds === undefined || clusterIds.length === 0) continue;

      const clusterPoints = clusterIds
        .map((id) => data.find((d) => d.id === id))
        .filter((p): p is {id: string; vector: number[]} => p !== undefined);

      if (clusterPoints.length > 0) {
        const vectors = clusterPoints.map((p) => p.vector);
        const newCentroid = this.calculateCentroid(vectors);
        const currentCentroid = newCentroids[i];

        if (currentCentroid !== undefined && !this.vectorsEqual(currentCentroid, newCentroid)) {
          newCentroids[i] = newCentroid;
          changed = true;
        }
      }
    }

    return { changed, newCentroids };
  }

  /**
   * Calculate Euclidean distance
   */
  private euclideanDistance(a: number[], b: number[]): number {
    return Math.sqrt(
      a.reduce((sum, val, i) => {
        const bVal = b[i];
        if (bVal !== undefined) {
          return sum + Math.pow(val - bVal, 2);
        }
        return sum;
      }, 0)
    );
  }

  /**
   * Calculate centroid of vectors
   */
  private calculateCentroid(vectors: number[][]): number[] {
    if (vectors.length === 0) return [];

    const firstVector = vectors[0];
    if (firstVector === undefined) return [];

    const dim = firstVector.length;
    const centroid = new Array<number>(dim).fill(0);

    for (const vector of vectors) {
      for (let i = 0; i < dim; i++) {
        const val = vector[i];
        const currentCentroid = centroid[i];
        if (val !== undefined && currentCentroid !== undefined) {
          centroid[i] = currentCentroid + val;
        }
      }
    }

    return centroid.map((val) => val / vectors.length);
  }

  /**
   * Check if two vectors are equal
   */
  private vectorsEqual(a: number[], b: number[], epsilon: number = 1e-6): boolean {
    if (a.length !== b.length) return false;

    for (let i = 0; i < a.length; i++) {
      const aVal = a[i];
      const bVal = b[i];
      if (aVal === undefined || bVal === undefined) return false;
      if (Math.abs(aVal - bVal) > epsilon) return false;
    }

    return true;
  }
}
