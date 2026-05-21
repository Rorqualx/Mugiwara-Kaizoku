/**
 * Ensemble Model Builder
 *
 * Builds multiple classifier variants for ensemble predictions.
 * Each model has slightly different architecture for diversity.
 *
 * Extracted from: MLPipeline.ts (lines 218-255)
 */

import * as tf from '@tensorflow/tfjs-node';

import { LabelEncoder } from './ml-utils';

import type { MLConfig } from './ml-utils';

export class EnsembleBuilder {
  private config: MLConfig;
  private labelEncoder: LabelEncoder;

  constructor(config: MLConfig, labelEncoder: LabelEncoder) {
    this.config = config;
    this.labelEncoder = labelEncoder;
  }

  /**
   * Build ensemble of models for robust predictions
   * @param inputDim - Dimension of input feature vectors
   * @returns Array of compiled models
   */
  buildEnsemble(inputDim: number): tf.Sequential[] {
    const ensembleModels: tf.Sequential[] = [];

    for (let i = 0; i < this.config.ensembleSize; i++) {
      const model = tf.sequential({
        layers: [
          tf.layers.dense({
            inputShape: [inputDim],
            units: 200 + i * 20, // Vary architecture
            activation: 'relu',
            kernelInitializer: 'heNormal'
          }),
          tf.layers.dropout({ rate: 0.3 + i * 0.05 }),

          tf.layers.dense({
            units: 100 + i * 10,
            activation: 'relu'
          }),
          tf.layers.dropout({ rate: 0.2 }),

          tf.layers.dense({
            units: this.labelEncoder.size,
            activation: 'softmax'
          })
        ]
      });

      model.compile({
        optimizer: tf.train.adam(0.001 - i * 0.0002),
        loss: 'categoricalCrossentropy',
        metrics: ['accuracy']
      });

      ensembleModels.push(model);
    }

    return ensembleModels;
  }
}
