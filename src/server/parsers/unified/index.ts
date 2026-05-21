/**
 * Unified Parser Entry Point
 * 
 * Single source of truth for all metadata parsing operations.
 * This module consolidates all parsing logic and provides a consistent
 * interface for metadata extraction across all providers.
 * 
 * @module parsers/unified
 */

import { logger } from '@/utils/logger';

import { PostgresCacheProvider } from '../cache/PostgresCacheProvider';
import { CachedUnifiedParser } from '../CachedUnifiedParser';

import type { CachedParseOptions } from '../CachedUnifiedParser';
import type { NormalizedMangaData } from '../core/DataNormalizer';
import type { PatternRecognitionEngine } from '../pattern-recognition/core/PatternRecognitionEngine';
import type { ParseOptions, ParsedContent, UIFormattedContent } from '../UnifiedMetadataParser';

// ============================================================================
// Configuration
// ============================================================================

export interface UnifiedParserConfig {
  enableCache?: boolean;
  enableML?: boolean;
  cacheTTL?: number;
  cacheNamespace?: string;
  performanceMonitoring?: boolean;
  providers?: string[];
}

// ============================================================================
// Singleton Instance Management
// ============================================================================

class UnifiedParserManager {
  private static instance: UnifiedParserManager | undefined;
  private parser: CachedUnifiedParser;
  private cache: PostgresCacheProvider;
  private mlEngine?: PatternRecognitionEngine;
  private monitoringTimer: NodeJS.Timeout | null = null;
  private config: UnifiedParserConfig;
  
  private constructor(config: UnifiedParserConfig = {}) {
    this.config = {
      enableCache: true,
      enableML: false,
      cacheTTL: 86400, // 24 hours
      cacheNamespace: 'unified-parser',
      performanceMonitoring: false,
      providers: ['fandom', 'wikipedia', 'anilist', 'comicvine'],
      ...config
    };
    
    // Initialize cache if enabled
    this.cache = new PostgresCacheProvider();
    
    // Initialize parser with cache
    this.parser = new CachedUnifiedParser(this.config.enableCache ? this.cache : undefined);

    // Initialize ML engine if enabled
    if (this.config.enableML) {
      void this.initializeMLEngine();
    }

    // Start performance monitoring if enabled
    if (this.config.performanceMonitoring) {
      this.startMonitoring();
    }
    
    logger.info('Unified Parser initialized', {
      cache: this.config.enableCache,
      ml: this.config.enableML,
      providers: this.config.providers
    });
  }
  
  /**
   * Get singleton instance
   */
  public static getInstance(config?: UnifiedParserConfig): UnifiedParserManager {
    UnifiedParserManager.instance ??= new UnifiedParserManager(config);
    return UnifiedParserManager.instance;
  }
  
  /**
   * Initialize ML engine for pattern recognition
   */
  private async initializeMLEngine(): Promise<void> {
    try {
      const { PatternRecognitionEngine } = await import('../pattern-recognition/core/PatternRecognitionEngine');
      this.mlEngine = new PatternRecognitionEngine({
        enableCaching: true,
        enableLearning: true
      });
      await this.mlEngine.initialize();
      logger.info('ML Pattern Recognition Engine initialized');
    } catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
logger.error('Failed to initialize ML engine:', errorMessage);
      this.config.enableML = false;
    }
  }
  
  /**
   * Start performance monitoring
   */
  private startMonitoring(): void {
    if (this.monitoringTimer) clearInterval(this.monitoringTimer);
    this.monitoringTimer = setInterval(() => {
      const metrics = this.parser.getMetrics();
      logger.debug('Parser metrics:', metrics);
    }, 60000); // Log every minute
  }
  
  /**
   * Main parsing method with ML enhancement
   */
  public async parse(
    htmlOrUrl: string,
    options: CachedParseOptions = {}
  ): Promise<NormalizedMangaData> {
    const startTime = Date.now();

    try {
      // Apply ML predictions if enabled
      if (this.mlEngine && this.config.enableML) {
        const _predictions = await this.mlEngine.predict({
          html: htmlOrUrl,
          url: options["source"] || 'unknown',
          options: {}
        });

        // Enhance options with ML predictions
        // Note: Current implementation returns empty array
        // This is a placeholder for future ML integration
      }

      // Parse with enhanced options
      const result = await this.parser.parseUnified(htmlOrUrl, options);

      // Track performance
      const parseTime = Date.now() - startTime;
      if (this.config.performanceMonitoring) {
        logger.debug(`Parse completed in ${parseTime}ms`, {
          source: options["source"],
          cached: options.useCache,
          ml: this.config.enableML
        });
      }

      return result;
    } catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
logger.error('Parse failed:', errorMessage);
      throw new Error(errorMessage);
    }
  }
  
  /**
   * Parse HTML directly
   */
  public parseHTML(
    html: string,
    options: ParseOptions = {}
  ): ParsedContent {
    return this.parser.parseHTML(html, options);
  }
  
  /**
   * Parse URL with automatic source detection
   */
  public async parseURL(
    url: string,
    options: CachedParseOptions = {}
  ): Promise<NormalizedMangaData> {
    // Auto-detect source from URL
    const enhancedOptions = { ...options };
    if (!enhancedOptions["source"]) {
      if (url.includes('fandom.com')) {
        enhancedOptions["source"] = 'fandom';
      } else if (url.includes('wikipedia.org')) {
        enhancedOptions["source"] = 'wikipedia';
      } else {
        enhancedOptions["source"] = 'auto';
      }
    }

    return this.parse(url, enhancedOptions);
  }
  
  /**
   * Format parsed content for UI consumption
   */
  public formatForUI(content: ParsedContent): UIFormattedContent {
    return this.parser.formatForUI(content);
  }
  
  /**
   * Clear cache
   */
  public async clearCache(namespace?: string): Promise<void> {
    const ns = namespace ?? this.config.cacheNamespace;
    await this.cache.clear({ ...(ns !== undefined && { namespace: ns }) });
  }
  
  /**
   * Get parser metrics
   */
  public getMetrics(): ReturnType<CachedUnifiedParser['getMetrics']> {
    return this.parser.getMetrics();
  }
  
  /**
   * Train ML model with feedback
   */
  public async trainWithFeedback(
    content: ParsedContent,
    feedback: unknown
  ): Promise<void> {
    if (this.mlEngine && this.config.enableML) {
      // Learn method expects (html, features, feedback)
      // Create minimal PatternFeatures structure
      const emptyFeatures = {
        structural: { tagCounts: {}, maxDepth: 0, averageDepth: 0, elementCount: 0 },
        semantic: { keywordDensity: {}, topicDistribution: {}, sentimentScore: 0, readabilityScore: 0 },
        statistical: { wordCount: 0, avgWordLength: 0, sentenceCount: 0, avgSentenceLength: 0, paragraphCount: 0 },
        visual: { isVisible: false, isAboveFold: false },
        contextual: { nearbyText: [] }
      };
      await this.mlEngine.learn('', emptyFeatures, feedback);
    }
  }
  
  /**
   * Update configuration
   */
  public updateConfig(config: Partial<UnifiedParserConfig>): void {
    this.config = { ...this.config, ...config };

    // Re-initialize components if needed
    if (config.enableML !== undefined && config.enableML && !this.mlEngine) {
      void this.initializeMLEngine();
    }
  }
}

// ============================================================================
// Exports
// ============================================================================

// Lazy singleton instance to avoid circular dependency issues
let _unifiedParser: UnifiedParserManager | undefined;

/**
 * Get the unified parser singleton instance (lazy initialization)
 * This avoids circular dependency issues when importing parseURL
 */
export function getUnifiedParser(): UnifiedParserManager {
  _unifiedParser ??= UnifiedParserManager.getInstance();
  return _unifiedParser;
}

// For backward compatibility - lazy getter
export const unifiedParser = {
  get instance(): UnifiedParserManager {
    return getUnifiedParser();
  }
};

// Export main parsing functions (lazy to avoid circular dependencies)
export async function parse(
  htmlOrUrl: string,
  options: CachedParseOptions = {}
): Promise<NormalizedMangaData> {
  return getUnifiedParser().parse(htmlOrUrl, options);
}

export function parseHTML(
  html: string,
  options: ParseOptions = {}
): ParsedContent {
  return getUnifiedParser().parseHTML(html, options);
}

export async function parseURL(
  url: string,
  options: CachedParseOptions = {}
): Promise<NormalizedMangaData> {
  return getUnifiedParser().parseURL(url, options);
}

export function formatForUI(content: ParsedContent): UIFormattedContent {
  return getUnifiedParser().formatForUI(content);
}

export async function clearCache(namespace?: string): Promise<void> {
  return getUnifiedParser().clearCache(namespace);
}

export function getMetrics(): ReturnType<CachedUnifiedParser['getMetrics']> {
  return getUnifiedParser().getMetrics();
}

// Export configuration functions
export function updateConfig(config: Partial<UnifiedParserConfig>): void {
  return getUnifiedParser().updateConfig(config);
}

export async function trainWithFeedback(
  content: ParsedContent,
  feedback: unknown
): Promise<void> {
  return getUnifiedParser().trainWithFeedback(content, feedback);
}

// Export types
export type { 
  ParseOptions, 
  ParsedContent, 
  UIFormattedContent,
  CachedParseOptions
};

// Export for custom instances
export { UnifiedParserManager };

// Default export
export default unifiedParser;