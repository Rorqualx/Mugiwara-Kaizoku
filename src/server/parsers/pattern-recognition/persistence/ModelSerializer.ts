/**
 * Model Serializer
 *
 * Handles serialization and deserialization of TensorFlow.js models for database storage.
 * Provides versioning, compression, and validation for model weights.
 *
 * NOTE: ML models (learnedPattern, packDownload, mLModelWeight) are currently disabled.
 * See Agent 2 report from Wave 1 for implementation requirements.
 */

import { promisify } from 'util';
import zlib from 'zlib';

import * as tf from '@tensorflow/tfjs-node';

import { prisma as sharedPrisma } from '@/server/db';
import { logger } from '@/utils/logger';

import type { PrismaClient} from '@prisma/client';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

// Helper functions for safe type handling
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export interface ModelMetadata {
  modelType: 'classifier' | 'similarity' | 'anomaly' | 'embedding';
  version: string;
  architecture: unknown;
  hyperparameters: unknown;
  metrics: {
    accuracy?: number;
    loss?: number;
    precision?: number;
    recall?: number;
    f1Score?: number;
    trainingTime?: number;
    epochs?: number;
  };
  trainingData?: {
    samples: number;
    features: number;
    classes?: number;
    distribution?: Record<string, number>;
  };
}

export class ModelSerializer {
  private prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma ?? sharedPrisma;
  }

  /**
   * Save TensorFlow.js model to database
   */
  saveModel(
  model: tf.LayersModel | tf.Sequential,
  metadata: ModelMetadata,
  patternId?: string)
  : Promise<string> {
    // TODO: Add ML models to schema (see Agent 2 report from Wave 1)
    logger.warn('ML pattern recognition disabled - mLModelWeight model not in schema');
    logger.debug('Model would be saved:', {
      modelType: metadata.modelType,
      version: metadata.version,
      patternId
    });

    // Fallback: Return a dummy model ID
    const dummyId = `ml-disabled-${Date.now()}`;
    return Promise.resolve(dummyId);

    /* Disabled until ML models added to schema:
    try {
      // Serialize model to memory
      const modelData = await this.serializeModel(model);

      // Compress model weights
      const modelDataRecord = modelData as Record<string, unknown>;
      const weightData = modelDataRecord['weightData'] as ArrayBuffer;
      const compressedWeights = await this.compressWeights(weightData);

      // Get model architecture
      const architecture = model.toJSON();

      // Create database entry
      const createData: Prisma.MLModelWeightCreateInput = {
        modelType: metadata.modelType,
        modelVersion: metadata.version,
        weights: compressedWeights,
        architecture: architecture as Prisma.InputJsonValue,
        hyperparameters: (metadata.hyperparameters ?? {}) as Prisma.InputJsonValue,
        metrics: metadata.metrics as Prisma.InputJsonValue,
        isActive: false // Set to active after validation
      };

      if (metadata.trainingData !== undefined) {
        createData.trainingData = metadata.trainingData as Prisma.InputJsonValue;
      }

      if (patternId !== undefined) {
        createData.pattern = {
          connect: { id: patternId }
        };
      }

      const savedModel = await this.prisma.mLModelWeight.create({
        data: createData
      });

      // Validate saved model
      const isValid = await this.validateSavedModel(savedModel["id"], model);

      if (isValid) {
        // Mark as active
        await this.prisma.mLModelWeight.update({
          where: { id: savedModel["id"] },
          data: { isActive: true }
        });
      }

      return savedModel["id"];
    } catch (error: unknown) {
      console.error('Error saving model:', error);
      throw error;
    }
    */
  }

  /**
   * Load TensorFlow.js model from database
   */
  loadModel(modelId: string): Promise<tf.LayersModel | null> {
    // TODO: Add ML models to schema (see Agent 2 report from Wave 1)
    logger.warn('ML pattern recognition disabled - mLModelWeight model not in schema');
    logger.debug('Model load requested:', { modelId });

    // Fallback: Return null (no models available)
    return Promise.resolve(null);

    /* Disabled until ML models added to schema:
    try {
      const savedModel = await this.prisma.mLModelWeight.findUnique({
        where: { id: modelId }
      });

      if (!savedModel) {
        console.error('Model not found:', modelId);
        return null;
      }

      // Decompress weights
      const weightData = await this.decompressWeights(Buffer.from(savedModel.weights));

      // Reconstruct model from architecture and weights
      const model = await this.deserializeModel(
        savedModel.architecture as Record<string, unknown>,
        weightData
      );

      return model;
    } catch (error: unknown) {
      console.error('Error loading model:', error);
      return null;
    }
    */
  }

  /**
   * Load the latest active model of a specific type
   */
  loadLatestModel(modelType: string): Promise<tf.LayersModel | null> {
    // TODO: Add ML models to schema (see Agent 2 report from Wave 1)
    logger.warn('ML pattern recognition disabled - mLModelWeight model not in schema');
    logger.debug('Latest model load requested:', { modelType });

    // Fallback: Return null (no models available)
    return Promise.resolve(null);

    /* Disabled until ML models added to schema:
    try {
      const latestModel = await this.prisma.mLModelWeight.findFirst({
        where: {
          modelType,
          isActive: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      if (!latestModel) {
        logger.info(`No active ${modelType} model found`);
        return null;
      }

      return this.loadModel(latestModel["id"]);
    } catch (error: unknown) {
      console.error('Error loading latest model:', error);
      return null;
    }
    */
  }

  /**
   * Save model checkpoint during training
   */
  saveCheckpoint(
  model: tf.LayersModel,
  epoch: number,
  metrics: unknown,
  modelType: string)
  : Promise<void> {
    // TODO: Add ML models to schema (see Agent 2 report from Wave 1)
    logger.warn('ML pattern recognition disabled - mLModelWeight model not in schema');
    logger.debug('Checkpoint save requested:', { modelType, epoch });

    // Fallback: No-op (checkpoints not saved)
    return Promise.resolve();

    /* Disabled until ML models added to schema:
    try {
      const checkpointId = `checkpoint_${modelType}_epoch_${epoch}`;

      // Save as temporary model
      const metricsRecord = isRecord(metrics) ? metrics : {};
      await this.saveModel(
        model,
        {
          modelType: modelType as unknown as never,
          version: `checkpoint_${epoch}`,
          architecture: model.toJSON(),
          hyperparameters: {},
          metrics: {
            ...metricsRecord,
            epochs: epoch
          }
        }
      );

      // Keep only last 5 checkpoints
      await this.cleanupOldCheckpoints(modelType, 5);
    } catch (error: unknown) {
      console.error('Error saving checkpoint:', error);
    }
    */
  }

  /**
   * Export model to file system
   */
  async exportModel(modelId: string, outputPath: string): Promise<void> {
    try {
      const model = await this.loadModel(modelId);
      if (!model) {
        throw new Error('Model not found');
      }

      // Save to file system
      await model.save(`file://${outputPath}`);
      logger.info(`Model exported to ${outputPath}`);
    } catch (error: unknown) {
      console.error('Error exporting model:', error);
      throw error;
    }
  }

  /**
   * Import model from file system
   */
  async importModel(
  modelPath: string,
  metadata: ModelMetadata)
  : Promise<string> {
    try {
      // Load model from file
      const model = await tf.loadLayersModel(`file://${modelPath}/model.json`);

      // Save to database
      const modelId = await this.saveModel(model, metadata);

      logger.info(`Model imported with ID: ${modelId}`);
      return modelId;
    } catch (error: unknown) {
      console.error('Error importing model:', error);
      throw error;
    }
  }

  /**
   * Compare two models
   */
  compareModels(modelId1: string, modelId2: string): Promise<unknown> {
    // TODO: Add ML models to schema (see Agent 2 report from Wave 1)
    logger.warn('ML pattern recognition disabled - mLModelWeight model not in schema');
    logger.debug('Model comparison requested:', { modelId1, modelId2 });

    // Fallback: Return empty comparison
    return Promise.resolve({
      error: 'ML models disabled',
      mlDisabled: true
    });

    /* Disabled until ML models added to schema:
    try {
      const [model1Data, model2Data] = await Promise.all([
      this.prisma.mLModelWeight.findUnique({ where: { id: modelId1 } }),
      this.prisma.mLModelWeight.findUnique({ where: { id: modelId2 } })]
      );

      if (!model1Data || !model2Data) {
        throw new Error('One or both models not found');
      }

      const metrics1 = model1Data.metrics as Record<string, unknown>;
      const metrics2 = model2Data.metrics as Record<string, unknown>;
      const accuracy1 = typeof metrics1['accuracy'] === 'number' ? metrics1['accuracy'] : 0;
      const accuracy2 = typeof metrics2['accuracy'] === 'number' ? metrics2['accuracy'] : 0;
      const loss1 = typeof metrics1['loss'] === 'number' ? metrics1['loss'] : 0;
      const loss2 = typeof metrics2['loss'] === 'number' ? metrics2['loss'] : 0;

      return {
        model1: {
          id: modelId1,
          version: model1Data.modelVersion,
          metrics: model1Data.metrics,
          created: model1Data.createdAt
        },
        model2: {
          id: modelId2,
          version: model2Data.modelVersion,
          metrics: model2Data.metrics,
          created: model2Data.createdAt
        },
        comparison: {
          accuracyDiff: accuracy2 - accuracy1,
          lossDiff: loss2 - loss1,
          sizeDiff: model2Data.weights.length - model1Data.weights.length
        }
      };
    } catch (error: unknown) {
      console.error('Error comparing models:', error);
      throw error;
    }
    */
  }

  /**
   * Get model history
   */
  getModelHistory(modelType: string, limit: number = 10): Promise<unknown[]> {
    // TODO: Add ML models to schema (see Agent 2 report from Wave 1)
    logger.warn('ML pattern recognition disabled - mLModelWeight model not in schema');
    logger.debug('Model history requested:', { modelType, limit });

    // Fallback: Return empty array
    return Promise.resolve([]);

    /* Disabled until ML models added to schema:
    try {
      const models = await this.prisma.mLModelWeight.findMany({
        where: { modelType },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          modelVersion: true,
          metrics: true,
          isActive: true,
          createdAt: true,
          updatedAt: true
        }
      });

      return models;
    } catch (error: unknown) {
      console.error('Error getting model history:', error);
      return [];
    }
    */
  }

  /**
   * Activate a specific model version
   */
  activateModel(modelId: string): Promise<void> {
    // TODO: Add ML models to schema (see Agent 2 report from Wave 1)
    logger.warn('ML pattern recognition disabled - mLModelWeight model not in schema');
    logger.debug('Model activation requested:', { modelId });

    // Fallback: No-op (no models to activate)
    return Promise.resolve();

    /* Disabled until ML models added to schema:
    try {
      const model = await this.prisma.mLModelWeight.findUnique({
        where: { id: modelId }
      });

      if (!model) {
        throw new Error('Model not found');
      }

      // Deactivate all other models of the same type
      await this.prisma.mLModelWeight.updateMany({
        where: {
          modelType: model.modelType,
          id: { not: modelId }
        },
        data: { isActive: false }
      });

      // Activate this model
      await this.prisma.mLModelWeight.update({
        where: { id: modelId },
        data: { isActive: true }
      });

      logger.info(`Model ${modelId} activated`);
    } catch (error: unknown) {
      console.error('Error activating model:', error);
      throw error;
    }
    */
  }

  /**
   * Serialize model to memory
   */
  private async serializeModel(model: tf.LayersModel): Promise<unknown> {
    // Save model to memory buffer
    // Type for TensorFlow.js save handler
    interface SaveHandler {
      save: (modelArtifacts: {
        modelTopology?: unknown;
        weightSpecs?: unknown[];
        weightData?: ArrayBuffer;
        format?: string;
        generatedBy?: string;
        convertedBy?: string | null;
      }) => Promise<{
        modelArtifactsInfo: {
          dateSaved: Date;
          modelTopologyType: 'JSON';
          weightDataBytes: number;
        };
      }>;
    }

    const saveHandler: SaveHandler = {
      save: (modelArtifacts) => {
        return Promise.resolve({
          modelArtifactsInfo: {
            dateSaved: new Date(),
            modelTopologyType: 'JSON' as const,
            weightDataBytes: modelArtifacts.weightData?.byteLength ?? 0
          }
        });
      }
    };

    // TensorFlow.js save() accepts IOHandler which has save method
    // We use double assertion since tf.io namespace is not properly exported in type definitions
    const saveResult = await model.save(saveHandler as unknown as string);
    if (!isRecord(saveResult) || !isRecord(saveResult['modelArtifacts'])) {
      throw new Error('Invalid save result');
    }
    return saveResult['modelArtifacts'];
  }

  /**
   * Deserialize model from memory
   */
  private async deserializeModel(
  architecture: Record<string, unknown>,
  weightData: Buffer)
  : Promise<tf.LayersModel> {
    // Create model artifacts
    const modelArtifacts: Record<string, unknown> = {
      modelTopology: architecture["modelTopology"] || architecture,
      weightSpecs: architecture["weightSpecs"] ?? [],
      weightData: new Uint8Array(weightData).buffer,
      format: architecture["format"] || 'layers-model',
      generatedBy: architecture["generatedBy"] || 'TensorFlow.js',
      convertedBy: architecture["convertedBy"] ?? null
    };

    // Type for TensorFlow.js load handler
    interface LoadHandler {
      load: () => Promise<Record<string, unknown>>;
    }

    // Load model from artifacts
    const loadHandler: LoadHandler = {
      load: () => Promise.resolve(modelArtifacts)
    };

    // TensorFlow.js loadLayersModel accepts IOHandler which has load method
    // The type signature requires string | IOHandler, our custom handler is compatible
    return tf.loadLayersModel(loadHandler as unknown as string);
  }

  /**
   * Compress model weights
   */
  private async compressWeights(weightData: ArrayBuffer): Promise<Buffer> {
    const buffer = Buffer.from(weightData);
    const compressed = await gzip(buffer);
    return compressed;
  }

  /**
   * Decompress model weights
   */
  private async decompressWeights(compressedData: Buffer): Promise<Buffer> {
    const decompressed = await gunzip(compressedData);
    return decompressed;
  }

  /**
   * Validate saved model
   */
  private async validateSavedModel(
  modelId: string,
  originalModel: tf.LayersModel)
  : Promise<boolean> {
    try {
      // Load the saved model
      const loadedModel = await this.loadModel(modelId);

      if (!loadedModel) {
        return false;
      }

      // Compare architectures
      const originalArch = JSON.stringify(originalModel.toJSON());
      const loadedArch = JSON.stringify(loadedModel.toJSON());

      if (originalArch !== loadedArch) {
        console.error('Model architecture mismatch');
        return false;
      }

      // Test with dummy input
      const firstInput = originalModel.inputs[0];
      if (!firstInput) {
        console.error('Model has no inputs');
        return false;
      }
      const inputShape = firstInput.shape.slice(1);
      const testInput = tf.randomNormal([1, ...(inputShape as number[])]);

      const originalOutput = originalModel.predict(testInput) as tf.Tensor;
      const loadedOutput = loadedModel.predict(testInput) as tf.Tensor;

      // Compare outputs
      const diff = tf.abs(tf.sub(originalOutput, loadedOutput));
      const maxDiff = await diff.max().data();

      // Clean up tensors
      testInput.dispose();
      originalOutput.dispose();
      loadedOutput.dispose();
      diff.dispose();

      // Allow small numerical differences
      const firstMaxDiff = maxDiff[0];
      const isValid = firstMaxDiff !== undefined && firstMaxDiff < 1e-5;

      if (!isValid) {
        console.error('Model output mismatch, max diff:', maxDiff[0]);
      }

      return isValid;
    } catch (error: unknown) {
      console.error('Error validating model:', error);
      return false;
    }
  }

  /**
   * Cleanup old checkpoints
   */
  private cleanupOldCheckpoints(
  _modelType: string,
  _keepCount: number)
  : Promise<void> {
    // TODO: Add ML models to schema (see Agent 2 report from Wave 1)
    logger.warn('ML pattern recognition disabled - mLModelWeight model not in schema');

    // Fallback: No-op (no checkpoints to clean)
    return Promise.resolve();

    /* Disabled until ML models added to schema:
    try {
      const checkpoints = await this.prisma.mLModelWeight.findMany({
        where: {
          modelType,
          modelVersion: { contains: 'checkpoint' }
        },
        orderBy: { createdAt: 'desc' }
      });

      if (checkpoints.length > keepCount) {
        const toDelete = checkpoints.slice(keepCount);

        await this.prisma.mLModelWeight.deleteMany({
          where: {
            id: { in: toDelete.map((c: typeof toDelete[number]) => c["id"]) }
          }
        });

        logger.info(`Deleted ${toDelete.length} old checkpoints`);
      }
    } catch (error: unknown) {
      console.error('Error cleaning up checkpoints:', error);
    }
    */
  }

  /**
   * Get model statistics
   */
  getModelStatistics(): Promise<unknown> {
    // TODO: Add ML models to schema (see Agent 2 report from Wave 1)
    logger.warn('ML pattern recognition disabled - mLModelWeight model not in schema');

    // Fallback: Return empty statistics with disabled flag
    return Promise.resolve({
      modelsByType: [],
      storage: { totalSize: 0, avgSize: 0 },
      mlDisabled: true
    });

    /* Disabled until ML models added to schema:
    try {
      const stats = await this.prisma.mLModelWeight.groupBy({
        by: ['modelType'],
        _count: true,
        _max: {
          createdAt: true
        }
      });

      const totalSize = await this.prisma.$queryRaw`
        SELECT
          SUM(LENGTH(weights)) as totalSize,
          AVG(LENGTH(weights)) as avgSize
        FROM "MLModelWeight"
      `;

      return {
        modelsByType: stats,
        storage: totalSize
      };
    } catch (error: unknown) {
      console.error('Error getting model statistics:', error);
      return {};
    }
    */
  }
}