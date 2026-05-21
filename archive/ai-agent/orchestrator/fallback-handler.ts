/**
 * AI Agent Fallback Handler
 *
 * Handles fallback to adaptive parser when AI agent fails.
 * Provides graceful degradation and maintains data integrity.
 */

import type { EnrichmentResult } from '@/server/services/library/metadataEnrichmentService/types';
import { phaseDbPersistence } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-db-persistence';
import { phaseFandomEnrichment } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-fandom-enrichment';
import { phaseWikipediaFallback } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/phase-wikipedia-fallback';
import type { EnrichmentProgress } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/types';
import type { ChapterEnrichmentMaps } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/types';
import type { AsyncResult } from '@/utils/async-result';
import { createSuccessResult, createErrorResult } from '@/utils/async-result';
import { logger } from '@/utils/logger';

const log = logger.child('AIAgentFallback');

/**
 * Fallback configuration
 */
interface FallbackConfig {
  /** Enable fallback logging */
  enableLogging: boolean;
  /** Track fallback rates for monitoring */
  trackMetrics: boolean;
  /** Maximum fallback rate before alerting (0.0-1.0) */
  alertThreshold: number;
}

const DEFAULT_FALLBACK_CONFIG: FallbackConfig = {
  enableLogging: true,
  trackMetrics: true,
  alertThreshold: 0.1, // 10% fallback rate triggers alert
};

/**
 * Fallback statistics
 */
interface FallbackStats {
  totalCalls: number;
  fallbackCalls: number;
  fallbackRate: number;
  lastAlertTime: number | null;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if alert should be triggered based on timing
 */
function shouldTriggerAlert(lastAlertTime: number | null, now: number): boolean {
  const oneHour = 60 * 60 * 1000;
  if (lastAlertTime === null) {
    return true;
  }
  return now - lastAlertTime >= oneHour;
}

/**
 * Execute the three adaptive parser phases
 */
async function executeAdaptivePhases(
  mangaId: number,
  title: string,
  providerResult: EnrichmentResult,
  onProgress?: EnrichmentProgress
): Promise<void> {
  // Phase 2: DB persistence
  await onProgress?.('fallback', 'Persisting provider data to database...');
  const _dbResult = await phaseDbPersistence(mangaId, providerResult, onProgress);

  // Phase 3: Fandom enrichment
  await onProgress?.('fallback', 'Enriching with Fandom data...');
  const fandomResult = await phaseFandomEnrichment(mangaId, title, onProgress);

  // Phase 3.5: Wikipedia fallback
  await onProgress?.('fallback', 'Gap-filling with Wikipedia data...');
  await phaseWikipediaFallback(mangaId, title, onProgress, {
    forceVolumeExtraction: fandomResult.volumeDataUnreliable,
  });
}

/**
 * Create empty chapter enrichment maps
 */
function createEmptyEnrichmentMaps(): ChapterEnrichmentMaps {
  return {
    chapterTitleMap: {},
    chapterVolumeMap: {},
    chapterCoverMap: {},
    chapterDescriptionMap: {},
    chapterPagesMap: {},
    chapterReleaseDateMap: {},
    volumeDescriptionMap: {},
  };
}

// ============================================================================
// Fallback Handler Class
// ============================================================================

/**
 * Fallback handler singleton
 */
class FallbackHandler {
  private static instance: FallbackHandler | null = null;
  private config: FallbackConfig;
  private stats: FallbackStats;
  private fallbackReasons: Map<string, number>;

  private constructor(config: Partial<FallbackConfig> = {}) {
    this.config = { ...DEFAULT_FALLBACK_CONFIG, ...config };
    this.stats = {
      totalCalls: 0,
      fallbackCalls: 0,
      fallbackRate: 0,
      lastAlertTime: null,
    };
    this.fallbackReasons = new Map();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(config?: Partial<FallbackConfig>): FallbackHandler {
    FallbackHandler.instance ??= new FallbackHandler(config);
    return FallbackHandler.instance;
  }

  /**
   * Execute adaptive parser fallback (phases 2-4)
   *
   * Runs the original enrichment pipeline phases:
   * 1. DB persistence (phase 2)
   * 2. Fandom enrichment (phase 3)
   * 3. Wikipedia fallback (phase 3.5)
   */
  async executeFallback(
    mangaId: number,
    title: string,
    providerResult: EnrichmentResult,
    onProgress?: EnrichmentProgress,
    reason?: string
  ): Promise<AsyncResult<ChapterEnrichmentMaps, Error>> {
    const startTime = Date.now();
    this.stats.totalCalls++;

    this.logFallbackStart(mangaId, title, reason);
    this.trackFallbackReason(reason);

    try {
      await onProgress?.('fallback', 'Starting adaptive parser fallback...');
      await executeAdaptivePhases(mangaId, title, providerResult, onProgress);

      const duration = Date.now() - startTime;
      this.logFallbackSuccess(mangaId, title, duration);

      return createSuccessResult(createEmptyEnrichmentMaps());
    } catch (error) {
      return this.handleFallbackError(error, mangaId, title);
    }
  }

  /**
   * Log fallback start
   */
  private logFallbackStart(
    mangaId: number,
    title: string,
    reason?: string
  ): void {
    if (this.config.enableLogging) {
      log.info('Executing adaptive parser fallback', {
        mangaId,
        title,
        reason: reason ?? 'unknown',
      });
    }
  }

  /**
   * Track fallback reason
   */
  private trackFallbackReason(reason?: string): void {
    if (reason) {
      const currentCount = this.fallbackReasons.get(reason) ?? 0;
      this.fallbackReasons.set(reason, currentCount + 1);
    }
  }

  /**
   * Log fallback success
   */
  private logFallbackSuccess(
    mangaId: number,
    title: string,
    duration: number
  ): void {
    if (this.config.enableLogging) {
      log.info('Adaptive parser fallback completed successfully', {
        mangaId,
        title,
        duration,
      });
    }
  }

  /**
   * Handle fallback error
   */
  private handleFallbackError(
    error: unknown,
    mangaId: number,
    title: string
  ): AsyncResult<ChapterEnrichmentMaps, Error> {
    const err = error instanceof Error ? error : new Error(String(error));
    log.error('Adaptive parser fallback failed', {
      mangaId,
      title,
      error: err,
    });

    this.stats.fallbackCalls++;
    this.updateFallbackRate();

    return createErrorResult(err);
  }

  /**
   * Check if fallback should be triggered based on conditions
   */
  shouldTriggerFallback(
    agentConfidence: number,
    confidenceThreshold: number,
    error?: Error
  ): boolean {
    // Always trigger fallback on agent error
    if (error) {
      return true;
    }

    // Trigger fallback if confidence below threshold
    if (agentConfidence < confidenceThreshold) {
      return true;
    }

    return false;
  }

  /**
   * Get fallback statistics
   */
  getStats(): FallbackStats & { reasons: Record<string, number> } {
    const reasons: Record<string, number> = {};
    for (const [reason, count] of this.fallbackReasons.entries()) {
      reasons[reason] = count;
    }

    return {
      ...this.stats,
      reasons,
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalCalls: 0,
      fallbackCalls: 0,
      fallbackRate: 0,
      lastAlertTime: null,
    };
    this.fallbackReasons.clear();
    log.info('Fallback statistics reset');
  }

  /**
   * Update fallback rate and check for alerts
   */
  private updateFallbackRate(): void {
    if (this.stats.totalCalls === 0) {
      this.stats.fallbackRate = 0;
      return;
    }

    this.stats.fallbackRate = this.stats.fallbackCalls / this.stats.totalCalls;

    // Check if we need to alert
    if (
      this.config.trackMetrics &&
      this.stats.fallbackRate > this.config.alertThreshold
    ) {
      this.triggerAlert();
    }
  }

  /**
   * Trigger alert for high fallback rate
   */
  private triggerAlert(): void {
    const now = Date.now();

    // Check alert timing
    if (!shouldTriggerAlert(this.stats.lastAlertTime, now)) {
      return;
    }

    log.error('High fallback rate detected', {
      fallbackRate: this.stats.fallbackRate,
      threshold: this.config.alertThreshold,
      totalCalls: this.stats.totalCalls,
      fallbackCalls: this.stats.fallbackCalls,
      reasons: Object.fromEntries(this.fallbackReasons.entries()),
    });

    this.stats.lastAlertTime = now;

    // TODO: Send alert to monitoring system
    // Could be Sentry, Slack, email, etc.
  }
}

// Export singleton instance
export const fallbackHandler = FallbackHandler.getInstance();

// Convenience export for common use case
export async function executeAdaptiveParserFallback(
  mangaId: number,
  title: string,
  providerResult: EnrichmentResult,
  onProgress?: EnrichmentProgress,
  reason?: string
): Promise<AsyncResult<ChapterEnrichmentMaps, Error>> {
  return fallbackHandler.executeFallback(
    mangaId,
    title,
    providerResult,
    onProgress,
    reason
  );
}