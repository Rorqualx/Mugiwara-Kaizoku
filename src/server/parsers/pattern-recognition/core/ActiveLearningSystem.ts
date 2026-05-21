/**
 * Active Learning System
 *
 * Continuously learns from both successes and failures to improve
 * pattern recognition accuracy. Implements uncertainty sampling,
 * feedback loops, and automatic retraining.
 *
 * Architecture:
 * - Core learning logic (this file)
 * - Queue management (./active-learning/queue-management.ts)
 * - Data preparation (./active-learning/data-preparation.ts)
 * - Metrics calculation (./active-learning/metrics-calculator.ts)
 * - Training orchestration (./active-learning/training-orchestrator.ts)
 * - Statistics (./active-learning/statistics.ts)
 */

import { logger } from '@/utils/logger';

import { prepareTrainingData } from './active-learning/data-preparation';
import {
  updateMetrics as updateMetricsCalculator,
  getMetrics as getMetricsCalculator
} from './active-learning/metrics-calculator';
import { manageLearningQueue } from './active-learning/queue-management';
import {
  getStatistics as getStatsData,
  exportLearningData as exportData,
  createInitialMetrics as _createInitialMetrics,
  type LearningStatistics
} from './active-learning/statistics';
import {
  shouldRetrain as shouldRetrainCheck,
  retrain as _retrainModel,
  trainSimilarityModel as trainSimilarity
} from './active-learning/training-orchestrator';
import { FeatureEngineering } from './FeatureEngineering';
import { MLPipeline } from './MLPipeline';
import { PatternEvolutionManager } from './PatternEvolutionManager';

// Import all extracted modules

import type {
  PatternFeatures,
  PatternType,
  LearningExample,
  UserFeedback,
  LearningMetrics,
  Prediction
} from '../types';

export class ActiveLearningSystem {
  private featureEngineering: FeatureEngineering;
  private mlPipeline: MLPipeline;
  private evolutionManager: PatternEvolutionManager;
  
  // Learning data
  private learningExamples: LearningExample[] = [];
  private uncertainExamples: LearningExample[] = [];
  private feedbackQueue: UserFeedback[] = [];
  
  // Configuration
  private uncertaintyThreshold = 0.5;
  private batchSize = 32;
  private retrainThreshold = 100;
  private maxExamples = 10000;
  private minConfidenceForAutoLabel = 0.95;
  
  // Metrics
  private metrics: LearningMetrics = {
    accuracy: 0,
    precision: 0,
    recall: 0,
    f1Score: 0,
    confusionMatrix: [],
    learningCurve: []
  };
  
  // State
  private examplesSinceRetrain = 0;
  private isTraining = false;

  constructor() {
    this.featureEngineering = new FeatureEngineering();
    this.mlPipeline = new MLPipeline();
    this.evolutionManager = new PatternEvolutionManager();
  }

  /**
   * Learn from a new example
   */
  async learn(
    html: string,
    features: PatternFeatures,
    prediction: Prediction,
    actualLabel?: string,
    feedback?: UserFeedback
  ): Promise<void> {
    // Create learning example
    const example: LearningExample = {
      id: `ex_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      html,
      features,
      label: actualLabel ?? prediction.label,
      correct: actualLabel ? actualLabel === prediction.label : true,
      ...(feedback !== undefined ? { feedback } : {}),
      timestamp: new Date()
    };
    
    // Add to appropriate queue
    if (this.isUncertain(prediction)) {
      this.uncertainExamples.push(example);
      
      // Request human feedback for uncertain examples
      if (!feedback && !actualLabel) {
        await this.requestHumanFeedback(example);
      }
    } else if (!example.correct || feedback) {
      // Prioritize incorrect predictions and user feedback
      this.learningExamples.unshift(example);
    } else {
      // Add correct predictions to reinforce learning
      this.learningExamples.push(example);
    }
    
    // Manage queue size
    this.manageLearningQueue();
    
    // Update metrics
    this.updateMetrics(example, prediction);
    
    // Check if retraining is needed
    this.examplesSinceRetrain++;
    if (this.shouldRetrain()) {
      await this.retrain();
    }
  }

  /**
   * Check if prediction is uncertain
   */
  private isUncertain(prediction: Prediction): boolean {
    // Check if confidence is below threshold
    if (prediction.confidence < this.uncertaintyThreshold) {
      return true;
    }
    
    // Check if top two predictions are close
    const probs = Object.values(prediction.probabilities).sort((a, b) => b - a);
    const firstProb = probs[0];
    const secondProb = probs[1];
    if (probs.length >= 2 && firstProb !== undefined && secondProb !== undefined && firstProb - secondProb < 0.2) {
      return true;
    }
    
    return false;
  }

  /**
   * Request human feedback for uncertain example
   */
  private requestHumanFeedback(example: LearningExample): Promise<void> {
    // In a real system, this would notify a human reviewer
    // For now, we'll store it for batch review
    logger.info(`Uncertain example requires review: ${example.id}`);

    // Note: Feedback will be added when processFeedback() is called
    // This avoids param reassignment violation

    return Promise.resolve();
  }

  /**
   * Process user feedback
   */
  async processFeedback(
    exampleId: string,
    feedback: UserFeedback
  ): Promise<void> {
    // Find example using nullish coalescing
    let example = this.uncertainExamples.find(e => e.id === exampleId);
    example ??= this.learningExamples.find(e => e.id === exampleId);

    if (!example) {
      logger.warn(`Example ${exampleId} not found`);
      return;
    }

    // Create updated example to avoid param reassignment
    const updatedExample: LearningExample = {
      ...example,
      feedback,
      correct: feedback.correct,
      label: feedback.correctedLabel ?? example.label
    };

    // Move from uncertain to learning queue
    const uncertainIndex = this.uncertainExamples.indexOf(example);
    if (uncertainIndex >= 0) {
      this.uncertainExamples.splice(uncertainIndex, 1);
      this.learningExamples.unshift(updatedExample); // Prioritize
    } else {
      // Update in learning examples
      const learningIndex = this.learningExamples.indexOf(example);
      if (learningIndex >= 0) {
        this.learningExamples[learningIndex] = updatedExample;
      }
    }

    // Store feedback
    this.feedbackQueue.push(feedback);

    // Trigger immediate retraining if significant feedback
    if (!feedback.correct && feedback.confidence > 0.8) {
      await this.retrain();
    }
  }

  /**
   * Manage learning queue size
   */
  private manageLearningQueue(): void {
    const result = manageLearningQueue(
      this.learningExamples,
      this.uncertainExamples,
      this.maxExamples
    );
    this.learningExamples = result.learningExamples;
    this.uncertainExamples = result.uncertainExamples;
  }

  /**
   * Check if retraining is needed
   */
  private shouldRetrain(): boolean {
    return shouldRetrainCheck({
      isTraining: this.isTraining,
      examplesSinceRetrain: this.examplesSinceRetrain,
      retrainThreshold: this.retrainThreshold,
      metrics: this.metrics,
      learningExamplesCount: this.learningExamples.length,
      uncertainExamplesCount: this.uncertainExamples.length
    });
  }

  /**
   * Retrain models with accumulated examples
   */
  private async retrain(): Promise<void> {
    if (this.isTraining || this.learningExamples.length < this.batchSize) {
      return;
    }

    logger.info('Starting model retraining...');
    this.isTraining = true;

    try {
      const trainingExamples = prepareTrainingData(
        this.learningExamples,
        this.uncertainExamples
      );

      const features = trainingExamples.map(e => e.features);
      const labels = trainingExamples.map(e => e.label as PatternType);

      const history = await this.mlPipeline.trainClassifier(
        features,
        labels,
        10,
        this.batchSize
      );

      const loss = (history.history as unknown as Record<string, number[]>)['loss'] ?? [];
      this.metrics.learningCurve.push(...loss);

      await trainSimilarity(
        this.mlPipeline,
        this.learningExamples,
        this.batchSize
      );

      this.examplesSinceRetrain = 0;
      logger.info('Model retraining completed');
    } catch (error: unknown) {
      logger.error('Retraining failed:', { error });
    } finally {
      this.isTraining = false;
    }
  }

  /**
   * Update learning metrics
   */
  private updateMetrics(example: LearningExample, prediction: Prediction): void {
    this.metrics = updateMetricsCalculator(this.metrics, example, prediction);
  }

  /**
   * Get learning metrics
   */
  getMetrics(): LearningMetrics {
    return getMetricsCalculator(this.metrics);
  }

  /**
   * Get learning statistics
   */
  getStatistics(): LearningStatistics {
    return getStatsData(
      this.learningExamples,
      this.uncertainExamples,
      this.examplesSinceRetrain,
      this.isTraining
    );
  }

  /**
   * Export learning data for analysis
   */
  exportLearningData(): ReturnType<typeof exportData> {
    return exportData(
      this.learningExamples,
      this.metrics,
      this.getStatistics()
    );
  }

  /**
   * Import learning data
   */
  importLearningData(data: {
    examples: LearningExample[],
    metrics?: LearningMetrics
  }): void {
    this.learningExamples = data.examples;
    if (data.metrics) {
      this.metrics = data.metrics;
    }

    // Trigger retraining with imported data
    void this.retrain();
  }

  /**
   * Clear learning data
   */
  clearLearningData(): void {
    this.learningExamples = [];
    this.uncertainExamples = [];
    this.feedbackQueue = [];
    this.examplesSinceRetrain = 0;
    this.metrics = {
      accuracy: 0,
      precision: 0,
      recall: 0,
      f1Score: 0,
      confusionMatrix: [],
      learningCurve: []
    };
  }
}