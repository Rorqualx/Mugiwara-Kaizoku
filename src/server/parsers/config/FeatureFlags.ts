/**
 * Feature Flags for Unified Parser Rollout
 *
 * Provides a configuration system for gradually rolling out the unified parser
 * to replace existing fragmented parsers.
 */

import { prisma } from '@/server/db';
import { getConfigBoolean, getConfigNumber, getConfigArray } from '@/server/utils/configReader';
import { logger } from '@/utils/logger';

import type { PrismaClient } from '@prisma/client';

// ============================================================================
// Type Definitions
// ============================================================================

export interface FeatureFlag {
  key: string;
  enabled: boolean;
  rolloutPercentage?: number;
  enabledForUsers?: string[];
  enabledForSources?: string[];
  metadata?: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface FeatureFlagConfig {
  // Core flags
  USE_UNIFIED_PARSER: boolean;
  USE_POSTGRES_CACHE: boolean;
  USE_BATCH_OPERATIONS: boolean;
  
  // Source-specific flags
  USE_UNIFIED_FOR_FANDOM: boolean;
  USE_UNIFIED_FOR_WIKIPEDIA: boolean;
  USE_UNIFIED_FOR_ANILIST: boolean;
  USE_UNIFIED_FOR_COMICVINE: boolean;
  
  // Feature flags
  ENABLE_PATTERN_LEARNING: boolean;
  ENABLE_PERFORMANCE_MONITORING: boolean;
  ENABLE_ADVANCED_EXTRACTION: boolean;
  ENABLE_STREAMING_PARSE: boolean;
  
  // Rollout controls
  ROLLOUT_PERCENTAGE: number;
  BETA_USERS: string[];
  EXCLUDED_SOURCES: string[];
  
  // Performance tuning
  MAX_CACHE_SIZE_MB: number;
  CACHE_TTL_HOURS: number;
  MAX_CONCURRENT_PARSES: number;
  ENABLE_COMPRESSION: boolean;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_FLAGS: FeatureFlagConfig = {
  // Start with unified parser disabled by default
  USE_UNIFIED_PARSER: false,
  USE_POSTGRES_CACHE: true,
  USE_BATCH_OPERATIONS: true,
  
  // Enable for specific sources gradually
  USE_UNIFIED_FOR_FANDOM: false,
  USE_UNIFIED_FOR_WIKIPEDIA: false,
  USE_UNIFIED_FOR_ANILIST: false,
  USE_UNIFIED_FOR_COMICVINE: false,
  
  // Advanced features disabled initially
  ENABLE_PATTERN_LEARNING: false,
  ENABLE_PERFORMANCE_MONITORING: false,
  ENABLE_ADVANCED_EXTRACTION: false,
  ENABLE_STREAMING_PARSE: false,
  
  // Rollout controls
  ROLLOUT_PERCENTAGE: 0, // Start with 0% rollout
  BETA_USERS: [],
  EXCLUDED_SOURCES: [],
  
  // Performance defaults
  MAX_CACHE_SIZE_MB: 500,
  CACHE_TTL_HOURS: 24,
  MAX_CONCURRENT_PARSES: 5,
  ENABLE_COMPRESSION: true
};

// ============================================================================
// Feature Flag Manager
// ============================================================================

export class FeatureFlagManager {
  private flags: FeatureFlagConfig;
  private prisma?: PrismaClient;
  private overrides: Partial<FeatureFlagConfig> = {};
  private lastRefresh: Date;
  private refreshInterval: number = 60000; // 1 minute
  private refreshTimer: NodeJS.Timeout | null = null;

  constructor(prisma?: PrismaClient) {
    this.flags = { ...DEFAULT_FLAGS };
    if (prisma !== undefined) {
      this.prisma = prisma;
    }
    this.lastRefresh = new Date();
    
    // Load from environment variables
    this.loadFromEnvironment();

    // Load from database if available
    if (this.prisma) {
      void this.loadFromDatabase();
    }

    // Start periodic refresh
    this.startPeriodicRefresh();
  }

  /**
   * Check if a feature is enabled
   */
  isEnabled(flag: keyof FeatureFlagConfig, context?: {
    userId?: string;
    source?: string;
    random?: number;
  }): boolean {
    // Check if globally enabled
    const value = this.flags[flag];
    
    if (typeof value === 'boolean') {
      if (!value) return false;
      
      // Check rollout percentage if applicable
      if (flag === 'USE_UNIFIED_PARSER' && this.flags.ROLLOUT_PERCENTAGE < 100) {
        const random = context?.random ?? Math.random() * 100;
        if (random > this.flags.ROLLOUT_PERCENTAGE) {
          return false;
        }
      }
      
      // Check beta users
      if (context?.userId && this.flags.BETA_USERS.length > 0) {
        return this.flags.BETA_USERS.includes(context.userId);
      }
      
      // Check excluded sources
      if (context?.source && this.flags.EXCLUDED_SOURCES.includes(context["source"])) {
        return false;
      }
      
      return true;
    }
    
    return false;
  }

  /**
   * Check if unified parser should be used for a specific source
   */
  shouldUseUnifiedForSource(source: string): boolean {
    // Check global flag first
    if (!this.flags.USE_UNIFIED_PARSER) {
      return false;
    }
    
    // Check source-specific flags
    switch (source.toLowerCase()) {
      case 'fandom':
        return this.flags.USE_UNIFIED_FOR_FANDOM;
      case 'wikipedia':
        return this.flags.USE_UNIFIED_FOR_WIKIPEDIA;
      case 'anilist':
        return this.flags.USE_UNIFIED_FOR_ANILIST;
      case 'comicvine':
        return this.flags.USE_UNIFIED_FOR_COMICVINE;
      default:
        return false;
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): FeatureFlagConfig {
    return { ...this.flags };
  }

  /**
   * Update flag value
   */
  async setFlag<K extends keyof FeatureFlagConfig>(flag: K, value: FeatureFlagConfig[K]): Promise<void> {
    this.overrides[flag] = value;
    this.flags[flag] = value;
    
    // Persist to database if available
    if (this.prisma) {
      await this.saveToDatabase(flag, value);
    }
  }

  /**
   * Bulk update flags
   */
  async setFlags(updates: Partial<FeatureFlagConfig>): Promise<void> {
    Object.assign(this.overrides, updates);
    Object.assign(this.flags, updates);

    // Persist to database in parallel for better performance
    if (this.prisma) {
      await Promise.all(
        Object.entries(updates).map(([key, value]) =>
          this.saveToDatabase(key as keyof FeatureFlagConfig, value)
        )
      );
    }
  }

  /**
   * Reset to defaults
   */
  reset(): void {
    this.flags = { ...DEFAULT_FLAGS };
    this.overrides = {};
  }

  /**
   * Enable gradual rollout
   */
  async enableGradualRollout(options: {
    startPercentage?: number;
    targetPercentage?: number;
    incrementPercentage?: number;
    intervalHours?: number;
  }): Promise<void> {
    const {
      startPercentage = 0,
      targetPercentage = 100,
      incrementPercentage = 10,
      intervalHours = 24
    } = options;
    
    // Set initial percentage
    await this.setFlag('ROLLOUT_PERCENTAGE', startPercentage);
    await this.setFlag('USE_UNIFIED_PARSER', true);
    
    // Schedule incremental increases
    const intervalMs = intervalHours * 60 * 60 * 1000;
    
    const rolloutInterval = setInterval(() => {
      void (async () => {
        const current = this.flags.ROLLOUT_PERCENTAGE;
        const next = Math.min(current + incrementPercentage, targetPercentage);

        await this.setFlag('ROLLOUT_PERCENTAGE', next);

        logger.info(`Unified Parser rollout increased to ${next}%`);

        if (next >= targetPercentage) {
          clearInterval(rolloutInterval);
          logger.info('Unified Parser rollout complete!');
        }
      })();
    }, intervalMs);
  }

  /**
   * Enable for specific sources
   */
  async enableForSources(sources: string[]): Promise<void> {
    // Enable flags in parallel for better performance
    await Promise.all(
      sources.map(async (source) => {
        const flag = `USE_UNIFIED_FOR_${source.toUpperCase()}` as keyof FeatureFlagConfig;
        if (flag in this.flags) {
          await this.setFlag(flag, true);
        }
      })
    );
  }

  /**
   * Add beta users
   */
  async addBetaUsers(userIds: string[]): Promise<void> {
    const currentUsers = this.flags.BETA_USERS;
    const newUsers = [...new Set([...currentUsers, ...userIds])];
    await this.setFlag('BETA_USERS', newUsers);
  }

  /**
   * Get rollout status
   */
  getRolloutStatus(): {
    enabled: boolean;
    percentage: number;
    enabledSources: string[];
    betaUsers: number;
    performance: {
      cacheEnabled: boolean;
      batchEnabled: boolean;
      maxConcurrency: number;
    };
  } {
    const enabledSources: string[] = [];

    if (this.flags.USE_UNIFIED_FOR_FANDOM) enabledSources.push('fandom');
    if (this.flags.USE_UNIFIED_FOR_WIKIPEDIA) enabledSources.push('wikipedia');
    if (this.flags.USE_UNIFIED_FOR_ANILIST) enabledSources.push('anilist');
    if (this.flags.USE_UNIFIED_FOR_COMICVINE) enabledSources.push('comicvine');
    
    return {
      enabled: this.flags.USE_UNIFIED_PARSER,
      percentage: this.flags.ROLLOUT_PERCENTAGE,
      enabledSources,
      betaUsers: this.flags.BETA_USERS.length,
      performance: {
        cacheEnabled: this.flags.USE_POSTGRES_CACHE,
        batchEnabled: this.flags.USE_BATCH_OPERATIONS,
        maxConcurrency: this.flags.MAX_CONCURRENT_PARSES
      }
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Load flags from environment variables
   */
  private loadFromEnvironment(): void {
    // Boolean flags
    if (process.env["USE_UNIFIED_PARSER"] === 'true') {
      this.flags.USE_UNIFIED_PARSER = true;
    }
    
    if (process.env["USE_POSTGRES_CACHE"] === 'false') {
      this.flags.USE_POSTGRES_CACHE = false;
    }
    
    // Numeric flags
    if (process.env["ROLLOUT_PERCENTAGE"]) {
      this.flags.ROLLOUT_PERCENTAGE = parseInt(process.env["ROLLOUT_PERCENTAGE"], 10);
    }
    
    if (process.env["CACHE_TTL_HOURS"]) {
      this.flags.CACHE_TTL_HOURS = parseInt(process.env["CACHE_TTL_HOURS"], 10);
    }
    
    // Array flags
    if (process.env["BETA_USERS"]) {
      this.flags.BETA_USERS = process.env["BETA_USERS"].split(',').map(u => u.trim());
    }
    
    if (process.env["EXCLUDED_SOURCES"]) {
      this.flags.EXCLUDED_SOURCES = process.env["EXCLUDED_SOURCES"].split(',').map(s => s.trim());
    }
  }

  /**
   * Load flags from Config table
   */
  private async loadFromDatabase(): Promise<void> {
    try {
      // Read all feature flags from Config table in parallel
      const [
        useUnifiedParser,
        usePostgresCache,
        useBatchOperations,
        useUnifiedForFandom,
        useUnifiedForWikipedia,
        useUnifiedForAnilist,
        useUnifiedForComicvine,
        enablePatternLearning,
        enablePerformanceMonitoring,
        enableAdvancedExtraction,
        enableStreamingParse,
        rolloutPercentage,
        betaUsers,
        excludedSources,
        maxCacheSizeMb,
        cacheTtlHours,
        maxConcurrentParses,
        enableCompression
      ] = await Promise.all([
        getConfigBoolean('featureFlags.USE_UNIFIED_PARSER', DEFAULT_FLAGS.USE_UNIFIED_PARSER),
        getConfigBoolean('featureFlags.USE_POSTGRES_CACHE', DEFAULT_FLAGS.USE_POSTGRES_CACHE),
        getConfigBoolean('featureFlags.USE_BATCH_OPERATIONS', DEFAULT_FLAGS.USE_BATCH_OPERATIONS),
        getConfigBoolean('featureFlags.USE_UNIFIED_FOR_FANDOM', DEFAULT_FLAGS.USE_UNIFIED_FOR_FANDOM),
        getConfigBoolean('featureFlags.USE_UNIFIED_FOR_WIKIPEDIA', DEFAULT_FLAGS.USE_UNIFIED_FOR_WIKIPEDIA),
        getConfigBoolean('featureFlags.USE_UNIFIED_FOR_ANILIST', DEFAULT_FLAGS.USE_UNIFIED_FOR_ANILIST),
        getConfigBoolean('featureFlags.USE_UNIFIED_FOR_COMICVINE', DEFAULT_FLAGS.USE_UNIFIED_FOR_COMICVINE),
        getConfigBoolean('featureFlags.ENABLE_PATTERN_LEARNING', DEFAULT_FLAGS.ENABLE_PATTERN_LEARNING),
        getConfigBoolean('featureFlags.ENABLE_PERFORMANCE_MONITORING', DEFAULT_FLAGS.ENABLE_PERFORMANCE_MONITORING),
        getConfigBoolean('featureFlags.ENABLE_ADVANCED_EXTRACTION', DEFAULT_FLAGS.ENABLE_ADVANCED_EXTRACTION),
        getConfigBoolean('featureFlags.ENABLE_STREAMING_PARSE', DEFAULT_FLAGS.ENABLE_STREAMING_PARSE),
        getConfigNumber('featureFlags.ROLLOUT_PERCENTAGE', DEFAULT_FLAGS.ROLLOUT_PERCENTAGE),
        getConfigArray<string>('featureFlags.BETA_USERS', DEFAULT_FLAGS.BETA_USERS),
        getConfigArray<string>('featureFlags.EXCLUDED_SOURCES', DEFAULT_FLAGS.EXCLUDED_SOURCES),
        getConfigNumber('featureFlags.MAX_CACHE_SIZE_MB', DEFAULT_FLAGS.MAX_CACHE_SIZE_MB),
        getConfigNumber('featureFlags.CACHE_TTL_HOURS', DEFAULT_FLAGS.CACHE_TTL_HOURS),
        getConfigNumber('featureFlags.MAX_CONCURRENT_PARSES', DEFAULT_FLAGS.MAX_CONCURRENT_PARSES),
        getConfigBoolean('featureFlags.ENABLE_COMPRESSION', DEFAULT_FLAGS.ENABLE_COMPRESSION)
      ]);

      // Update flags object
      this.flags.USE_UNIFIED_PARSER = useUnifiedParser;
      this.flags.USE_POSTGRES_CACHE = usePostgresCache;
      this.flags.USE_BATCH_OPERATIONS = useBatchOperations;
      this.flags.USE_UNIFIED_FOR_FANDOM = useUnifiedForFandom;
      this.flags.USE_UNIFIED_FOR_WIKIPEDIA = useUnifiedForWikipedia;
      this.flags.USE_UNIFIED_FOR_ANILIST = useUnifiedForAnilist;
      this.flags.USE_UNIFIED_FOR_COMICVINE = useUnifiedForComicvine;
      this.flags.ENABLE_PATTERN_LEARNING = enablePatternLearning;
      this.flags.ENABLE_PERFORMANCE_MONITORING = enablePerformanceMonitoring;
      this.flags.ENABLE_ADVANCED_EXTRACTION = enableAdvancedExtraction;
      this.flags.ENABLE_STREAMING_PARSE = enableStreamingParse;
      this.flags.ROLLOUT_PERCENTAGE = rolloutPercentage;
      this.flags.BETA_USERS = betaUsers;
      this.flags.EXCLUDED_SOURCES = excludedSources;
      this.flags.MAX_CACHE_SIZE_MB = maxCacheSizeMb;
      this.flags.CACHE_TTL_HOURS = cacheTtlHours;
      this.flags.MAX_CONCURRENT_PARSES = maxConcurrentParses;
      this.flags.ENABLE_COMPRESSION = enableCompression;
    } catch (error: unknown) {
      logger.error('Failed to load feature flags from Config table:', error);
    }
  }

  /**
   * Save flag to Config table
   */
  private async saveToDatabase(flag: string, value: unknown): Promise<void> {
    try {
      const configKey = `featureFlags.${flag}`;

      // Determine value type and format
      let valueType: 'STRING' | 'NUMBER' | 'BOOLEAN' | 'JSON';
      let storedValue: string;

      if (typeof value === 'boolean') {
        valueType = 'BOOLEAN';
        storedValue = String(value);
      } else if (typeof value === 'number') {
        valueType = 'NUMBER';
        storedValue = String(value);
      } else if (Array.isArray(value)) {
        valueType = 'JSON';
        storedValue = JSON.stringify(value);
      } else {
        valueType = 'STRING';
        storedValue = String(value);
      }

      // Upsert to Config table
      await prisma.config.upsert({
        where: { key: configKey },
        create: {
          key: configKey,
          value: storedValue,
          valueType,
          scope: 'FEATURE'
        },
        update: {
          value: storedValue,
          valueType
        }
      });
    } catch (error: unknown) {
      logger.error('Failed to save feature flag to Config table:', error);
    }
  }

  /**
   * Start periodic refresh of flags
   */
  private startPeriodicRefresh(): void {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
    this.refreshTimer = setInterval(() => {
      void (async () => {
        if (this.prisma) {
          await this.loadFromDatabase();
        }
        this.lastRefresh = new Date();
      })();
    }, this.refreshInterval);
  }

  /**
   * Stop periodic refresh and release resources
   */
  destroy(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let instance: FeatureFlagManager | null = null;

export function getFeatureFlags(prisma?: PrismaClient): FeatureFlagManager {
  instance ??= new FeatureFlagManager(prisma);
  return instance;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if unified parser is enabled
 */
export function isUnifiedParserEnabled(context?: {
  userId?: string;
  source?: string;
}): boolean {
  return getFeatureFlags().isEnabled('USE_UNIFIED_PARSER', context);
}

/**
 * Check if a specific feature is enabled
 */
export function isFeatureEnabled(
  feature: keyof FeatureFlagConfig,
  context?: { userId?: string; source?: string }
): boolean {
  return getFeatureFlags().isEnabled(feature, context);
}

/**
 * Get parser configuration based on feature flags
 */
export function getParserConfig(): {
  useUnified: boolean;
  useCache: boolean;
  useBatch: boolean;
  cacheTTL: number;
  maxConcurrency: number;
  enableCompression: boolean;
  monitoring: boolean;
} {
  const flags = getFeatureFlags().getConfig();

  return {
    useUnified: flags.USE_UNIFIED_PARSER,
    useCache: flags.USE_POSTGRES_CACHE,
    useBatch: flags.USE_BATCH_OPERATIONS,
    cacheTTL: flags.CACHE_TTL_HOURS * 3600,
    maxConcurrency: flags.MAX_CONCURRENT_PARSES,
    enableCompression: flags.ENABLE_COMPRESSION,
    monitoring: flags.ENABLE_PERFORMANCE_MONITORING
  };
}