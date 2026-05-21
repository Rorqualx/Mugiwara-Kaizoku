/**
 * ModelTrainer Type Definitions
 *
 * Shared type definitions and interfaces used across all ModelTrainer modules.
 *
 * Extracted from: ModelTrainer.ts (lines 21-40)
 */

/**
 * Training configuration options
 */
export interface TrainingConfig {
  /** Number of training epochs */
  epochs: number;
  /** Training batch size */
  batchSize: number;
  /** Learning rate for optimizer */
  learningRate: number;
  /** Fraction of data used for validation (0-1) */
  validationSplit: number;
  /** Whether to use early stopping */
  earlyStopping: boolean;
  /** Patience epochs for early stopping */
  patience: number;
  /** Whether to log training progress */
  verbose: boolean;
}

/**
 * Training result metrics
 */
export interface TrainingResult {
  /** Identifier for the trained model */
  modelId: string;
  /** Training accuracy (0-1) */
  accuracy: number;
  /** Training loss value */
  loss: number;
  /** Validation accuracy (0-1) */
  validationAccuracy: number;
  /** Validation loss value */
  validationLoss: number;
  /** Confusion matrix for classification models */
  confusionMatrix: number[][];
  /** Training duration in milliseconds */
  trainingTime: number;
  /** Hyperparameters used for training */
  hyperparameters: TrainingConfig;
}
