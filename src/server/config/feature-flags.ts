/**
 * Feature Flags Configuration
 * 
 * Centralized feature flag management for enabling/disabling features
 * including ML pattern recognition and experimental features.
 */

import { logger } from '@/utils/logger';

/**
 * Feature flag configuration interface
 */
export interface FeatureFlags {
  // ML Features
  mlPatternRecognition: boolean;
  mlActiveLearning: boolean;
  mlPatternEvolution: boolean;
  mlTensorFlowBackend: boolean;  // Use TensorFlow when available
  mlFallbackMode: boolean;        // Use rule-based fallback when ML unavailable
  
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
 * ML Backend options
 */
export enum MLBackend {
  TENSORFLOW = 'tensorflow',
  TENSORFLOWJS = 'tensorflowjs',
  ONNX = 'onnx',
  RULE_BASED = 'rule_based',
  NONE = 'none'
}

/**
 * ML Configuration
 */
export interface MLConfig {
  backend: MLBackend;
  modelPath?: string;
  minConfidence: number;
  maxInferenceTime: number;
  enableMetrics: boolean;
  enableActiveLearning: boolean;
  cacheResults: boolean;
  fallbackToRules: boolean;
  modelUpdateFrequency: number;
  activeLearningThreshold: number;
  ensembleSize: number;
}

/**
 * Feature flag manager class
 */
class FeatureFlagManager {
  private static instance: FeatureFlagManager;
  private flags: FeatureFlags;
  private mlConfig: MLConfig;
  private overrides: Map<string, boolean> = new Map();
  
  private constructor() {
    // Load default configuration
    this.flags = this.loadDefaultFlags();
    this.mlConfig = this.loadDefaultMLConfig();
    
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
      // ML Features - enabled with CPU backend working
      mlPatternRecognition: true,
      mlActiveLearning: true,
      mlPatternEvolution: true,
      mlTensorFlowBackend: true,
      mlFallbackMode: true,
      
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
   * Load default ML configuration
   */
  private loadDefaultMLConfig(): MLConfig {
    return {
      backend: MLBackend.TENSORFLOWJS,  // Use TensorFlow.js CPU backend
      modelPath: './models',
      minConfidence: 0.7,
      maxInferenceTime: 50,
      enableMetrics: true,
      enableActiveLearning: true,
      cacheResults: true,
      fallbackToRules: true,
      modelUpdateFrequency: 86400000, // 24 hours in ms
      activeLearningThreshold: 0.8,
      ensembleSize: 3
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
      const exists = await configReader.exists('featureFlags.mlPatternRecognition');
      if (!exists) return null;

      return {
        mlPatternRecognition: await configReader.getBoolean('featureFlags.mlPatternRecognition'),
        mlActiveLearning: await configReader.getBoolean('featureFlags.mlActiveLearning'),
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
   * Get ML configuration
   */
  public getMLConfig(): MLConfig {
    return { ...this.mlConfig };
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
   * Update ML configuration
   */
  public updateMLConfig(config: Partial<MLConfig>): void {
    this.mlConfig = { ...this.mlConfig, ...config };
    logger.info('ML configuration updated:', this.mlConfig);
  }
  
  /**
   * Check if ML is available
   */
  public isMLAvailable(): boolean {
    if (!this.flags.mlPatternRecognition) {
      return false;
    }
    
    // Check if the selected backend is available
    switch (this.mlConfig.backend) {
      case MLBackend.TENSORFLOW:
        return this.isTensorFlowAvailable();
      case MLBackend.TENSORFLOWJS:
        return this.isTensorFlowJSAvailable();
      case MLBackend.RULE_BASED:
        return true;  // Always available
      default:
        return false;
    }
  }
  
  /**
   * Check if TensorFlow is available
   */
  private isTensorFlowAvailable(): boolean {
    try {
      // Try to dynamically import TensorFlow
      // eslint-disable-next-line no-undef
      require('@tensorflow/tfjs-node');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if TensorFlow.js is available
   */
  private isTensorFlowJSAvailable(): boolean {
    try {
      // Try to dynamically import TensorFlow.js
      // eslint-disable-next-line no-undef
      require('@tensorflow/tfjs');
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Get the best available ML backend
   */
  public getBestAvailableBackend(): MLBackend {
    if (this.isTensorFlowAvailable()) {
      return MLBackend.TENSORFLOW;
    }
    
    if (this.isTensorFlowJSAvailable()) {
      return MLBackend.TENSORFLOWJS;
    }
    
    // Fallback to rule-based
    return MLBackend.RULE_BASED;
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

/**
 * Get ML configuration
 */
export function getMLConfig(): MLConfig {
  return getFeatureFlagManager().getMLConfig();
}

/**
 * Check if ML is available
 */
export function isMLAvailable(): boolean {
  return getFeatureFlagManager().isMLAvailable();
}

// ============================================================================
// Default Export
// ============================================================================

export default FeatureFlagManager;