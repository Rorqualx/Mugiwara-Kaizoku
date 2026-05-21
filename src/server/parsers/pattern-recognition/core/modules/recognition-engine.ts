/**
 * Recognition Engine Module
 *
 * Main recognition workflow orchestration extracted from RecognitionCore.
 * Handles recognition requests, caching, learning, and response creation.
 *
 * Extracted from: recognition-core.ts
 * Date: 2025-11-20
 *
 * @module RecognitionEngine
 */

import * as cheerio from 'cheerio';

import { FeatureEngineering } from '@/server/parsers/pattern-recognition/core/FeatureEngineering';
import type {
  Pattern,
  PatternFeatures,
  PatternMatch,
  PatternType,
  RecognitionRequest,
  RecognitionResponse,
  UserFeedback,
  Prediction,
  PatternEvent,
} from '@/server/parsers/pattern-recognition/types';
import { PatternCache } from '@/server/parsers/pattern-recognition/utils/PatternCache';
import { PerformanceMonitor } from '@/server/parsers/pattern-recognition/utils/PerformanceMonitor';
import { logger } from '@/utils/logger';

import { ElementProcessor } from './element-processor';

import type { CheerioAPI } from 'cheerio';
import type { AnyNode } from 'domhandler';

// Type alias for clarity
type Element = AnyNode;

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Dependencies required by RecognitionEngine
 */
export interface RecognitionEngineDependencies {
  cache: PatternCache;
  featureEngineering: FeatureEngineering;
  patterns: Map<string, Pattern>;
  patternsByType: Map<PatternType, Pattern[]>;
  monitor: PerformanceMonitor;
  config: {
    enableLearning: boolean;
    enableCaching: boolean;
  };
}

/**
 * Callback for emitting events
 */
export type EventEmitter = (event: string, data: PatternEvent) => void;

/**
 * Statistics tracking
 */
export interface RecognitionStats {
  totalRecognitions: number;
  successfulRecognitions: number;
  cacheHits: number;
  cacheMisses: number;
}

// ============================================================================
// RecognitionEngine Class
// ============================================================================

/**
 * Main recognition engine responsible for orchestrating pattern recognition workflow
 */
export class RecognitionEngine {
  private cache: PatternCache;
  private featureEngineering: FeatureEngineering;
  private patterns: Map<string, Pattern>;
  private patternsByType: Map<PatternType, Pattern[]>;
  private monitor: PerformanceMonitor;
  private config: RecognitionEngineDependencies['config'];
  private emitEvent: EventEmitter;
  private stats: RecognitionStats;
  private elementProcessor: ElementProcessor;

  /**
   * Create a new RecognitionEngine instance
   *
   * @param dependencies - Required dependencies
   * @param emitEvent - Event emission callback
   */
  constructor(
    dependencies: RecognitionEngineDependencies,
    emitEvent: EventEmitter
  ) {
    this.cache = dependencies.cache;
    this.featureEngineering = dependencies.featureEngineering;
    this.patterns = dependencies.patterns;
    this.patternsByType = dependencies.patternsByType;
    this.monitor = dependencies.monitor;
    this.config = dependencies.config;
    this.emitEvent = emitEvent;
    this.stats = {
      totalRecognitions: 0,
      successfulRecognitions: 0,
      cacheHits: 0,
      cacheMisses: 0,
    };

    // Initialize element processor
    this.elementProcessor = new ElementProcessor(
      this.featureEngineering,
      this.patterns
    );
  }

  // ============================================================================
  // Public Methods
  // ============================================================================

  /**
   * Recognize patterns in HTML
   *
   * Main recognition workflow that processes HTML, finds candidate elements,
   * matches patterns, and returns results.
   *
   * @param request - Recognition request with HTML and options
   * @returns Recognition response with matches and metrics
   */
  async recognize(request: RecognitionRequest): Promise<RecognitionResponse> {
    const startTime = Date.now();
    const options = request.options ?? {};

    // Check cache first
    if (options.useCache !== false && this.config.enableCaching) {
      const cached = await this.cache.get(request.html);
      if (cached) {
        this.stats.cacheHits++;
        return this.createResponse(cached.matches, cached.confidence, {
          totalTime: Date.now() - startTime,
          featureExtractionTime: 0,
          inferenceTime: 0,
          cacheHit: true,
        });
      }
      this.stats.cacheMisses++;
    }

    // Parse HTML
    const $ = cheerio.load(request.html);

    // Find potential pattern elements
    const candidates = this.findCandidateElements($, request.targetType);

    // Process candidates in parallel
    const featureStartTime = Date.now();
    const matchArrays = await Promise.all(
      candidates.map((element) =>
        Promise.resolve(this.elementProcessor.processElement(element, $, options))
      )
    );
    const matches = matchArrays.flat();
    const featureTime = Date.now() - featureStartTime;

    // Sort by confidence
    matches.sort((a, b) => b.confidence - a.confidence);

    // Limit results
    const limitedMatches = options.maxResults
      ? matches.slice(0, options.maxResults)
      : matches;

    // Calculate overall confidence
    const overallConfidence = this.calculateOverallConfidence(limitedMatches);

    // Cache result
    if (this.config.enableCaching && limitedMatches.length > 0) {
      await this.cache.set(request.html, {
        matches: limitedMatches,
        confidence: overallConfidence,
      });
    }

    // Learn from result if enabled
    if (options.learnFromResult !== false && this.config.enableLearning) {
      void this.learnFromRecognition(request, limitedMatches);
    }

    // Update statistics
    this.stats.totalRecognitions++;
    if (limitedMatches.length > 0) {
      this.stats.successfulRecognitions++;
    }

    // Create response
    const response = this.createResponse(limitedMatches, overallConfidence, {
      totalTime: Date.now() - startTime,
      featureExtractionTime: featureTime,
      inferenceTime: Date.now() - startTime - featureTime,
      cacheHit: false,
    });

    // Emit event
    this.emitEvent('recognition', {
      type: 'pattern:matched',
      data: response,
      timestamp: new Date(),
    });

    return response;
  }

  /**
   * Process user feedback
   *
   * @param _matchId - ID of the match receiving feedback
   * @param _feedback - User feedback data
   */
  provideFeedback(
    _matchId: string,
    _feedback: UserFeedback
  ): Promise<void> {
    // ML components disabled - feedback processing skipped
    logger.info('Feedback processing disabled - ML components not available');
    return Promise.resolve();

    // Original implementation (commented out due to ML dependency):
    // await this.activeLearning.processFeedback(matchId, feedback);
    //
    // // Trigger pattern evolution if negative feedback
    // if (!feedback.correct && this.config.enableEvolution) {
    //   await this.evolvePatterns();
    // }
  }

  /**
   * Make predictions on input data
   *
   * @param _request - Recognition request
   * @returns Array of predictions (empty when ML disabled)
   */
  predict(_request: RecognitionRequest): Promise<Prediction[]> {
    // ML components disabled - returning empty predictions
    logger.info('ML prediction disabled - ML components not available');
    return Promise.resolve([]);
  }

  /**
   * Learn from user feedback
   *
   * @param _html - HTML content
   * @param _features - Pattern features
   * @param _feedback - User feedback
   */
  learn(
    _html: string,
    _features: PatternFeatures,
    _feedback: unknown
  ): Promise<void> {
    // ML components disabled - learning skipped
    logger.info('ML learning disabled - ML components not available');
    return Promise.resolve();
  }

  /**
   * Get current statistics
   *
   * @returns Current recognition statistics
   */
  getStats(): Readonly<RecognitionStats> {
    return { ...this.stats };
  }

  // ============================================================================
  // Private Methods - Element Finding
  // ============================================================================

  /**
   * Find candidate elements for pattern matching
   *
   * @param $ - Cheerio instance
   * @param targetType - Optional target pattern type
   * @returns Array of candidate elements
   */
  private findCandidateElements(
    $: CheerioAPI,
    targetType?: PatternType
  ): Element[] {
    const candidates: Element[] = [];

    // Define selectors based on target type
    const selectors = targetType
      ? this.getSelectorsForType(targetType)
      : this.getDefaultSelectors();

    // Find elements
    for (const selector of selectors) {
      $(selector).each((_, element) => {
        candidates.push(element);
      });
    }

    return candidates;
  }

  /**
   * Get selectors for specific pattern type
   *
   * @param type - Pattern type
   * @returns Array of CSS selectors
   */
  private getSelectorsForType(type: PatternType): string[] {
    switch (type) {
      case 'volume':
        return [
          'div[class*="volume"]',
          'tr:contains("Volume")',
          '.volume-item',
          '[data-volume]',
        ];
      case 'chapter':
        return [
          'div[class*="chapter"]',
          'tr:contains("Chapter")',
          '.chapter-item',
          '[data-chapter]',
        ];
      case 'title':
        return ['h1', 'h2', '.title', '.page-title'];
      case 'coverImage':
        return [
          '.cover img',
          '.infobox img',
          '.portable-infobox img',
          'img[alt*="cover"]',
        ];
      case 'table':
        return ['table', '.wikitable', '.data-table'];
      case 'infobox':
        return ['.infobox', '.portable-infobox', '.sidebar'];
      default:
        return ['*'];
    }
  }

  /**
   * Get default selectors for general search
   *
   * @returns Array of default CSS selectors
   */
  private getDefaultSelectors(): string[] {
    return [
      'table',
      '.infobox',
      '.portable-infobox',
      '.gallery',
      '.wikia-gallery',
      'h1, h2, h3',
      'img',
      'p',
      'div[class*="volume"]',
      'div[class*="chapter"]',
      'section',
      'article',
    ];
  }

  // ============================================================================
  // Private Methods - Learning
  // ============================================================================

  /**
   * Learn from recognition results
   *
   * Updates pattern usage statistics based on successful matches.
   *
   * @param request - Original recognition request
   * @param matches - Pattern matches found
   */
  private learnFromRecognition(
    request: RecognitionRequest,
    matches: PatternMatch[]
  ): Promise<void> {
    if (!this.config.enableLearning) {
      return Promise.resolve();
    }

    for (const match of matches) {
      // Create prediction from match (for future ML integration)
      const _prediction: Prediction = {
        label: match.pattern.type,
        confidence: match.confidence,
        probabilities: { [match.pattern.type]: match.confidence },
        features: match.features,
        modelId: 'ensemble',
      };

      // Update pattern usage statistics
      match.pattern.usageCount++;
      match.pattern.lastUsed = new Date();

      // ML components disabled - learning skipped
      // Original implementation:
      // await this.activeLearning.learn(
      //   request.html,
      //   match.features,
      //   prediction
      // );
    }

    return Promise.resolve();
  }

  // ============================================================================
  // Private Methods - Response Creation
  // ============================================================================

  /**
   * Calculate overall confidence from matches
   *
   * @param matches - Array of pattern matches
   * @returns Overall confidence score (0-1)
   */
  private calculateOverallConfidence(matches: PatternMatch[]): number {
    if (matches.length === 0) {
      return 0;
    }

    // Weighted average based on individual confidences
    const totalConfidence = matches.reduce(
      (sum, match) => sum + match.confidence,
      0
    );
    return totalConfidence / matches.length;
  }

  /**
   * Create response object
   *
   * @param matches - Pattern matches
   * @param confidence - Overall confidence score
   * @param metrics - Performance metrics
   * @returns Recognition response
   */
  private createResponse(
    matches: PatternMatch[],
    confidence: number,
    metrics: RecognitionResponse['performanceMetrics']
  ): RecognitionResponse {
    return {
      success: matches.length > 0,
      matches,
      confidence,
      extractedData: this.mergeExtractedData(matches),
      performanceMetrics: metrics,
    };
  }

  /**
   * Merge extracted data from all matches
   *
   * @param matches - Pattern matches
   * @returns Merged extracted data grouped by pattern type
   */
  private mergeExtractedData(matches: PatternMatch[]): unknown {
    const merged: Record<string, unknown[]> = {};

    for (const match of matches) {
      const type = match.pattern.type;
      // Initialize array if not present, then push (??= guarantees array exists)
      (merged[type] ??= []).push(match.extractedData);
    }

    return merged;
  }
}
