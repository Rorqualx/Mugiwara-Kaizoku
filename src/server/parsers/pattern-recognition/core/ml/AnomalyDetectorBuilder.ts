/**
 * Anomaly Detector Builder
 *
 * Builds autoencoder for anomaly detection via reconstruction error.
 * Uses encoder-decoder architecture with bottleneck.
 *
 * Extracted from: MLPipeline.ts (lines 161-213)
 */

import * as tf from '@tensorflow/tfjs-node';

export class AnomalyDetectorBuilder {
  /**
   * Build anomaly detection model
   *
   * Creates an autoencoder with symmetric encoder-decoder architecture.
   * The bottleneck layer (16 units) forces the model to learn compressed
   * representations. Anomalies are detected via reconstruction error.
   *
   * @param inputDim - Dimension of input feature vectors
   * @returns Compiled autoencoder model for anomaly detection
   */
  buildAnomalyDetector(inputDim: number): tf.Sequential {
    // Autoencoder for anomaly detection
    const model = tf.sequential({
      layers: [
        // Encoder
        tf.layers.dense({
          inputShape: [inputDim],
          units: 128,
          activation: 'relu'
        }),
        tf.layers.dense({
          units: 64,
          activation: 'relu'
        }),
        tf.layers.dense({
          units: 32,
          activation: 'relu'
        }),

        // Bottleneck
        tf.layers.dense({
          units: 16,
          activation: 'relu'
        }),

        // Decoder
        tf.layers.dense({
          units: 32,
          activation: 'relu'
        }),
        tf.layers.dense({
          units: 64,
          activation: 'relu'
        }),
        tf.layers.dense({
          units: 128,
          activation: 'relu'
        }),
        tf.layers.dense({
          units: inputDim,
          activation: 'linear'
        })
      ]
    });

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'meanSquaredError'
    });

    return model;
  }
}
