/**
 * Model Management Module
 *
 * Handles model persistence including checkpoints, final model saves,
 * and evaluation result storage.
 *
 * Extracted from: ModelTrainer.ts (lines 547-589)
 */

import fs from 'fs/promises';
import path from 'path';

import type { MLPipeline } from '@/server/parsers/pattern-recognition/core/MLPipeline';
import { logger } from '@/utils/logger';


export class ModelManager {
  private mlPipeline: MLPipeline;
  private modelsDir: string;

  constructor(mlPipeline: MLPipeline, modelsDir: string) {
    this.mlPipeline = mlPipeline;
    this.modelsDir = modelsDir;
  }

  /**
   * Initialize model directories
   */
  public async initialize(): Promise<void> {
    await fs.mkdir(this.modelsDir, { recursive: true });
    await fs.mkdir(path.join(this.modelsDir, 'checkpoints'), { recursive: true });
    await fs.mkdir(path.join(this.modelsDir, 'evaluation'), { recursive: true });
  }

  /**
   * Save model checkpoint
   */
  public async saveCheckpoint(modelName: string, epoch: number): Promise<void> {
    const checkpointPath = path.join(this.modelsDir, 'checkpoints', `${modelName}_epoch_${epoch}`);

    if (modelName === 'classifier') {
      const classifier = this.getClassifier();
      if (classifier) {
        await (classifier as unknown as { save: (path: string) => Promise<void> }).save(`file://${checkpointPath}`);
      }
    }
  }

  /**
   * Save all trained models
   */
  public async saveModels(): Promise<void> {
    logger.info('Saving models...');

    // Save classifier
    const classifier = this.getClassifier();
    if (classifier) {
      await (classifier as unknown as { save: (path: string) => Promise<void> }).save(`file://${path.join(this.modelsDir, 'classifier')}`);
    }

    // Save similarity model
    const similarityModel = this.getSimilarityModel();
    if (similarityModel) {
      await (similarityModel as unknown as { save: (path: string) => Promise<void> }).save(`file://${path.join(this.modelsDir, 'similarity')}`);
    }

    // Save anomaly detector
    const anomalyDetector = this.getAnomalyDetector();
    if (anomalyDetector) {
      await (anomalyDetector as unknown as { save: (path: string) => Promise<void> }).save(`file://${path.join(this.modelsDir, 'anomaly')}`);
    }

    logger.info('Models saved successfully');
  }

  /**
   * Save evaluation results to JSON
   */
  public async saveEvaluation(modelName: string, results: unknown): Promise<void> {
    const evaluationPath = path.join(this.modelsDir, 'evaluation', `${modelName}_evaluation.json`);
    const data = {
      ...(typeof results === 'object' && results !== null ? results : {}),
      evaluatedAt: new Date().toISOString()
    };
    await fs.writeFile(evaluationPath, JSON.stringify(data, null, 2));
  }

  /**
   * Get classifier from pipeline with type safety
   */
  private getClassifier(): unknown | null {
    const classifier = (this.mlPipeline as unknown as Record<string, unknown>)['classifier'];
    return classifier ?? null;
  }

  /**
   * Get similarity model from pipeline with type safety
   */
  private getSimilarityModel(): unknown | null {
    const similarityModel = (this.mlPipeline as unknown as Record<string, unknown>)['similarityModel'];
    return similarityModel ?? null;
  }

  /**
   * Get anomaly detector from pipeline with type safety
   */
  private getAnomalyDetector(): unknown | null {
    const anomalyDetector = (this.mlPipeline as unknown as Record<string, unknown>)['anomalyDetector'];
    return anomalyDetector ?? null;
  }
}
