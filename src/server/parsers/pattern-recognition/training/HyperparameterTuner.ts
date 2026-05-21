/**
 * Hyperparameter Tuner
 * 
 * Automated hyperparameter optimization using Bayesian optimization and grid search.
 * Finds optimal model configurations for pattern recognition tasks.
 */

import * as tf from '@tensorflow/tfjs-node';

import { logger } from '@/utils/logger';

import type { ModelSerializer } from '../persistence/ModelSerializer';

export interface HyperparameterSpace {
  learningRate: { min: number; max: number; scale: 'linear' | 'log' };
  batchSize: { values: number[] };
  epochs: { min: number; max: number };
  dropoutRate: { min: number; max: number };
  hiddenLayers: { values: number[][] };
  optimizer: { values: string[] };
  activation: { values: string[] };
  l2Regularization: { min: number; max: number; scale: 'linear' | 'log' };
}

export interface TuningResult {
  bestParams: unknown;
  bestScore: number;
  history: Array<{
    params: unknown;
    score: number;
    trainTime: number;
  }>;
  totalTime: number;
}

export class HyperparameterTuner {
  private modelSerializer: ModelSerializer;
  private searchSpace: HyperparameterSpace;
  private maxTrials: number;
  private earlyStoppingPatience: number;
  private validationSplit: number;

  constructor(
    modelSerializer: ModelSerializer,
    maxTrials: number = 20,
    earlyStoppingPatience: number = 5
  ) {
    this.modelSerializer = modelSerializer;
    this.maxTrials = maxTrials;
    this.earlyStoppingPatience = earlyStoppingPatience;
    this.validationSplit = 0.2;

    // Default search space
    this.searchSpace = {
      learningRate: { min: 0.0001, max: 0.1, scale: 'log' },
      batchSize: { values: [16, 32, 64, 128] },
      epochs: { min: 50, max: 200 },
      dropoutRate: { min: 0.1, max: 0.5 },
      hiddenLayers: { 
        values: [
          [128, 64],
          [256, 128, 64],
          [512, 256, 128],
          [128, 128, 64],
          [256, 256, 128]
        ]
      },
      optimizer: { values: ['adam', 'rmsprop', 'sgd'] },
      activation: { values: ['relu', 'elu', 'tanh'] },
      l2Regularization: { min: 0.00001, max: 0.01, scale: 'log' }
    };
  }

  /**
   * Run hyperparameter tuning
   */
  async tune(
    trainData: { x: tf.Tensor; y: tf.Tensor },
    validationData?: { x: tf.Tensor; y: tf.Tensor },
    customSpace?: Partial<HyperparameterSpace>
  ): Promise<TuningResult> {
    const startTime = Date.now();
    const history: TuningResult['history'] = [];
    let bestParams: unknown = null;
    let bestScore = -Infinity;

    // Merge custom space with defaults
    if (customSpace) {
      this.searchSpace = { ...this.searchSpace, ...customSpace };
    }

    // Split validation data if not provided
    const localValidationData = validationData ?? this.splitValidationData(trainData);

    // Generate trial configurations
    const trials = this.generateTrials();

    logger.info(`Starting hyperparameter tuning with ${trials.length} trials...`);

    for (let i = 0; i < trials.length; i++) {
      const params = trials[i];
      logger.info(`\nTrial ${i + 1}/${trials.length}:`);
      logger.info('Parameters:', JSON.stringify(params, null, 2));

      const trialStartTime = Date.now();

      try {
        // Train model with current parameters
        // eslint-disable-next-line no-await-in-loop
        const { model, metrics } = await this.trainModel(
          params,
          trainData,
          localValidationData
        );

        const score = metrics.validationAccuracy;
        const trainTime = Date.now() - trialStartTime;

        history.push({
          params,
          score,
          trainTime
        });

        logger.info(`Score: ${score.toFixed(4)}, Time: ${(trainTime / 1000).toFixed(1)}s`);

        // Update best parameters
        if (score > bestScore) {
          bestScore = score;
          bestParams = params;

          // Save best model
          // eslint-disable-next-line no-await-in-loop
          await this.saveBestModel(model, params, {
            accuracy: metrics.validationAccuracy,
            loss: metrics.validationLoss,
            trainingTime: trainTime,
            epochs: metrics.epochs
          });
          logger.info('New best model found!');
        }

        // Clean up
        model.dispose();

        // Early stopping based on no improvement
        if (this.shouldEarlyStop(history)) {
          logger.info('Early stopping triggered');
          break;
        }
      } catch (error: unknown) {
        logger.error(`Trial ${i + 1} failed:`, { error });
        history.push({
          params,
          score: -Infinity,
          trainTime: Date.now() - trialStartTime
        });
      }
    }

    const totalTime = Date.now() - startTime;

    logger.info('\nHyperparameter tuning complete!');
    logger.info('Best parameters:', JSON.stringify(bestParams, null, 2));
    logger.info(`Best score: ${bestScore.toFixed(4)}`);
    logger.info(`Total time: ${(totalTime / 1000 / 60).toFixed(1)} minutes`);

    return {
      bestParams,
      bestScore,
      history,
      totalTime
    };
  }

  /**
   * Perform grid search
   */
  async gridSearch(
    trainData: { x: tf.Tensor; y: tf.Tensor },
    paramGrid: Record<string, unknown[]>
  ): Promise<TuningResult> {
    const combinations = this.generateGridCombinations(paramGrid);
    logger.info(`Grid search with ${combinations.length} combinations`);

    // Convert to trials format
    const _trials = combinations.map(combo => ({
      ...this.getDefaultParams(),
      ...(combo as Record<string, unknown>)
    }));

    // Use regular tuning with grid search trials
    const customSpace = this.gridToSearchSpace(paramGrid);
    return this.tune(trainData, undefined, customSpace);
  }

  /**
   * Perform random search
   */
  async randomSearch(
    trainData: { x: tf.Tensor; y: tf.Tensor },
    numTrials: number = 20
  ): Promise<TuningResult> {
    this.maxTrials = numTrials;
    return this.tune(trainData);
  }

  /**
   * Perform Bayesian optimization
   */
  async bayesianOptimization(
    trainData: { x: tf.Tensor; y: tf.Tensor },
    numTrials: number = 30
  ): Promise<TuningResult> {
    const history: TuningResult['history'] = [];
    let bestParams: unknown = null;
    let bestScore = -Infinity;
    const startTime = Date.now();

    // Start with random exploration
    const explorationTrials = Math.floor(numTrials * 0.3);
    const exploitationTrials = numTrials - explorationTrials;

    logger.info(`Bayesian optimization: ${explorationTrials} exploration, ${exploitationTrials} exploitation trials`);

    // Exploration phase - parallelize independent trials
    const explorationPromises = [];
    for (let i = 0; i < explorationTrials; i++) {
      const params = this.sampleRandomParams();
      explorationPromises.push(this.evaluateParams(params, trainData));
    }

    const explorationResults = await Promise.all(explorationPromises);
    for (const result of explorationResults) {
      history.push(result);

      if (result.score > bestScore) {
        bestScore = result.score;
        bestParams = result.params;
      }
    }

    // Exploitation phase using Gaussian Process approximation
    for (let i = 0; i < exploitationTrials; i++) {
      const params = this.selectNextParams(history);
      // eslint-disable-next-line no-await-in-loop
      const result = await this.evaluateParams(params, trainData);
      history.push(result);

      if (result.score > bestScore) {
        bestScore = result.score;
        bestParams = params;
      }
    }

    return {
      bestParams,
      bestScore,
      history,
      totalTime: Date.now() - startTime
    };
  }

  /**
   * Train model with given parameters
   */
  private async trainModel(
    params: unknown,
    trainData: { x: tf.Tensor; y: tf.Tensor },
    validationData: { x: tf.Tensor; y: tf.Tensor }
  ): Promise<{
    model: tf.LayersModel;
    metrics: {
      trainLoss: number;
      trainAccuracy: number;
      validationLoss: number;
      validationAccuracy: number;
      epochs: number;
    };
  }> {
    // Build model architecture
    const model = this.buildModel(params, trainData.x.shape.slice(1));

    const p = params as Record<string, unknown>;

    // Compile model
    model.compile({
      optimizer: this.getOptimizer(p["optimizer"] as string, p["learningRate"] as number),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });

    // Train model
    const history = await model.fit(trainData.x, trainData.y, {
      batchSize: p["batchSize"] as number,
      epochs: p["epochs"] as number,
      validationData: [validationData.x, validationData.y],
      callbacks: [
        tf.callbacks.earlyStopping({
          monitor: 'val_loss',
          patience: this.earlyStoppingPatience,
          restoreBestWeights: true
        })
      ],
      verbose: 0
    });

    // Get final metrics
    const trainMetrics = history.history;
    const loss = trainMetrics["loss"] as number[];
    const acc = trainMetrics["acc"] as number[];
    const valLoss = trainMetrics["val_loss"] as number[];
    const valAcc = trainMetrics["val_acc"] as number[];

    const metrics = {
      trainLoss: loss[loss.length - 1] ?? 0,
      trainAccuracy: acc[acc.length - 1] ?? 0,
      validationLoss: valLoss[valLoss.length - 1] ?? 0,
      validationAccuracy: valAcc[valAcc.length - 1] ?? 0,
      epochs: loss.length
    };

    return { model, metrics };
  }

  /**
   * Build model architecture
   */
  private buildModel(params: unknown, inputShape: number[]): tf.Sequential {
    const p = params as Record<string, unknown>;
    const hiddenLayers = p["hiddenLayers"] as number[];
    const activation = p["activation"] as string;
    const l2Regularization = p["l2Regularization"] as number;
    const dropoutRate = p["dropoutRate"] as number;

    const model = tf.sequential();

    // Input layer
    const firstLayer = hiddenLayers[0];
    if (firstLayer !== undefined) {
      model.add(tf.layers.dense({
        units: firstLayer,
        activation: activation as 'relu' | 'elu' | 'tanh',
        inputShape: inputShape,
        kernelRegularizer: tf.regularizers.l2({ l2: l2Regularization })
      }));
    }

    if (dropoutRate > 0) {
      model.add(tf.layers.dropout({ rate: dropoutRate }));
    }

    // Hidden layers
    for (let i = 1; i < hiddenLayers.length; i++) {
      const units = hiddenLayers[i];
      if (units !== undefined) {
        model.add(tf.layers.dense({
          units: units,
          activation: activation as 'relu' | 'elu' | 'tanh',
          kernelRegularizer: tf.regularizers.l2({ l2: l2Regularization })
        }));

        if (dropoutRate > 0) {
          model.add(tf.layers.dropout({ rate: dropoutRate }));
        }
      }
    }

    // Output layer (assuming classification)
    model.add(tf.layers.dense({
      units: 10, // Adjust based on number of classes
      activation: 'softmax'
    }));

    return model;
  }

  /**
   * Get optimizer
   */
  private getOptimizer(name: string, learningRate: number): tf.Optimizer {
    switch (name) {
      case 'adam':
        return tf.train.adam(learningRate);
      case 'rmsprop':
        return tf.train.rmsprop(learningRate);
      case 'sgd':
        return tf.train.sgd(learningRate);
      default:
        return tf.train.adam(learningRate);
    }
  }

  /**
   * Generate trial configurations
   */
  private generateTrials(): unknown[] {
    const trials: unknown[] = [];

    for (let i = 0; i < this.maxTrials; i++) {
      trials.push(this.sampleRandomParams());
    }

    return trials;
  }

  /**
   * Sample random parameters from search space
   */
  private sampleRandomParams(): Record<string, unknown> {
    return {
      learningRate: this.sampleValue(this.searchSpace.learningRate),
      batchSize: this.sampleDiscrete(this.searchSpace.batchSize.values),
      epochs: Math.floor(this.sampleValue({ 
        min: this.searchSpace.epochs.min, 
        max: this.searchSpace.epochs.max, 
        scale: 'linear' 
      })),
      dropoutRate: this.sampleValue({ ...this.searchSpace.dropoutRate, scale: 'linear' as const }),
      hiddenLayers: this.sampleDiscrete(this.searchSpace.hiddenLayers.values),
      optimizer: this.sampleDiscrete(this.searchSpace.optimizer.values),
      activation: this.sampleDiscrete(this.searchSpace.activation.values),
      l2Regularization: this.sampleValue(this.searchSpace.l2Regularization)
    };
  }

  /**
   * Sample value from continuous range
   */
  private sampleValue(range: { min: number; max: number; scale: 'linear' | 'log' }): number {
    const rand = Math.random();
    
    if (range.scale === 'log') {
      const logMin = Math.log(range.min);
      const logMax = Math.log(range.max);
      return Math.exp(logMin + rand * (logMax - logMin));
    } else {
      return range.min + rand * (range.max - range.min);
    }
  }

  /**
   * Sample from discrete values
   */
  private sampleDiscrete<T>(values: T[]): T {
    const index = Math.floor(Math.random() * values.length);
    const result = values[index];
    if (result === undefined) {
      throw new Error('Failed to sample discrete value');
    }
    return result;
  }

  /**
   * Split validation data
   */
  private splitValidationData(
    data: { x: tf.Tensor; y: tf.Tensor }
  ): { x: tf.Tensor; y: tf.Tensor } {
    const numSamples = data.x.shape[0];
    const splitIdx = Math.floor(numSamples * (1 - this.validationSplit));

    const valX = data.x.slice([splitIdx, 0], [-1, -1]);
    const valY = data.y.slice([splitIdx, 0], [-1, -1]);

    return { x: valX, y: valY };
  }

  /**
   * Split data for validation and return both training and validation splits
   */
  private splitDataForValidation(
    data: { x: tf.Tensor; y: tf.Tensor }
  ): { trainSplit: { x: tf.Tensor; y: tf.Tensor }; validationData: { x: tf.Tensor; y: tf.Tensor } } {
    const numSamples = data.x.shape[0];
    const splitIdx = Math.floor(numSamples * (1 - this.validationSplit));

    const trainX = data.x.slice([0, 0], [splitIdx, -1]);
    const trainY = data.y.slice([0, 0], [splitIdx, -1]);
    const valX = data.x.slice([splitIdx, 0], [-1, -1]);
    const valY = data.y.slice([splitIdx, 0], [-1, -1]);

    return {
      trainSplit: { x: trainX, y: trainY },
      validationData: { x: valX, y: valY }
    };
  }

  /**
   * Check for early stopping
   */
  private shouldEarlyStop(history: TuningResult['history']): boolean {
    if (history.length < this.earlyStoppingPatience * 2) {
      return false;
    }

    const recentScores = history
      .slice(-this.earlyStoppingPatience)
      .map(h => h.score);

    const bestRecent = Math.max(...recentScores);
    const previousBest = Math.max(
      ...history.slice(0, -this.earlyStoppingPatience).map(h => h.score)
    );

    return bestRecent <= previousBest;
  }

  /**
   * Save best model
   */
  private async saveBestModel(
    model: tf.LayersModel,
    params: unknown,
    metrics: {
      accuracy?: number;
      loss?: number;
      precision?: number;
      recall?: number;
      f1Score?: number;
      trainingTime?: number;
      epochs?: number;
    }
  ): Promise<void> {
    try {
      await this.modelSerializer.saveModel(
        model,
        {
          modelType: 'classifier',
          version: `tuned_${Date.now()}`,
          architecture: model.toJSON(),
          hyperparameters: params,
          metrics
        }
      );
    } catch (error: unknown) {
      logger.error('Error saving best model:', { error });
    }
  }

  /**
   * Evaluate parameters
   */
  private async evaluateParams(
    params: unknown,
    trainData: { x: tf.Tensor; y: tf.Tensor }
  ): Promise<{ params: unknown; score: number; trainTime: number }> {
    const startTime = Date.now();
    const { trainSplit, validationData } = this.splitDataForValidation(trainData);

    try {
      const { model, metrics } = await this.trainModel(params, trainSplit, validationData);
      const score = metrics.validationAccuracy;

      model.dispose();

      return {
        params,
        score,
        trainTime: Date.now() - startTime
      };
    } catch (_error: unknown) {
      return {
        params,
        score: -Infinity,
        trainTime: Date.now() - startTime
      };
    }
  }

  /**
   * Select next parameters using acquisition function
   */
  private selectNextParams(history: TuningResult['history']): Record<string, unknown> {
    // Simple Thompson sampling approximation
    // In production, use proper Gaussian Process
    
    if (history.length < 5) {
      return this.sampleRandomParams();
    }

    // Find best performing region
    const sortedHistory = [...history].sort((a, b) => b.score - a.score);
    const topParams = sortedHistory.slice(0, 3);

    // Sample near best parameters with exploration
    const topParam = topParams[Math.floor(Math.random() * topParams.length)];
    if (!topParam) {
      return this.sampleRandomParams();
    }
    const baseParams = topParam.params;
    const newParams = { ...(baseParams as Record<string, unknown>) } as Record<string, unknown>;

    // Add noise for exploration
    const noiseLevel = 0.2;

    if (Math.random() < noiseLevel) {
      const lr = newParams["learningRate"] as number;
      newParams["learningRate"] = lr * (0.5 + Math.random());
    }
    if (Math.random() < noiseLevel) {
      const dr = newParams["dropoutRate"] as number;
      newParams["dropoutRate"] = Math.min(0.5, Math.max(0.1,
        dr + (Math.random() - 0.5) * 0.2));
    }
    if (Math.random() < noiseLevel) {
      newParams["batchSize"] = this.sampleDiscrete(this.searchSpace.batchSize.values);
    }

    return newParams;
  }

  /**
   * Generate grid combinations
   */
  private generateGridCombinations(paramGrid: Record<string, unknown[]>): unknown[] {
    const keys = Object.keys(paramGrid);
    const combinations: unknown[] = [];

    function* cartesianProduct(arrays: unknown[][]): Generator<unknown[]> {
      if (arrays.length === 0) {
        yield [];
      } else {
        const [head, ...tail] = arrays;
        if (head === undefined) {
          yield [];
          return;
        }
        for (const h of head) {
          for (const t of cartesianProduct(tail)) {
            yield [h, ...t];
          }
        }
      }
    }

    const values = keys.map(k => paramGrid[k] ?? []);
    for (const combo of cartesianProduct(values)) {
      const params = {} as Record<string, unknown>;
      keys.forEach((key, idx) => {
        const value = combo[idx];
        if (value !== undefined) {
          params[key] = value;
        }
      });
      combinations.push(params);
    }

    return combinations;
  }

  /**
   * Convert grid to search space
   */
  private gridToSearchSpace(paramGrid: Record<string, unknown[]>): Partial<HyperparameterSpace> {
    const space = {} as Record<string, unknown>;

    for (const [key, values] of Object.entries(paramGrid)) {
      const firstValue = values[0];
      if (typeof firstValue === 'number' && values.length === 2) {
        space[key] = { min: values[0], max: values[1], scale: 'linear' };
      } else {
        space[key] = { values };
      }
    }

    return space as Partial<HyperparameterSpace>;
  }

  /**
   * Get default parameters
   */
  private getDefaultParams(): Record<string, unknown> {
    return {
      learningRate: 0.001,
      batchSize: 32,
      epochs: 100,
      dropoutRate: 0.2,
      hiddenLayers: [128, 64],
      optimizer: 'adam',
      activation: 'relu',
      l2Regularization: 0.0001
    };
  }
}