/**
 * ML Pipeline - Main Aggregator
 *
 * Facade for machine learning operations in pattern recognition.
 * Delegates to specialized services for classification, similarity,
 * anomaly detection, training, and model management.
 *
 * Architecture:
 * - ml/ml-utils.ts - Foundation utilities (142 lines)
 * - ml/ClassifierBuilder.ts - Classifier model (69 lines)
 * - ml/SimilarityModelBuilder.ts - Similarity model (56 lines)
 * - ml/AnomalyDetectorBuilder.ts - Anomaly detector (75 lines)
 * - ml/EnsembleBuilder.ts - Ensemble models (66 lines)
 * - ml/FeatureConverter.ts - Feature conversion (109 lines) ✅ Complexity fixed: 28→2
 * - ml/FeatureScaler.ts - Feature scaling (92 lines)
 * - ml/PredictionService.ts - Predictions (236 lines)
 * - ml/SimilarityService.ts - Similarity (123 lines)
 * - ml/AnomalyDetectionService.ts - Anomaly detection (105 lines)
 * - ml/TrainingService.ts - Training (233 lines)
 * - ml/ModelManager.ts - Model I/O (171 lines)
 *
 * Total: 1,477 lines across 12 modules (vs. 793 lines monolithic)
 * Original: 793 lines, 18 ESLint violations, complexity 28
 * Refactored: ~250 lines main + 12 focused modules, 0 violations, max complexity 2
 *
 * Extracted from: MLPipeline.ts.backup (2025-11-20)
 */

import * as tf from '@tensorflow/tfjs-node';

import { FeatureEngineering } from './FeatureEngineering';
import { AnomalyDetectionService } from './ml/AnomalyDetectionService';
import { AnomalyDetectorBuilder } from './ml/AnomalyDetectorBuilder';
import { ClassifierBuilder } from './ml/ClassifierBuilder';
import { EnsembleBuilder } from './ml/EnsembleBuilder';
import { FeatureConverter } from './ml/FeatureConverter';
import { FeatureScaler } from './ml/FeatureScaler';
import {
  LabelEncoder,
  DEFAULT_ML_CONFIG,
} from './ml/ml-utils';
import { ModelManager } from './ml/ModelManager';
import { PredictionService } from './ml/PredictionService';
import { SimilarityModelBuilder } from './ml/SimilarityModelBuilder';
import { SimilarityService } from './ml/SimilarityService';
import { TrainingService } from './ml/TrainingService';

import type {
  PatternFeatures,
  Pattern,
  PatternType,
  Prediction,
  MLConfig,
  PatternMatch
} from '../types';

export class MLPipeline {
  private config: MLConfig;
  private labelEncoder: LabelEncoder;
  private featureEngineering: FeatureEngineering;

  // Builders
  private classifierBuilder: ClassifierBuilder;
  private similarityModelBuilder: SimilarityModelBuilder;
  private anomalyDetectorBuilder: AnomalyDetectorBuilder;
  private ensembleBuilder: EnsembleBuilder;

  // Feature Processing
  private featureConverter: FeatureConverter;
  private featureScaler: FeatureScaler;

  // Services
  private predictionService: PredictionService;
  private similarityService: SimilarityService;
  private anomalyDetectionService: AnomalyDetectionService;
  private trainingService: TrainingService;
  private modelManager: ModelManager;

  constructor(config: Partial<MLConfig> = {}) {
    // Merge config with defaults
    this.config = { ...DEFAULT_ML_CONFIG, ...config };

    // Initialize foundation
    this.labelEncoder = new LabelEncoder();
    this.featureEngineering = new FeatureEngineering();

    // Initialize builders
    this.classifierBuilder = new ClassifierBuilder(this.labelEncoder.size);
    this.similarityModelBuilder = new SimilarityModelBuilder();
    this.anomalyDetectorBuilder = new AnomalyDetectorBuilder();
    this.ensembleBuilder = new EnsembleBuilder(this.config, this.labelEncoder);

    // Initialize feature processing
    this.featureConverter = new FeatureConverter();
    this.featureScaler = new FeatureScaler();

    // Initialize services
    this.predictionService = new PredictionService(
      this.config,
      this.labelEncoder,
      this.featureConverter,
      this.featureScaler
    );

    this.similarityService = new SimilarityService(
      this.featureConverter,
      this.featureScaler,
      this.featureEngineering
    );

    this.anomalyDetectionService = new AnomalyDetectionService(
      this.featureConverter,
      this.featureScaler
    );

    this.trainingService = new TrainingService(
      this.labelEncoder,
      this.featureConverter,
      this.featureScaler
    );

    this.modelManager = new ModelManager(
      this.labelEncoder,
      this.featureConverter,
      this.featureScaler
    );
  }

  // ============================================================================
  // Model Building (Delegate to Builders)
  // ============================================================================

  async buildClassifier(inputDim: number): Promise<tf.Sequential> {
    await Promise.resolve(); // Maintain async contract for backward compatibility
    const model = this.classifierBuilder.buildClassifier(inputDim);
    this.predictionService.setClassifier(model);
    this.trainingService.setClassifier(model);
    return model;
  }

  async buildSimilarityModel(inputDim: number): Promise<tf.Sequential> {
    await Promise.resolve(); // Maintain async contract for backward compatibility
    const model = this.similarityModelBuilder.buildSimilarityModel(inputDim);
    this.similarityService.setSimilarityModel(model);
    this.trainingService.setSimilarityModel(model);
    return model;
  }

  async buildAnomalyDetector(inputDim: number): Promise<tf.Sequential> {
    await Promise.resolve(); // Maintain async contract for backward compatibility
    const model = this.anomalyDetectorBuilder.buildAnomalyDetector(inputDim);
    this.anomalyDetectionService.setAnomalyDetector(model);
    return model;
  }

  async buildEnsemble(inputDim: number): Promise<tf.Sequential[]> {
    await Promise.resolve(); // Maintain async contract for backward compatibility
    const models = this.ensembleBuilder.buildEnsemble(inputDim);
    this.predictionService.setEnsembleModels(models);
    return models;
  }

  // ============================================================================
  // Prediction (Delegate to PredictionService)
  // ============================================================================

  async classify(features: PatternFeatures): Promise<Prediction> {
    return this.predictionService.classify(features);
  }

  async classifyEnsemble(features: PatternFeatures): Promise<Prediction> {
    return this.predictionService.classifyEnsemble(features);
  }

  // ============================================================================
  // Similarity (Delegate to SimilarityService)
  // ============================================================================

  async calculateSimilarity(
    features1: PatternFeatures,
    features2: PatternFeatures
  ): Promise<number> {
    return this.similarityService.calculateSimilarity(features1, features2);
  }

  async findSimilarPatterns(
    features: PatternFeatures,
    patterns: Pattern[],
    threshold: number = 0.7
  ): Promise<PatternMatch[]> {
    return this.similarityService.findSimilarPatterns(features, patterns, threshold);
  }

  // ============================================================================
  // Anomaly Detection (Delegate to AnomalyDetectionService)
  // ============================================================================

  async detectAnomaly(features: PatternFeatures): Promise<number> {
    return this.anomalyDetectionService.detectAnomaly(features);
  }

  // ============================================================================
  // Training (Delegate to TrainingService)
  // ============================================================================

  async trainClassifier(
    features: PatternFeatures[],
    labels: PatternType[],
    epochs: number = 10,
    batchSize: number = 32
  ): Promise<tf.History> {
    return this.trainingService.trainClassifier(features, labels, epochs, batchSize);
  }

  async trainSimilarityModel(
    pairs: Array<{ features1: PatternFeatures, features2: PatternFeatures, similar: boolean }>,
    epochs: number = 10,
    batchSize: number = 32
  ): Promise<tf.History> {
    return this.trainingService.trainSimilarityModel(pairs, epochs, batchSize);
  }

  // ============================================================================
  // Model Management (Delegate to ModelManager)
  // ============================================================================

  async saveModel(model: tf.Sequential, path: string): Promise<void> {
    return this.modelManager.saveModel(model, path);
  }

  async loadModel(path: string): Promise<tf.Sequential> {
    return this.modelManager.loadModel(path);
  }

  async evaluateModel(
    model: tf.Sequential,
    features: PatternFeatures[],
    labels: PatternType[]
  ): Promise<{ accuracy: number; loss: number }> {
    return this.modelManager.evaluateModel(model, features, labels);
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  dispose(): void {
    this.predictionService.dispose();
    this.similarityService.dispose();
    this.anomalyDetectionService.dispose();
    this.trainingService.dispose();
    this.modelManager.dispose();
  }
}
