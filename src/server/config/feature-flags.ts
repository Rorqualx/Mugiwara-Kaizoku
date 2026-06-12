/**
 * Feature Flags Configuration
 *
 * Centralized feature flag management for enabling/disabling features.
 */

import { logger } from '@/utils/logger';

/**
 * Feature flag configuration interface
 */
export interface FeatureFlags {
  // Performance Features
  enableCaching: boolean;
  enableParallelProcessing: boolean;
  enableBatchProcessing: boolean;
  
  // Experimental Features
  experimentalParsers: boolean;
  experimentalImageOptimization: boolean;
  advancedMetadataExtraction: boolean;
  aiAgentEnrichment: boolean;
  
  // Admin Features
  adminDashboard: boolean;
  metricsCollection: boolean;
  debugMode: boolean;
}

/**
 * Feature flag manager class
 */
class FeatureFlagManager {
  private static instance: FeatureFlagManager;
  private flags: FeatureFlags;
  private overrides: Map<string, boolean> = new Map();
  
  private constructor() {
    // Load default configuration
    this.flags = this.loadDefaultFlags();
    
    // Load from environment variables
    this.loadFromEnvironment();
    
    // Load from database (if available)
    this.loadFromDatabase().catch(error => {
      logger.warn('Failed to load feature flags from database:', error);
    });
  }
  
  /**
   * Get singleton instance
   */
  public static getInstance(): FeatureFlagManager {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!FeatureFlagManager.instance) {
      FeatureFlagManager.instance = new FeatureFlagManager();
    }
    return FeatureFlagManager.instance;
  }
  
  /**
   * Load default feature flags
   */
  private loadDefaultFlags(): FeatureFlags {
    return {
      // Performance Features - enabled by default
      enableCaching: true,
      enableParallelProcessing: true,
      enableBatchProcessing: true,
      
      // Experimental Features - disabled by default
      experimentalParsers: false,
      experimentalImageOptimization: false,
      advancedMetadataExtraction: false,
      aiAgentEnrichment: false,
      
      // Admin Features
      adminDashboard: true,
      metricsCollection: true,
      debugMode: false
    };
  }
  
  /**
   * Load flags from environment variables — DEPRECATED
   * Feature flags are now seeded from env into the Config table at startup.
   * This method is kept as a no-op for backward compatibility.
   */
  private loadFromEnvironment(): void {
    // No-op: flags are loaded from the database via loadFromDatabase()
    // Environment seeding happens in env-seeders/feature-flag-env-seeder.ts
  }
  
  /**
   * Load flags from database
   */
  private async loadFromDatabase(): Promise<void> {
    try {
      // This would normally load from your database
      // For now, we'll use a placeholder
      const dbFlags = await this.fetchFlagsFromDatabase();
      if (dbFlags) {
        this.flags = { ...this.flags, ...dbFlags };
      }
    } catch (_error: unknown) {
      // Silently fail if database is not available
    }
  }
  
  /**
   * Fetch feature flags from the Config table via configReader
   */
  private async fetchFlagsFromDatabase(): Promise<Partial<FeatureFlags> | null> {
    try {
      const { configReader } = await import('../../server/utils/configReader');

      // Check if any feature flag keys exist in the Config table
      const exists = await configReader.exists('featureFlags.enableCaching');
      if (!exists) return null;

      return {
        enableCaching: await configReader.getBoolean('featureFlags.enableCaching', true),
        metricsCollection: await configReader.getBoolean('featureFlags.metricsCollection', true),
        aiAgentEnrichment: await configReader.getBoolean('featureFlags.aiAgentEnrichment'),
      };
    } catch (_error: unknown) {
      return null;
    }
  }
  
  /**
   * Check if a feature is enabled
   */
  public isEnabled(feature: keyof FeatureFlags): boolean {
    // Check for runtime override first
    const override = this.overrides.get(feature);
    if (override !== undefined) {
      return override;
    }

    return this.flags[feature];
  }
  
  /**
   * Get all feature flags
   */
  public getAllFlags(): FeatureFlags {
    return { ...this.flags };
  }
  
  /**
   * Update a feature flag
   */
  public setFlag(feature: keyof FeatureFlags, enabled: boolean): void {
    this.flags[feature] = enabled;
    logger.info(`Feature flag ${feature} set to ${enabled}`);
    
    // Emit event for real-time updates
    this.emitFlagChange(feature, enabled);
  }
  
  /**
   * Set runtime override for a feature
   */
  public setOverride(feature: keyof FeatureFlags, enabled: boolean): void {
    this.overrides.set(feature, enabled);
    logger.info(`Runtime override for ${feature} set to ${enabled}`);
  }
  
  /**
   * Clear runtime override
   */
  public clearOverride(feature: keyof FeatureFlags): void {
    this.overrides.delete(feature);
    logger.info(`Runtime override for ${feature} cleared`);
  }
  
  /**
   * Emit flag change event
   */
  private emitFlagChange(feature: string, enabled: boolean): void {
    // This could emit to a WebSocket or event bus for real-time updates
    if (process.env.NODE_ENV === 'development') {
      logger.debug(`Feature flag change: ${feature} = ${enabled}`);
    }
  }
  
  /**
   * Save flags to database
   */
  public saveToDatabase(): Promise<void> {
    try {
      // TODO: Implement actual database save
      // const { prisma } = await import('../../server/db');
      // await prisma.systemConfig.upsert({
      //   where: { id: 'default' },
      //   create: { id: 'default', featureFlags: this.flags },
      //   update: { featureFlags: this.flags }
      // });
      logger.info('Feature flags saved to database');
      return Promise.resolve();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to save feature flags to database:', errorMessage);
      return Promise.reject(new Error(errorMessage));
    }
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Get the feature flag manager instance
 */
export function getFeatureFlagManager(): FeatureFlagManager {
  return FeatureFlagManager.getInstance();
}

/**
 * Check if a feature is enabled
 */
export function isFeatureEnabled(feature: keyof FeatureFlags): boolean {
  return getFeatureFlagManager().isEnabled(feature);
}

// ============================================================================
// Default Export
// ============================================================================

export default FeatureFlagManager;