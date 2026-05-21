#!/usr/bin/env node

/**
 * Training Script
 * 
 * Collects training data from various sources and trains ML models
 * for the Pattern Recognition Engine.
 * 
 * Usage:
 *   npm run train-models -- --collect --train
 *   npm run train-models -- --source ./data/manga-pages --train
 */

import fs from 'fs/promises';
import path from 'path';

import * as cheerio from 'cheerio';
import fetch from 'node-fetch';

import { logger } from '@/utils/logger';

import { DataCollector } from '../training/DataCollector';
import { ModelTrainer } from '../training/ModelTrainer';

import type { TrainingDataSource } from '../training/DataCollector';
import type { LearningExample } from '../types';

// Sample sources for training data
const SAMPLE_SOURCES = [
  {
    url: 'https://onepiece.fandom.com/wiki/One_Piece',
    type: 'fandom' as const
  },
  {
    url: 'https://naruto.fandom.com/wiki/Naruto',
    type: 'fandom' as const
  },
  {
    url: 'https://en.wikipedia.org/wiki/Dragon_Ball',
    type: 'wikipedia' as const
  }
];

async function collectDataFromUrl(url: string, type: 'fandom' | 'wikipedia'): Promise<TrainingDataSource | null> {
  try {
    logger.info(`Fetching ${url}...`);
    const response = await fetch(url);
    const html = await response.text();
    
    return {
      url,
      html,
      type
    };
  } catch (error: unknown) {
    console.error(`Failed to fetch ${url}:`, error);
    return null;
  }
}

async function collectDataFromFile(filePath: string): Promise<TrainingDataSource | null> {
  try {
    logger.info(`Reading ${filePath}...`);
    const html = await fs.readFile(filePath, 'utf-8');
    
    // Detect type from content
    const $ = cheerio.load(html);
    let type: 'fandom' | 'wikipedia' | 'other' = 'other';
    
    if ($('.fandom-community-header').length > 0 || $('meta[property="og:site_name"]').attr('content')?.includes('Fandom')) {
      type = 'fandom';
    } else if ($('#mw-content-text').length > 0 || $('meta[name="generator"]').attr('content')?.includes('MediaWiki')) {
      type = 'wikipedia';
    }
    
    return {
      url: `file://${filePath}`,
      html,
      type
    };
  } catch (error: unknown) {
    console.error(`Failed to read ${filePath}:`, error);
    return null;
  }
}

async function collectDataFromDirectory(dirPath: string): Promise<TrainingDataSource[]> {
  try {
    const files = await fs.readdir(dirPath);

    // Process HTML files in parallel for better performance
    const htmlFiles = files.filter(file => file.endsWith('.html'));
    const sourcePromises = htmlFiles.map(file =>
      collectDataFromFile(path.join(dirPath, file))
    );

    const sources = await Promise.all(sourcePromises);
    return sources.filter((source): source is TrainingDataSource => source !== null);
  } catch (error: unknown) {
    console.error(`Failed to read directory ${dirPath}:`, error);
    return [];
  }
}

/**
 * Collect training data from provided path or sample sources
 */
async function collectTrainingData(
  collector: DataCollector,
  sourcePath: string | null
): Promise<void> {
  logger.info('=== Collecting Training Data ===');

  if (sourcePath) {
    await collectFromProvidedPath(collector, sourcePath);
  } else {
    await collectFromSampleSources(collector);
  }

  // Generate training examples
  const examples = await collector.generateTrainingExamples();
  logger.info(`Generated ${examples.length} training examples`);

  // Show statistics
  const stats = collector.getStatistics();
  logger.info('\nData Collection Statistics:');
  logger.info(`- Total sources: ${stats.totalSources}`);
  logger.info(`- Total elements: ${stats.totalElements}`);
  logger.info('- By type:', stats.byType);
  logger.info('- By source:', stats.bySource);

  // Export data
  await collector.exportData('./data/training/collected_data.json');
}

/**
 * Collect data from provided file or directory path
 */
async function collectFromProvidedPath(
  collector: DataCollector,
  sourcePath: string
): Promise<void> {
  const stats = await fs.stat(sourcePath);

  if (stats.isDirectory()) {
    const sources = await collectDataFromDirectory(sourcePath);
    // Sequential processing required: collector maintains internal state across sources
    for (const source of sources) {
      // eslint-disable-next-line no-await-in-loop -- Sequential required: collector accumulates state
      await collector.collectFromSource(source);
    }
  } else {
    const source = await collectDataFromFile(sourcePath);
    if (source) {
      await collector.collectFromSource(source);
    }
  }
}

/**
 * Collect data from sample sources in parallel
 */
async function collectFromSampleSources(collector: DataCollector): Promise<void> {
  // Fetch sources in parallel for better performance
  const sourcePromises = SAMPLE_SOURCES.map(sourceConfig =>
    collectDataFromUrl(sourceConfig.url, sourceConfig.type)
  );

  const sources = await Promise.all(sourcePromises);

  // Sequential processing required: collector maintains internal state across sources
  for (const source of sources) {
    if (source) {
      // eslint-disable-next-line no-await-in-loop -- Sequential required: collector accumulates state
      await collector.collectFromSource(source);
    }
  }
}

/**
 * Train models with optional hyperparameter tuning
 */
async function trainModels(
  collector: DataCollector,
  trainer: ModelTrainer,
  shouldTune: boolean
): Promise<void> {
  logger.info('\n=== Training Models ===');

  // Load training examples (returns unknown[], needs validation)
  const rawExamples = await collector.loadTrainingExamples();

  if (rawExamples.length === 0) {
    console.error('No training examples found. Run with --collect first.');
    process.exit(1);
  }

  // Validate and filter examples
  const examples = rawExamples.filter(isLearningExample);

  if (examples.length === 0) {
    console.error('No valid training examples found after validation.');
    process.exit(1);
  }

  logger.info(`Loaded ${examples.length} valid training examples`);

  // Hyperparameter tuning
  if (shouldTune) {
    await performHyperparameterTuning(trainer, examples);
  }

  // Train all models
  const results = await trainer.trainAllModels();

  // Display and save results
  displayTrainingResults(results);
  await fs.writeFile(
    './data/training/training_results.json',
    JSON.stringify(results, null, 2)
  );
}

/**
 * Type guard to validate learning example
 */
function isLearningExample(item: unknown): item is LearningExample {
  if (!item || typeof item !== 'object') return false;
  const obj = item as Record<string, unknown>;
  return 'input' in obj && 'expectedOutput' in obj;
}

/**
 * Perform hyperparameter tuning
 */
async function performHyperparameterTuning(
  trainer: ModelTrainer,
  examples: LearningExample[]
): Promise<void> {
  logger.info('\n=== Hyperparameter Tuning ===');
  const { bestParams, bestScore } = await trainer.hyperparameterTuning(examples);
  logger.info('Best parameters:', bestParams);
  logger.info('Best score:', bestScore.toFixed(4));
}

/**
 * Display training results
 */
function displayTrainingResults(results: unknown[]): void {
  logger.info('\n=== Training Results ===');
  for (const result of results) {
    const r = result as {
      modelId: string;
      accuracy: number;
      loss: number;
      validationAccuracy: number;
      validationLoss: number;
      trainingTime: number;
    };
    logger.info(`\n${r.modelId}:`);
    logger.info(`  Accuracy: ${r.accuracy.toFixed(4)}`);
    logger.info(`  Loss: ${r.loss.toFixed(4)}`);
    logger.info(`  Val Accuracy: ${r.validationAccuracy.toFixed(4)}`);
    logger.info(`  Val Loss: ${r.validationLoss.toFixed(4)}`);
    logger.info(`  Training Time: ${(r.trainingTime / 1000).toFixed(2)}s`);
  }
}

/**
 * Evaluate models using cross-validation
 */
async function evaluateModels(
  collector: DataCollector,
  trainer: ModelTrainer
): Promise<void> {
  logger.info('\n=== Model Evaluation ===');

  const rawExamples = await collector.loadTrainingExamples();

  if (rawExamples.length === 0) {
    console.error('No training examples found. Run with --collect first.');
    process.exit(1);
  }

  // Validate and filter examples
  const examples = rawExamples.filter(isLearningExample);

  if (examples.length === 0) {
    console.error('No valid training examples found after validation.');
    process.exit(1);
  }

  // Cross-validation
  const cvResults = await trainer.crossValidation(examples);
  logger.info(`Cross-validation accuracy: ${cvResults.meanAccuracy.toFixed(4)} ± ${cvResults.stdAccuracy.toFixed(4)}`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const shouldCollect = args.includes('--collect');
  const shouldTrain = args.includes('--train');
  const shouldTune = args.includes('--tune');
  const shouldEvaluate = args.includes('--evaluate');

  // Parse source argument
  // Handle noUncheckedIndexedAccess: args[n] returns string | undefined
  const sourceIndex = args.indexOf('--source');
  const sourceArg = sourceIndex >= 0 && sourceIndex + 1 < args.length ? args[sourceIndex + 1] : undefined;
  const sourcePath = sourceArg ?? null;

  // Initialize components
  const collector = new DataCollector();
  const trainer = new ModelTrainer();

  await collector.initialize();
  await trainer.initialize();

  // Execute pipeline phases
  if (shouldCollect) {
    await collectTrainingData(collector, sourcePath);
  }

  if (shouldTrain) {
    await trainModels(collector, trainer, shouldTune);
  }

  if (shouldEvaluate) {
    await evaluateModels(collector, trainer);
  }

  logger.info('\n=== Training Pipeline Complete ===');
}

// Run the script
main().catch(console.error);