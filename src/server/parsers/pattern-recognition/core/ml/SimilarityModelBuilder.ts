/**
 * Similarity Model Builder
 *
 * Builds Siamese network for pattern similarity matching.
 * Uses concatenated feature vectors to predict similarity scores.
 *
 * Extracted from: MLPipeline.ts (lines 118-156)
 */

import * as tf from '@tensorflow/tfjs-node';

export class SimilarityModelBuilder {
  /**
   * Build similarity model for pattern matching
   * @param inputDim - Dimension of input feature vectors
   * @returns Compiled TensorFlow Sequential model
   */
  buildSimilarityModel(inputDim: number): tf.Sequential {
    const model = tf.sequential({
      layers: [
        // Siamese network architecture
        tf.layers.dense({
          inputShape: [inputDim * 2], // Concatenated feature vectors
          units: 256,
          activation: 'relu'
        }),
        tf.layers.dropout({ rate: 0.3 }),

        tf.layers.dense({
          units: 128,
          activation: 'relu'
        }),
        tf.layers.dropout({ rate: 0.2 }),

        tf.layers.dense({
          units: 64,
          activation: 'relu'
        }),

        // Output similarity score
        tf.layers.dense({
          units: 1,
          activation: 'sigmoid'
        })
      ]
    });

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'binaryCrossentropy',
      metrics: ['accuracy']
    });

    return model;
  }
}
