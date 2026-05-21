/**
 * ML Configuration and Model Management
 * 
 * Centralized configuration for ML models, paths, and runtime settings.
 * Supports multiple ML backends and model versioning.
 */

import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

import { logger } from '@/utils/logger';

import { MLBackend } from './feature-flags';

/**
 * Model type definitions
 */
export enum ModelType {
  PATTERN_RECOGNITION = 'pattern_recognition',
  VOLUME_EXTRACTION = 'volume_extraction',
  CHAPTER_DETECTION = 'chapter_detection',
  METADATA_EXTRACTION = 'metadata_extraction',
  IMAGE_CLASSIFICATION = 'image_classification'
}

/**
 * Model configuration interface
 */
export interface ModelConfig {
  type: ModelType;
  version: string;
  path: string;
  backend: MLBackend;
  inputShape?: number[];
  outputShape?: number[];
  preprocessing?: {
    normalize?: boolean;
    resize?: [number, number];
    tokenize?: boolean;
  };
  postprocessing?: {
    threshold?: number;
    topK?: number;
    softmax?: boolean;
  };
}

/**
 * Training configuration
 */
export interface TrainingConfig {
  batchSize: number;
  epochs: number;
  learningRate: number;
  validationSplit: number;
  earlyStoppingPatience: number;
  checkpointPath: string;
  tensorboardPath: string;
}

/**
 * ML paths configuration
 */
export interface MLPaths {
  models: string;
  checkpoints: string;
  datasets: string;
  logs: string;
  cache: string;
  exports: string;
}

/**
 * ML Configuration Manager
 */
export class MLConfigManager {
  private static instance: MLConfigManager;
  private models: Map<ModelType, ModelConfig> = new Map();
  private paths: MLPaths;
  private trainingConfig: TrainingConfig;
  private initialized = false;
  
  private constructor() {
    this.paths = this.initializePaths();
    this.trainingConfig = this.loadTrainingConfig();
    this.loadModelConfigs();
  }
  
  /**
   * Get singleton instance
   */
  public static getInstance(): MLConfigManager {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!MLConfigManager.instance) {
      MLConfigManager.instance = new MLConfigManager();
    }
    return MLConfigManager.instance;
  }
  
  /**
   * Initialize ML directory paths
   */
  private initializePaths(): MLPaths {
    const baseDir = process.env["ML_BASE_DIR"] ?? join(process.cwd(), 'ml');
    
    const paths: MLPaths = {
      models: join(baseDir, 'models'),
      checkpoints: join(baseDir, 'checkpoints'),
      datasets: join(baseDir, 'datasets'),
      logs: join(baseDir, 'logs'),
      cache: join(baseDir, 'cache'),
      exports: join(baseDir, 'exports')
    };
    
    // Create directories if they don't exist
    Object.values(paths).forEach((path: string) => {
      if (!existsSync(path)) {
        try {
          mkdirSync(path, { recursive: true });
          logger.info(`[MLConfig] Created directory: ${path}`);
        } catch (error: unknown) {
          logger.error(`[MLConfig] Failed to create directory: ${path}`, error);
        }
      }
    });
    
    return paths;
  }
  
  /**
   * Load training configuration
   */
  private loadTrainingConfig(): TrainingConfig {
    return {
      batchSize: parseInt(process.env["ML_BATCH_SIZE"] ?? '32'),
      epochs: parseInt(process.env["ML_EPOCHS"] ?? '100'),
      learningRate: parseFloat(process.env["ML_LEARNING_RATE"] ?? '0.001'),
      validationSplit: parseFloat(process.env["ML_VALIDATION_SPLIT"] ?? '0.2'),
      earlyStoppingPatience: parseInt(process.env["ML_EARLY_STOPPING"] ?? '10'),
      checkpointPath: join(this.paths.checkpoints, 'latest'),
      tensorboardPath: join(this.paths.logs, 'tensorboard')
    };
  }
  
  /**
   * Load model configurations
   */
  private loadModelConfigs(): void {
    // Pattern Recognition Model
    this.models.set(ModelType.PATTERN_RECOGNITION, {
      type: ModelType.PATTERN_RECOGNITION,
      version: '1.0.0',
      path: join(this.paths.models, 'pattern_recognition_v1.json'),
      backend: MLBackend.RULE_BASED, // Default to rule-based
      inputShape: [512], // Feature vector size
      outputShape: [10], // Number of pattern types
      preprocessing: {
        normalize: true
      },
      postprocessing: {
        threshold: 0.7,
        topK: 3,
        softmax: true
      }
    });
    
    // Volume Extraction Model
    this.models.set(ModelType.VOLUME_EXTRACTION, {
      type: ModelType.VOLUME_EXTRACTION,
      version: '1.0.0',
      path: join(this.paths.models, 'volume_extraction_v1.json'),
      backend: MLBackend.RULE_BASED,
      inputShape: [256],
      outputShape: [2], // Binary classification
      preprocessing: {
        tokenize: true,
        normalize: true
      },
      postprocessing: {
        threshold: 0.8
      }
    });
    
    // Chapter Detection Model
    this.models.set(ModelType.CHAPTER_DETECTION, {
      type: ModelType.CHAPTER_DETECTION,
      version: '1.0.0',
      path: join(this.paths.models, 'chapter_detection_v1.json'),
      backend: MLBackend.RULE_BASED,
      inputShape: [256],
      outputShape: [2],
      preprocessing: {
        tokenize: true,
        normalize: true
      },
      postprocessing: {
        threshold: 0.75
      }
    });
    
    // Metadata Extraction Model
    this.models.set(ModelType.METADATA_EXTRACTION, {
      type: ModelType.METADATA_EXTRACTION,
      version: '1.0.0',
      path: join(this.paths.models, 'metadata_extraction_v1.json'),
      backend: MLBackend.RULE_BASED,
      inputShape: [512],
      outputShape: [20], // Multiple metadata types
      preprocessing: {
        normalize: true
      },
      postprocessing: {
        threshold: 0.6,
        topK: 5
      }
    });
    
    // Image Classification Model
    this.models.set(ModelType.IMAGE_CLASSIFICATION, {
      type: ModelType.IMAGE_CLASSIFICATION,
      version: '1.0.0',
      path: join(this.paths.models, 'image_classification_v1.json'),
      backend: MLBackend.RULE_BASED,
      inputShape: [224, 224, 3], // Image dimensions
      outputShape: [5], // Cover, volume, character, etc.
      preprocessing: {
        resize: [224, 224],
        normalize: true
      },
      postprocessing: {
        threshold: 0.8,
        softmax: true
      }
    });
    
    logger.info(`[MLConfig] Loaded ${this.models.size} model configurations`);
  }
  
  /**
   * Get model configuration
   */
  public getModelConfig(type: ModelType): ModelConfig | undefined {
    return this.models.get(type);
  }
  
  /**
   * Get all model configurations
   */
  public getAllModelConfigs(): ModelConfig[] {
    return Array.from(this.models.values());
  }
  
  /**
   * Update model configuration
   */
  public updateModelConfig(type: ModelType, config: Partial<ModelConfig>): void {
    const existing = this.models.get(type);
    if (existing) {
      this.models.set(type, { ...existing, ...config });
      logger.info(`[MLConfig] Updated configuration for ${type}`);
    }
  }
  
  /**
   * Get ML paths
   */
  public getPaths(): MLPaths {
    return { ...this.paths };
  }
  
  /**
   * Get training configuration
   */
  public getTrainingConfig(): TrainingConfig {
    return { ...this.trainingConfig };
  }
  
  /**
   * Update training configuration
   */
  public updateTrainingConfig(config: Partial<TrainingConfig>): void {
    this.trainingConfig = { ...this.trainingConfig, ...config };
    logger.info('[MLConfig] Updated training configuration');
  }
  
  /**
   * Get model path
   */
  public getModelPath(type: ModelType): string | undefined {
    const config = this.models.get(type);
    if (!config) return undefined;
    
    // Check if model file exists
    if (existsSync(config.path)) {
      return config.path;
    }
    
    // Try alternative paths based on backend
    const alternatives = [
      join(this.paths.models, `${type}.json`),
      join(this.paths.models, `${type}.pb`),
      join(this.paths.models, `${type}.onnx`)
    ];
    
    for (const alt of alternatives) {
      if (existsSync(alt)) {
        return alt;
      }
    }
    
    logger.warn(`[MLConfig] Model file not found for ${type}`);
    return undefined;
  }
  
  /**
   * Check if a model is available
   */
  public isModelAvailable(type: ModelType): boolean {
    return this.getModelPath(type) !== undefined;
  }
  
  /**
   * Get cache path for a specific key
   */
  public getCachePath(key: string): string {
    return join(this.paths.cache, `${key}.cache`);
  }
  
  /**
   * Get export path for a model
   */
  public getExportPath(type: ModelType, format: 'json' | 'onnx' | 'pb' = 'json'): string {
    const config = this.models.get(type);
    const version = config?.version ?? 'unknown';
    return join(this.paths.exports, `${type}_v${version}.${format}`);
  }
  
  /**
   * Initialize ML system
   */
  public initialize(): Promise<void> {
    if (this.initialized) {
      return Promise.resolve();
    }

    try {
      // Check for required models
      const requiredModels = [ModelType.PATTERN_RECOGNITION];
      const missingModels = requiredModels.filter(type => !this.isModelAvailable(type));

      if (missingModels.length > 0) {
        logger.warn(`[MLConfig] Missing models: ${missingModels.join(', ')}`);
        logger.info('[MLConfig] System will use rule-based fallbacks');
      }

      this.initialized = true;
      logger.info('[MLConfig] ML configuration initialized successfully');
      return Promise.resolve();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('[MLConfig] Failed to initialize ML configuration:', errorMessage);
      return Promise.reject(new Error(errorMessage));
    }
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Get ML configuration manager instance
 */
export function getMLConfigManager(): MLConfigManager {
  return MLConfigManager.getInstance();
}

/**
 * Get model configuration
 */
export function getModelConfig(type: ModelType): ModelConfig | undefined {
  return getMLConfigManager().getModelConfig(type);
}

/**
 * Get ML paths
 */
export function getMLPaths(): MLPaths {
  return getMLConfigManager().getPaths();
}

/**
 * Check if model is available
 */
export function isModelAvailable(type: ModelType): boolean {
  return getMLConfigManager().isModelAvailable(type);
}

// ============================================================================
// Default Export
// ============================================================================

export default MLConfigManager;