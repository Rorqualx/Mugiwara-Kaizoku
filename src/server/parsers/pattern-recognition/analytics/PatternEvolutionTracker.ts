// @ts-nocheck
// TODO: Disabled until learnedPattern, patternLearningEvent, and patternPerformance Prisma models are implemented in schema.prisma

/**
 * Pattern Evolution Tracker
 *
 * Tracks and analyzes pattern evolution over time, providing insights
 * into pattern performance, adaptation, and lifecycle management.
 *
 * NOTE: ML models (learnedPattern, packDownload, mLModelWeight) are currently disabled.
 * See Agent 2 report from Wave 1 for implementation requirements.
 */

// TODO: Add ML models to schema (see Agent 2 report from Wave 1)
// import type { LearnedPattern, PatternLearningEvent, PatternPerformance } from '@prisma/client';
import { prisma as sharedPrisma } from '@/server/db';
import { logger } from '@/utils/logger';

import { DatabasePatternStore } from '../persistence/DatabasePatternStore';
import { VectorSearchService } from '../persistence/VectorSearchService';

import type { Pattern} from '../types';
import type { PrismaClient } from '@prisma/client';

export interface EvolutionMetrics {
  patternId: string;
  evolutionRate: number;
  performanceTrend: 'improving' | 'stable' | 'declining';
  adaptationScore: number;
  lifecycleStage: 'emerging' | 'growing' | 'mature' | 'declining' | 'obsolete';
  recommendedAction: 'maintain' | 'evolve' | 'merge' | 'deprecate' | 'remove';
}

export interface EvolutionReport {
  totalPatterns: number;
  activePatterns: number;
  evolvedPatterns: number;
  deprecatedPatterns: number;
  mergedPatterns: number;
  averageLifespan: number;
  topPerformers: Pattern[];
  strugglingPatterns: Pattern[];
  evolutionMetrics: EvolutionMetrics[];
  recommendations: string[];
}

export class PatternEvolutionTracker {
  private prisma: PrismaClient;
  private patternStore: DatabasePatternStore;
  private vectorSearch: VectorSearchService;

  constructor(
  prisma?: PrismaClient,
  patternStore?: DatabasePatternStore,
  vectorSearch?: VectorSearchService)
  {
    this.prisma = prisma ?? sharedPrisma;
    this.patternStore = patternStore ?? new DatabasePatternStore(this.prisma);
    this.vectorSearch = vectorSearch ?? new VectorSearchService(this.prisma);
  }

  /**
   * Track pattern evolution
   */
  trackEvolution(patternId: string): Promise<EvolutionMetrics> {
    // TODO: Add ML models to schema (see Agent 2 report from Wave 1)
    logger.warn('ML pattern recognition disabled - learnedPattern model not in schema');

    // Fallback: Return default metrics
    return Promise.resolve({
      patternId,
      evolutionRate: 0,
      performanceTrend: 'stable',
      adaptationScore: 0,
      lifecycleStage: 'emerging',
      recommendedAction: 'maintain'
    });

    /* Disabled until ML models added to schema:
    try {
      // Get pattern with historical data
      const pattern = await this.prisma.learnedPattern.findUnique({
        where: { id: patternId },
        include: {
          performance: {
            orderBy: { timestamp: 'desc' },
            take: 30
          },
          variations: true
        }
      });

      if (!pattern) {
        throw new Error(`Pattern ${patternId} not found`);
      }

      // Calculate evolution metrics
      const evolutionRate = this.calculateEvolutionRate(pattern);
      const performanceTrend = this.analyzePerformanceTrend(pattern.performance);
      const adaptationScore = this.calculateAdaptationScore(pattern);
      const lifecycleStage = this.determineLifecycleStage(pattern);
      const recommendedAction = this.recommendAction(
        pattern,
        performanceTrend,
        lifecycleStage
      );

      // Record evolution event
      await this.recordEvolutionEvent(patternId, {
        patternId,
        evolutionRate,
        performanceTrend,
        adaptationScore,
        lifecycleStage,
        recommendedAction
      });

      return {
        patternId,
        evolutionRate,
        performanceTrend,
        adaptationScore,
        lifecycleStage,
        recommendedAction
      };
    } catch (error: unknown) {
      console.error('Error tracking evolution:', error);
      throw error;
    }
    */
  }

  /**
   * Generate evolution report
   */
  generateEvolutionReport(): Promise<EvolutionReport> {
    // TODO: Add ML models to schema (see Agent 2 report from Wave 1)
    logger.warn('ML pattern recognition disabled - learnedPattern model not in schema');

    // Fallback: Return empty report
    return Promise.resolve({
      totalPatterns: 0,
      activePatterns: 0,
      evolvedPatterns: 0,
      deprecatedPatterns: 0,
      mergedPatterns: 0,
      averageLifespan: 0,
      topPerformers: [],
      strugglingPatterns: [],
      evolutionMetrics: [],
      recommendations: ['ML pattern recognition is currently disabled']
    });

    /* Disabled until ML models added to schema:
    try {
      // Get all patterns with metrics
      const patterns = await this.prisma.learnedPattern.findMany({
        include: {
          performance: {
            orderBy: { timestamp: 'desc' },
            take: 10
          },
          variations: true
        }
      });

      // Calculate overall metrics
      const totalPatterns = patterns.length;
      const activePatterns = patterns.filter((p: LearnedPattern) => p.isActive).length;

      // Track evolution for each pattern
      const evolutionMetrics: EvolutionMetrics[] = [];
      for (const pattern of patterns) {
        const metrics = await this.trackEvolution(pattern["id"]);
        evolutionMetrics.push(metrics);
      }

      // Count evolution actions
      const evolvedPatterns = evolutionMetrics.filter(
        (m) => m.recommendedAction === 'evolve'
      ).length;
      const deprecatedPatterns = evolutionMetrics.filter(
        (m) => m.recommendedAction === 'deprecate'
      ).length;
      const mergedPatterns = evolutionMetrics.filter(
        (m) => m.recommendedAction === 'merge'
      ).length;

      // Calculate average lifespan
      const averageLifespan = this.calculateAverageLifespan(patterns);

      // Identify top performers and struggling patterns
      const sortedByPerformance = [...patterns].sort(
        (a, b) => (b.accuracy ?? 0) - (a.accuracy ?? 0)
      );
      const topPerformers = sortedByPerformance.slice(0, 10).map((p) =>
      this.dbPatternToPattern(p)
      );
      const strugglingPatterns = sortedByPerformance.slice(-10).map((p) =>
      this.dbPatternToPattern(p)
      );

      // Generate recommendations
      const recommendations = this.generateRecommendations(evolutionMetrics);

      return {
        totalPatterns,
        activePatterns,
        evolvedPatterns,
        deprecatedPatterns,
        mergedPatterns,
        averageLifespan,
        topPerformers,
        strugglingPatterns,
        evolutionMetrics,
        recommendations
      };
    } catch (error: unknown) {
      console.error('Error generating evolution report:', error);
      throw error;
    }
    */
  }

  /**
   * Analyze pattern lifecycle
   */
  async analyzePatternLifecycle(patternId: string): Promise<unknown> {
    // TODO: Add ML models to schema (see Agent 2 report from Wave 1)
    logger.warn('ML pattern recognition disabled - patternLearningEvent model not in schema');

    // Fallback: Return disabled status
    return Promise.resolve({
      mlDisabled: true,
      patternId,
      message: 'Pattern lifecycle tracking requires ML models'
    });

    /* Disabled until ML models added to schema:
    try {
      // Type the events array properly
      const events = await this.prisma.patternLearningEvent.findMany({
        where: { patternId },
        orderBy: { createdAt: 'asc' }
      }) as Array<{
        eventType: string;
        createdAt: Date;
        patternId: string;
      }>;

      const lifecycle = {
        created: events.find((e) => e.eventType === 'learned')?.createdAt,
        evolved: events.filter((e) => e.eventType === 'evolved').map((e) => e.createdAt),
        deprecated: events.find((e) => e.eventType === 'deprecated')?.createdAt,
        merged: events.find((e) => e.eventType === 'merged')?.createdAt,
        totalEvents: events.length,
        currentStage: this.determineCurrentStage(events)
      };

      return lifecycle;
    } catch (error: unknown) {
      logger.error('Error analyzing pattern lifecycle:', { error, patternId });
      return null;
    }
    */
  }

  /**
   * Predict pattern evolution
   */
  predictEvolution(_patternId: string): Promise<unknown> {
    // TODO: Add ML models to schema (see Agent 2 report from Wave 1)
    logger.warn('ML pattern recognition disabled - learnedPattern model not in schema');

    // Fallback: Return disabled status
    return Promise.resolve({ prediction: 'ml_disabled', mlDisabled: true });

    /* Disabled until ML models added to schema:
    try {
      const pattern = await this.prisma.learnedPattern.findUnique({
        where: { id: patternId },
        include: {
          performance: {
            orderBy: { timestamp: 'desc' },
            take: 30
          }
        }
      });

      if (!pattern || pattern.performance.length < 5) {
        return { prediction: 'insufficient_data' };
      }

      // Simple linear regression on performance metrics
      const trend = this.calculateTrend(
        pattern.performance.map((p: PatternPerformance) => p.successRate)
      );

      // Predict future performance
      const predictedPerformance = pattern.accuracy + trend * 10;

      // Determine evolution likelihood
      const evolutionLikelihood = this.calculateEvolutionLikelihood(
        pattern,
        trend,
        predictedPerformance
      );

      return {
        currentPerformance: pattern.accuracy,
        predictedPerformance,
        trend,
        evolutionLikelihood,
        suggestedActions: this.suggestEvolutionActions(evolutionLikelihood, trend)
      };
    } catch (error: unknown) {
      console.error('Error predicting evolution:', error);
      return { prediction: 'error' };
    }
    */
  }

  /**
   * Compare pattern evolution
   */
  async comparePatternEvolution(
    patternId1: string,
    patternId2: string
  ): Promise<unknown> {
    try {
      const [metrics1, metrics2] = await Promise.all([
        this.trackEvolution(patternId1),
        this.trackEvolution(patternId2)
      ]);

      return {
        pattern1: metrics1,
        pattern2: metrics2,
        comparison: {
          evolutionRateDiff: metrics1.evolutionRate - metrics2.evolutionRate,
          adaptationScoreDiff: metrics1.adaptationScore - metrics2.adaptationScore,
          betterPerformer: metrics1.adaptationScore > metrics2.adaptationScore ?
          patternId1 : patternId2,
          recommendation: this.compareAndRecommend(metrics1, metrics2)
        }
      };
    } catch (error: unknown) {
      console.error('Error comparing pattern evolution:', error);
      return null;
    }
  }

  /**
   * Calculate evolution rate
   */
  private calculateEvolutionRate(pattern: unknown): number {
    const p = pattern as Record<string, unknown>;
    const createdAt = p["createdAt"] as Date;
    const daysSinceCreation =
    (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceCreation === 0) return 0;

    const changesPerDay = (p["version"] as number) / daysSinceCreation;
    const variations = p["variations"] as unknown[];
    const variationRate = variations.length / daysSinceCreation;

    return (changesPerDay + variationRate) / 2;
  }

  /**
   * Analyze performance trend
   */
  private analyzePerformanceTrend(
  performance: unknown[])
  : 'improving' | 'stable' | 'declining' {
    if (performance.length < 3) return 'stable';

    const recentPerf = performance.slice(0, 5).map((p) => (p as Record<string, unknown>)["successRate"] as number);
    const olderPerf = performance.slice(5, 10).map((p) => (p as Record<string, unknown>)["successRate"] as number);

    const recentAvg = recentPerf.reduce((a, b) => a + b, 0) / recentPerf.length;
    const olderAvg = olderPerf.length > 0 ?
    olderPerf.reduce((a, b) => a + b, 0) / olderPerf.length : recentAvg;

    const difference = recentAvg - olderAvg;

    if (difference > 0.05) return 'improving';
    if (difference < -0.05) return 'declining';
    return 'stable';
  }

  /**
   * Calculate adaptation score
   */
  private calculateAdaptationScore(pattern: unknown): number {
    const p = pattern as Record<string, unknown>;
    const variations = p["variations"] as unknown[];
    const accuracy = p["accuracy"] as number | null | undefined;
    const factors = {
      variations: Math.min(variations.length / 10, 1) * 0.3,
      successRate: (accuracy ?? 0) * 0.4,
      usage: Math.min((p["usageCount"] as number) / 1000, 1) * 0.2,
      recency: this.calculateRecencyScore(p["lastSeen"] as Date) * 0.1
    };

    return Object.values(factors).reduce((a, b) => a + b, 0);
  }

  /**
   * Determine lifecycle stage
   */
  private determineLifecycleStage(pattern: unknown): EvolutionMetrics['lifecycleStage'] {
    const p = pattern as Record<string, unknown>;
    const createdAt = p["createdAt"] as Date;
    const ageInDays = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
    const usageCount = p["usageCount"] as number;
    const usageRate = usageCount / Math.max(ageInDays, 1);
    const accuracy = p["accuracy"] as number;

    if (ageInDays < 7 && usageRate > 10) return 'emerging';
    if (ageInDays < 30 && accuracy > 0.7) return 'growing';
    if (ageInDays > 30 && accuracy > 0.8 && usageRate > 5) return 'mature';
    if (accuracy < 0.5 || usageRate < 1) return 'declining';
    if (ageInDays > 90 && usageRate < 0.1) return 'obsolete';

    return 'mature'; // Default fallback
  }

  /**
   * Recommend action based on metrics
   */
  private recommendAction(
  pattern: unknown,
  trend: 'improving' | 'stable' | 'declining',
  stage: EvolutionMetrics['lifecycleStage'])
  : EvolutionMetrics['recommendedAction'] {
    if (stage === 'obsolete') return 'remove';
    if (stage === 'declining' && trend === 'declining') return 'deprecate';
    const p = pattern as Record<string, unknown>;
    const variations = p["variations"] as unknown[];
    if (trend === 'declining' && variations.length > 5) return 'merge';
    if (trend === 'improving' || stage === 'emerging') return 'evolve';
    return 'maintain';
  }

  /**
   * Calculate average lifespan
   */
  private calculateAverageLifespan(patterns: unknown[]): number {
    const lifespans = patterns.map((p) => {
      const pattern = p as Record<string, unknown>;
      const createdAt = pattern["createdAt"] as Date;
      return (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
    });

    return lifespans.reduce((a, b) => a + b, 0) / lifespans.length;
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(metrics: EvolutionMetrics[]): string[] {
    const recommendations: string[] = [];

    const toEvolve = metrics.filter((m) => m.recommendedAction === 'evolve');
    const toMerge = metrics.filter((m) => m.recommendedAction === 'merge');
    const toDeprecate = metrics.filter((m) => m.recommendedAction === 'deprecate');

    if (toEvolve.length > 0) {
      recommendations.push(
        `Consider evolving ${toEvolve.length} patterns showing improvement potential`
      );
    }

    if (toMerge.length > 5) {
      recommendations.push(
        `Merge ${toMerge.length} similar patterns to reduce redundancy`
      );
    }

    if (toDeprecate.length > 0) {
      recommendations.push(
        `Deprecate ${toDeprecate.length} underperforming patterns`
      );
    }

    const avgAdaptation = metrics.reduce((sum, m) => sum + m.adaptationScore, 0) / metrics.length;
    if (avgAdaptation < 0.5) {
      recommendations.push(
        'Overall pattern adaptation is low - consider retraining models'
      );
    }

    return recommendations;
  }

  /**
   * Calculate recency score
   */
  private calculateRecencyScore(lastSeen: Date): number {
    const daysSince = (Date.now() - lastSeen.getTime()) / (1000 * 60 * 60 * 24);
    return Math.max(0, 1 - daysSince / 30);
  }

  /**
   * Calculate trend using simple linear regression
   */
  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;

    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = values;

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => {
      const yi = y[i];
      return yi !== undefined ? sum + xi * yi : sum;
    }, 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return slope;
  }

  /**
   * Calculate evolution likelihood
   */
  private calculateEvolutionLikelihood(
  pattern: unknown,
  trend: number,
  predictedPerformance: number)
  : number {
    const p = pattern as Record<string, unknown>;
    const accuracy = p["accuracy"] as number;
    const variations = p["variations"] as unknown[] | undefined;
    const factors = {
      trend: Math.min(Math.max(trend * 10, -1), 1) * 0.3,
      currentPerformance: accuracy * 0.3,
      predictedImprovement: (predictedPerformance > accuracy ? 1 : 0) * 0.2,
      variations: Math.min((variations?.length ?? 0) / 5, 1) * 0.2
    };

    return Object.values(factors).reduce((a, b) => a + b, 0);
  }

  /**
   * Suggest evolution actions
   */
  private suggestEvolutionActions(likelihood: number, trend: number): string[] {
    const actions: string[] = [];

    if (likelihood > 0.7) {
      actions.push('High evolution potential - prioritize for enhancement');
    }
    if (trend > 0.05) {
      actions.push('Positive trend - continue current optimization strategy');
    }
    if (trend < -0.05) {
      actions.push('Negative trend - investigate failure cases');
    }
    if (likelihood < 0.3) {
      actions.push('Low evolution potential - consider deprecation');
    }

    return actions;
  }

  /**
   * Compare and recommend
   */
  private compareAndRecommend(
  metrics1: EvolutionMetrics,
  metrics2: EvolutionMetrics)
  : string {
    if (metrics1.adaptationScore > metrics2.adaptationScore * 1.5) {
      return 'Pattern 1 significantly outperforms - consider deprecating Pattern 2';
    }
    if (metrics2.adaptationScore > metrics1.adaptationScore * 1.5) {
      return 'Pattern 2 significantly outperforms - consider deprecating Pattern 1';
    }
    if (Math.abs(metrics1.adaptationScore - metrics2.adaptationScore) < 0.1) {
      return 'Similar performance - consider merging patterns';
    }
    return 'Both patterns viable - maintain separately';
  }

  /**
   * Determine current stage from events
   */
  private determineCurrentStage(events: unknown[]): string {
    const latestEvent = events[events.length - 1];
    if (!latestEvent) return 'UNKNOWN';

    const eventTypeToStage: Record<string, string> = {
      'learned': 'emerging',
      'evolved': 'growing',
      'deprecated': 'declining',
      'merged': 'consolidated'
    };

    const event = latestEvent as Record<string, unknown>;
    return eventTypeToStage[event["eventType"] as string] ?? 'active';
  }

  /**
   * Record evolution event
   */
  private recordEvolutionEvent(
  patternId: string,
  metrics: EvolutionMetrics)
  : Promise<void> {
    // TODO: Add ML models to schema (see Agent 2 report from Wave 1)
    logger.warn('ML pattern recognition disabled - patternLearningEvent model not in schema', {
      patternId,
      metrics
    });

    // Return resolved promise since functionality is disabled
    return Promise.resolve();

    /* Disabled until ML models added to schema:
    try {
      // Type assertion for the create operation
      await (this.prisma.patternLearningEvent.create as (args: unknown) => Promise<unknown>)({
        data: {
          eventType: 'evolution_tracked',
          patternId,
          confidence: metrics.adaptationScore,
          result: 'success',
          metadata: metrics as Record<string, unknown>
        }
      });
    } catch (error: unknown) {
      logger.error('Error recording evolution event:', { error, patternId });
    }
    */
  }

  /**
   * Convert DB pattern to internal format
   */
  private dbPatternToPattern(dbPattern: unknown): Pattern {
    const dbp = dbPattern as Record<string, unknown>;
    const selectors = dbp["selectors"] as string[] | undefined;
    const usageCount = dbp["usageCount"] as number;
    const successCount = dbp["successCount"] as number;
    const createdAt = dbp["createdAt"] as Date | undefined;
    const category = dbp["category"] as string | undefined;
    const version = dbp["version"] as number | undefined;
    const sourceUrls = dbp["sourceUrls"] as string[] | undefined;
    const variations = dbp["variations"] as unknown[] | undefined;

    // Map database pattern to Pattern interface
    return {
      id: dbp["id"] as string,
      // name: dbp["name"] ?? `Pattern_${dbp["id"]}`,
      type: category ?? 'metadata',
      features: dbp["features"] as Record<string, unknown>,
      selector: selectors?.[0] ?? '',
      confidence: dbp["confidence"] as number,
      created: createdAt ?? new Date(),
      version: version ?? 1,
      source: sourceUrls ?? [],
      accuracy: dbp["accuracy"] as number,
      usageCount: usageCount,
      successRate: successCount / (usageCount || 1),
      lastUsed: dbp["lastSeen"] as Date,
      metadata: {
        version: version ?? 1,
        source: sourceUrls ?? [],
        variations: variations ?? [],
        signature: dbp["signature"] as string,
        selectors: dbp["selectors"] as string[],
        category: category ?? 'metadata'
      }
    } as unknown as Pattern;
  }
}