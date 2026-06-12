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
import type { ParseOptions, ParsedContent, UIFormattedContent } from '../UnifiedMetadataParser';

// ============================================================================
// Configuration
// ============================================================================

export interface UnifiedParserConfig {
  enableCache?: boolean;
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
  private monitoringTimer: NodeJS.Timeout | null = null;
  private config: UnifiedParserConfig;
  
  private constructor(config: UnifiedParserConfig = {}) {
    this.config = {
      enableCache: true,
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

    // Start performance monitoring if enabled
    if (this.config.performanceMonitoring) {
      this.startMonitoring();
    }
    
    logger.info('Unified Parser initialized', {
      cache: this.config.enableCache,
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
   * Main parsing method
   */
  public async parse(
    htmlOrUrl: string,
    options: CachedParseOptions = {}
  ): Promise<NormalizedMangaData> {
    const startTime = Date.now();

    try {
      const result = await this.parser.parseUnified(htmlOrUrl, options);

      // Track performance
      const parseTime = Date.now() - startTime;
      if (this.config.performanceMonitoring) {
        logger.debug(`Parse completed in ${parseTime}ms`, {
          source: options["source"],
          cached: options.useCache
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
   * Update configuration
   */
  public updateConfig(config: Partial<UnifiedParserConfig>): void {
    this.config = { ...this.config, ...config };
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