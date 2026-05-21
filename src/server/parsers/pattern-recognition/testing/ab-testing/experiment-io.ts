/**
 * A/B Testing Framework - Experiment I/O
 *
 * Handles file I/O operations for experiment persistence.
 *
 * Extracted from: ABTestingFramework.ts (lines 435-483)
 *
 * FIXES:
 * - Line 458: Added explicit type for JSON.parse return (@typescript-eslint/no-unsafe-return)
 * - Line 472: Removed await in loop, use Promise.all() (no-await-in-loop)
 * - Line 476: Added explicit type for JSON.parse argument (@typescript-eslint/no-unsafe-argument)
 * - Line 480: Replaced console.error with logger (no-console)
 */

import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

import { logger } from '@/utils/logger';

import type { ExperimentResults } from './types';

// ============================================================================
// Experiment ID Generation
// ============================================================================

/**
 * Generate unique experiment ID
 *
 * @returns Unique experiment identifier with timestamp and random bytes
 */
export function generateExperimentId(): string {
  return `exp_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

// ============================================================================
// Experiment Persistence
// ============================================================================

/**
 * Save experiment results to disk
 *
 * @param experiment - Experiment results to save
 * @param dataDir - Data directory path
 * @returns Promise that resolves when file is written
 */
export async function saveExperiment(
  experiment: ExperimentResults,
  dataDir: string
): Promise<void> {
  const filename = `${experiment.experimentId}.json`;
  await fs.writeFile(
    path.join(dataDir, 'experiments', filename),
    JSON.stringify(experiment, null, 2)
  );
}

/**
 * Load experiment results from disk
 *
 * @param experimentId - ID of experiment to load
 * @param dataDir - Data directory path
 * @returns Experiment results if found, null otherwise
 *
 * FIX: Line 458 - Added explicit type for JSON.parse return
 */
export async function loadExperiment(
  experimentId: string,
  dataDir: string
): Promise<ExperimentResults | null> {
  try {
    const filename = `${experimentId}.json`;
    const data = await fs.readFile(
      path.join(dataDir, 'experiments', filename),
      'utf-8'
    );
    return JSON.parse(data) as ExperimentResults;
  } catch (_error: unknown) {
    return null;
  }
}

/**
 * Get all experiments from disk
 *
 * @param dataDir - Data directory path
 * @returns Array of all experiment results
 *
 * FIXES:
 * - Line 472: Removed await in loop, use Promise.all()
 * - Line 476: Added explicit type for JSON.parse result
 * - Line 480: Replaced console.error with logger
 */
export async function getAllExperiments(dataDir: string): Promise<ExperimentResults[]> {
  try {
    const files = await fs.readdir(path.join(dataDir, 'experiments'));

    // Filter JSON files and read them in parallel
    const jsonFiles = files.filter(file => file.endsWith('.json'));
    const readPromises = jsonFiles.map(file =>
      fs.readFile(path.join(dataDir, 'experiments', file), 'utf-8')
        .then(data => JSON.parse(data) as ExperimentResults)
    );

    return await Promise.all(readPromises);
  } catch (error: unknown) {
    logger.error('Failed to load experiments', { error });
    return [];
  }
}
