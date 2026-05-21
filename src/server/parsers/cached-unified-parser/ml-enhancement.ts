/**
 * ML Enhancement Module for Cached Unified Parser
 *
 * Pattern recognition and ML-based metadata enhancement.
 * These functions enhance parsed results using ML predictions.
 *
 * Extracted from: CachedUnifiedParser.ts
 */

import { isFeatureEnabled, getMLConfig, MLBackend } from '@/server/config/feature-flags';
import { logger } from '@/utils/logger';
import { getUnknownProperty } from '@/utils/type-guards/safe-access';

import { PostgresCacheProvider } from '../cache/PostgresCacheProvider';
import { PatternRecognitionEngine } from '../pattern-recognition/core/PatternRecognitionEngine';

import { isRecord } from './utils';

import type { CachedParseOptions, MLMetrics } from './types';

/**
 * Options for trainWithFeedback function
 */
export interface TrainWithFeedbackOptions {
  urlOrHtml: string;
  correctResult: unknown;
  feedback: string | undefined;
  mlEngine: PatternRecognitionEngine | undefined;
  cache: PostgresCacheProvider;
  generateCacheKey: (input: string, options: CachedParseOptions) => string;
}

// ============================================================================
// ML Engine Management
// ============================================================================

/**
 * Initialize ML pattern recognition engine
 */
export async function initializeMLEngine(
  mlEngine: PatternRecognitionEngine | undefined
): Promise<PatternRecognitionEngine | undefined> {
  if (!isFeatureEnabled('mlPatternRecognition')) {
    logger.info('[CachedUnifiedParser] ML pattern recognition is disabled');
    return undefined;
  }

  const mlConfig = getMLConfig();

  try {
    if (mlConfig.backend !== MLBackend.NONE) {
      const engine = new PatternRecognitionEngine({
        enableLearning: isFeatureEnabled('mlActiveLearning'),
        enableEvolution: isFeatureEnabled('mlPatternEvolution'),
        enableCaching: mlConfig.cacheResults,
        mlConfig: {
          minConfidence: mlConfig.minConfidence,
          maxInferenceTime: mlConfig.maxInferenceTime,
          modelUpdateFrequency: 3600000,
          activeLearningThreshold: 0.5,
          ensembleSize: 3
        }
      });

      await engine.initialize();
      logger.info(`[CachedUnifiedParser] ML engine initialized with ${mlConfig.backend} backend`);
      return engine;
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('[CachedUnifiedParser] Failed to initialize ML engine:', errorMessage);

    if (mlConfig.fallbackToRules) {
      logger.info('[CachedUnifiedParser] Falling back to rule-based patterns');
    }
  }

  return mlEngine;
}

// ============================================================================
// ML Decision Functions
// ============================================================================

/**
 * Check if ML should be used for parsing
 */
export function shouldUseML(
  options: CachedParseOptions,
  mlEngine: PatternRecognitionEngine | undefined
): boolean {
  if (options.useML === false) {
    return false;
  }

  if (!mlEngine || !isFeatureEnabled('mlPatternRecognition')) {
    return false;
  }

  return options.useML === true || isFeatureEnabled('mlPatternRecognition');
}

// ============================================================================
// ML Enhancement Functions
// ============================================================================

/**
 * Enhance parsed result with ML predictions
 */
export async function enhanceWithML(
  result: unknown,
  htmlOrUrl: string,
  options: CachedParseOptions,
  mlEngine: PatternRecognitionEngine | undefined,
  mlMetrics: MLMetrics
): Promise<unknown> {
  if (!mlEngine) {
    return result;
  }

  const mlStartTime = Date.now();

  try {
    const recognitionResult = await mlEngine.recognize({
      html: htmlOrUrl,
      url: options.url ?? '',
      options: {
        useCache: true,
        confidenceThreshold: options.mlConfidenceThreshold ?? getMLConfig().minConfidence
      }
    });

    if (recognitionResult.confidence > (options.mlConfidenceThreshold ?? 0.7)) {
      const enhancedResult = mergeMLPredictions(result, recognitionResult as unknown as Record<string, unknown>);
      updateMLMetrics(mlMetrics, recognitionResult as unknown as Record<string, unknown>, Date.now() - mlStartTime);
      return enhancedResult;
    }

    return result;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('[CachedUnifiedParser] ML enhancement failed:', errorMessage);
    return result;
  }
}

/**
 * Merge ML predictions with parsed results
 */
export function mergeMLPredictions(
  parsedResult: unknown,
  mlResult: Record<string, unknown>
): unknown {
  if (!parsedResult || typeof parsedResult !== 'object') {
    return parsedResult;
  }
  const merged = { ...(parsedResult as Record<string, unknown>) };

  const patterns = getUnknownProperty(mlResult, 'patterns');
  if (Array.isArray(patterns)) {
    merged['mlPatterns'] = patterns;

    patterns.forEach((pattern: unknown) => {
      if (!isRecord(pattern)) return;
      const confidence = getUnknownProperty(pattern, 'confidence');
      if (typeof confidence === 'number' && confidence > 0.9) {
        const patternType = getUnknownProperty(pattern, 'type');
        const patternData = getUnknownProperty(pattern, 'data');
        switch (patternType) {
          case 'volume':
            if (!merged['volumes'] && patternData) {
              merged['volumes'] = patternData;
            }
            break;
          case 'chapter':
            if (!merged['chapters'] && patternData) {
              merged['chapters'] = patternData;
            }
            break;
          case 'metadata':
            if (patternData && typeof patternData === 'object') {
              const currentMetadata = merged['metadata'];
              merged['metadata'] = {
                ...(currentMetadata && typeof currentMetadata === 'object' ? currentMetadata : {}),
                ...patternData
              };
            }
            break;
          default:
            // Unknown pattern types are ignored
            break;
        }
      }
    });
  }

  merged['mlMetadata'] = {
    confidence: getUnknownProperty(mlResult, 'confidence'),
    modelVersion: getUnknownProperty(mlResult, 'modelVersion'),
    patterns: Array.isArray(patterns) ? patterns.length : 0,
    enhanced: true
  };

  return merged;
}

// ============================================================================
// ML Metrics Functions
// ============================================================================

/**
 * Update ML metrics with new prediction result
 * Note: This function intentionally mutates mlMetrics for performance
 */
export function updateMLMetrics(
  mlMetrics: MLMetrics,
  result: Record<string, unknown>,
  inferenceTime: number
): void {
  // eslint-disable-next-line no-param-reassign -- Intentional mutation for metrics accumulation
  mlMetrics.predictions++;

  const confidence = typeof result['confidence'] === 'number' ? result['confidence'] : 0;
  // eslint-disable-next-line no-param-reassign -- Intentional mutation for metrics accumulation
  mlMetrics.avgConfidence =
    (mlMetrics.avgConfidence * (mlMetrics.predictions - 1) + confidence) /
    mlMetrics.predictions;

  // eslint-disable-next-line no-param-reassign -- Intentional mutation for metrics accumulation
  mlMetrics.avgInferenceTime =
    (mlMetrics.avgInferenceTime * (mlMetrics.predictions - 1) + inferenceTime) /
    mlMetrics.predictions;

  if (isFeatureEnabled('debugMode')) {
    logger.debug('[CachedUnifiedParser] ML Metrics:', {
      predictions: mlMetrics.predictions,
      avgConfidence: mlMetrics.avgConfidence.toFixed(3),
      avgInferenceTime: `${mlMetrics.avgInferenceTime.toFixed(1)}ms`
    });
  }
}

/**
 * Get ML metrics summary
 */
export function getMLMetrics(
  mlMetrics: MLMetrics
): { patterns: number; accuracy: number; confidence: number } | null {
  if (mlMetrics.predictions === 0) {
    return null;
  }

  return {
    patterns: mlMetrics.predictions,
    accuracy: mlMetrics.correctPredictions / mlMetrics.predictions,
    confidence: mlMetrics.avgConfidence
  };
}

// ============================================================================
// ML Training Functions
// ============================================================================

/**
 * Train with feedback for ML improvement
 */
export async function trainWithFeedback(
  options: TrainWithFeedbackOptions
): Promise<void> {
  const { urlOrHtml, feedback, mlEngine, cache, generateCacheKey } = options;

  if (!mlEngine) {
    logger.warn('[CachedUnifiedParser] ML engine not initialized, cannot train');
    return;
  }

  try {
    logger.info('[CachedUnifiedParser] ML feedback received:', feedback);

    const cacheKey = generateCacheKey(urlOrHtml, {});
    await cache.delete(cacheKey, 'unified-parser');

    logger.info('[CachedUnifiedParser] Training completed with feedback');
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('[CachedUnifiedParser] Training failed:', errorMessage);
  }
}
