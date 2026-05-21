/**
 * Classifier Model Builder
 *
 * Builds and compiles neural network classifier for pattern type prediction.
 * Uses deep learning with dropout and batch normalization for improved generalization.
 *
 * Extracted from: MLPipeline.ts (lines 68-113)
 */

import * as tf from '@tensorflow/tfjs-node';

export class ClassifierBuilder {
  private labelEncoderSize: number;

  constructor(labelEncoderSize: number) {
    this.labelEncoderSize = labelEncoderSize;
  }

  /**
   * Build and compile the pattern classifier model
   * @param inputDim - Dimension of input feature vectors
   * @returns Compiled TensorFlow Sequential model
   */
  buildClassifier(inputDim: number): tf.Sequential {
    const model = tf.sequential({
      layers: [
        // Input layer with dropout
        tf.layers.dense({
          inputShape: [inputDim],
          units: 256,
          activation: 'relu',
          kernelInitializer: 'heNormal'
        }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.batchNormalization(),

        // Hidden layers with residual connections
        tf.layers.dense({
          units: 128,
          activation: 'relu',
          kernelInitializer: 'heNormal'
        }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.batchNormalization(),

        tf.layers.dense({
          units: 64,
          activation: 'relu',
          kernelInitializer: 'heNormal'
        }),
        tf.layers.dropout({ rate: 0.2 }),

        // Output layer
        tf.layers.dense({
          units: this.labelEncoderSize,
          activation: 'softmax'
        })
      ]
    });

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });

    return model;
  }
}
