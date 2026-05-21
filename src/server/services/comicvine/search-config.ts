/**
 * ComicVine Search Configuration
 *
 * Configuration for enabling/disabling search optimizations discovered
 * during manual ComicVine data enrichment.
 *
 * Optimizations include:
 * - Multi-query search with title variations (English + Japanese/romanized)
 * - Series page preference (4050 volumes over 4000 issues)
 * - Title normalization applied to search queries
 * - Publisher-based validation/scoring for known manga publishers
 */

import { logger } from '@/utils/logger';

import { comicvineConfigService } from './configService';

// ============================================================================
// Configuration Interface
// ============================================================================

/**
 * Configuration for ComicVine search optimizations
 */
export interface ComicVineSearchConfig {
  /** Try multiple title variations (English + alternative titles) */
  enableMultiQuery: boolean;
  /** Normalize queries before search (remove special chars, etc.) */
  enableTitleNormalization: boolean;
  /** Boost known manga publishers in scoring */
  enablePublisherBoost: boolean;
  /** Prefer 4050 (volume) pages over 4000 (issue) pages */
  enableResourceTypePreference: boolean;
  /** Maximum queries per search for rate limiting (default: 2) */
  maxQueriesPerSearch: number;
  /** Score multiplier for known manga publishers (default: 1.3 = 30% boost) */
  publisherBoostMultiplier: number;
  /** Score bonus for 4050 (volume) pages (default: 0.2) */
  volumePageBonus: number;
  /** Score threshold to short-circuit multi-query (default: 0.9) */
  highConfidenceThreshold: number;
}

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * Default search configuration with all optimizations enabled
 */
const DEFAULT_SEARCH_CONFIG: ComicVineSearchConfig = {
  enableMultiQuery: true,
  enableTitleNormalization: true,
  enablePublisherBoost: true,
  enableResourceTypePreference: true,
  maxQueriesPerSearch: 2,
  publisherBoostMultiplier: 1.3,
  volumePageBonus: 0.2,
  highConfidenceThreshold: 0.9,
};

// ============================================================================
// Configuration Cache
// ============================================================================

/** Cached configuration */
let cachedConfig: ComicVineSearchConfig | null = null;

/** Cache timestamp */
let cacheTimestamp = 0;

/** Cache TTL in milliseconds (5 minutes) */
const CACHE_TTL = 5 * 60 * 1000;

// ============================================================================
// Configuration Functions
// ============================================================================

/**
 * Get ComicVine search configuration
 *
 * Returns cached configuration if available and not expired,
 * otherwise loads from database configuration service.
 *
 * @returns Promise resolving to search configuration
 */
export async function getComicVineSearchConfig(): Promise<ComicVineSearchConfig> {
  const now = Date.now();

  // Return cached config if still valid
  if (cachedConfig && now - cacheTimestamp < CACHE_TTL) {
    return cachedConfig;
  }

  try {
    // Load from database config service to validate connection
    // Future: Individual optimization settings could be stored as config keys
    await comicvineConfigService.loadConfig();

    // Build search config from defaults
    // Future extension example:
    // const dbConfig = await comicvineConfigService.loadConfig();
    // enableMultiQuery: dbConfig.enableMultiQuery ?? DEFAULT_SEARCH_CONFIG.enableMultiQuery,
    const config: ComicVineSearchConfig = {
      ...DEFAULT_SEARCH_CONFIG,
    };

    // Cache the result
    cachedConfig = config;
    cacheTimestamp = now;

    logger.debug('[ComicVine] Loaded search configuration', {
      enableMultiQuery: config.enableMultiQuery,
      enableTitleNormalization: config.enableTitleNormalization,
      enablePublisherBoost: config.enablePublisherBoost,
      enableResourceTypePreference: config.enableResourceTypePreference,
    });

    return config;
  } catch (error) {
    logger.warn('[ComicVine] Failed to load search config, using defaults', { error });
    return DEFAULT_SEARCH_CONFIG;
  }
}

/**
 * Clear the configuration cache
 *
 * Call this when configuration is updated to force reload on next access.
 */
export function clearSearchConfigCache(): void {
  cachedConfig = null;
  cacheTimestamp = 0;
  logger.debug('[ComicVine] Search config cache cleared');
}

/**
 * Get the default search configuration
 *
 * Useful for testing or when database is unavailable.
 *
 * @returns Default search configuration
 */
export function getDefaultSearchConfig(): ComicVineSearchConfig {
  return { ...DEFAULT_SEARCH_CONFIG };
}
