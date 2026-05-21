/**
 * Similarity Tool
 *
 * Wraps title similarity utilities for AI agent tool calling.
 * Provides various similarity algorithms for comparing manga titles.
 */

import { calculateTitleSimilarity, normalizeTitle as normalizeTitleSimilarity } from '@/server/services/library/metadataEnrichmentService/title-similarity';
import { diceCoefficient, normalizeTitle as normalizeTitlePipeline } from '@/server/trpc/routers/manga/metadataOperations/enrichment-pipeline/utils';
import { similarity } from '@/server/utils/string';
import type { AsyncResult } from '@/utils/async-result';
import { createSuccessResult, createErrorResult, isError, isSuccess } from '@/utils/async-result';
import { logger } from '@/utils/logger';

import type { AgentTool } from '../agent-core/types';

const log = logger.child('SimilarityTool');

/**
 * Parameters for the similarity tool
 */
interface SimilarityToolParams {
  /** First title to compare */
  title1: string;
  /** Second title to compare */
  title2: string;
  /** Optional algorithm selection */
  algorithm?: 'combined' | 'dice' | 'levenshtein' | 'jaccard' | 'all';
}

/**
 * Validate tool parameters
 */
function validateParams(params: unknown): AsyncResult<SimilarityToolParams, Error> {
  if (!params || typeof params !== 'object') {
    return createErrorResult(new Error('Parameters must be an object'));
  }

  const { title1, title2, algorithm } = params as Partial<SimilarityToolParams>;

  if (!title1 || typeof title1 !== 'string') {
    return createErrorResult(new Error('title1 parameter is required and must be a string'));
  }

  if (!title2 || typeof title2 !== 'string') {
    return createErrorResult(new Error('title2 parameter is required and must be a string'));
  }

  if (algorithm && typeof algorithm !== 'string') {
    return createErrorResult(new Error('algorithm parameter must be a string'));
  }

  const validAlgorithms = ['combined', 'dice', 'levenshtein', 'jaccard', 'all'];
  if (algorithm && !validAlgorithms.includes(algorithm)) {
    return createErrorResult(new Error(`algorithm must be one of: ${validAlgorithms.join(', ')}`));
  }

  return createSuccessResult({ title1, title2, algorithm: algorithm ?? 'combined' });
}

/**
 * Calculate similarity using the combined algorithm (default)
 */
function calculateCombinedSimilarity(title1: string, title2: string): number {
  return calculateTitleSimilarity(title1, title2);
}

/**
 * Calculate similarity using Dice coefficient
 */
function calculateDiceSimilarity(title1: string, title2: string): number {
  const normalized1 = normalizeTitlePipeline(title1);
  const normalized2 = normalizeTitlePipeline(title2);
  return diceCoefficient(normalized1, normalized2);
}

/**
 * Calculate similarity using Levenshtein distance
 */
function calculateLevenshteinSimilarity(title1: string, title2: string): number {
  const normalized1 = normalizeTitleSimilarity(title1);
  const normalized2 = normalizeTitleSimilarity(title2);

  // Use the similarity function from server/utils/string.ts
  return similarity(normalized1, normalized2);
}

/**
 * Calculate similarity using Jaccard index on word sets
 */
function calculateJaccardSimilarity(title1: string, title2: string): number {
  const normalized1 = normalizeTitleSimilarity(title1);
  const normalized2 = normalizeTitleSimilarity(title2);

  const words1 = new Set(normalized1.split(' ').filter(w => w.length > 0));
  const words2 = new Set(normalized2.split(' ').filter(w => w.length > 0));

  if (words1.size === 0 && words2.size === 0) return 1.0;
  if (words1.size === 0 || words2.size === 0) return 0.0;

  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}

/**
 * Execute similarity calculation
 */
async function executeSimilarity(params: SimilarityToolParams): Promise<AsyncResult<unknown, Error>> {
  const { title1, title2, algorithm } = params;

  log.info('Calculating title similarity', { title1, title2, algorithm });

  try {
    await Promise.resolve(); // Satisfy eslint require-await rule
    const result: Record<string, unknown> = {
      title1,
      title2,
      normalizedTitle1: normalizeTitleSimilarity(title1),
      normalizedTitle2: normalizeTitleSimilarity(title2),
      algorithm,
    };

    switch (algorithm) {
      case 'combined':
        result['similarity'] = calculateCombinedSimilarity(title1, title2);
        result['confidence'] = 'high';
        break;

      case 'dice':
        result['similarity'] = calculateDiceSimilarity(title1, title2);
        result['confidence'] = 'medium';
        break;

      case 'levenshtein':
        result['similarity'] = calculateLevenshteinSimilarity(title1, title2);
        result['confidence'] = 'medium';
        break;

      case 'jaccard':
        result['similarity'] = calculateJaccardSimilarity(title1, title2);
        result['confidence'] = 'medium';
        break;

      case 'all':
        result['allSimilarities'] = {
          combined: calculateCombinedSimilarity(title1, title2),
          dice: calculateDiceSimilarity(title1, title2),
          levenshtein: calculateLevenshteinSimilarity(title1, title2),
          jaccard: calculateJaccardSimilarity(title1, title2),
        };
        result['recommended'] = calculateCombinedSimilarity(title1, title2);
        result['confidence'] = 'high';
        break;
      default:
        throw new Error(`Unexpected algorithm: ${algorithm}`);
    }

    log.debug('Similarity calculation completed', {
      title1,
      title2,
      algorithm,
      similarity: 'similarity' in result ? result['similarity'] : 'all',
    });

    return createSuccessResult(result);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    log.error('Similarity calculation failed', { error: err, title1, title2, algorithm });
    return createErrorResult(err);
  }
}

/**
 * Similarity tool
 */
export const similarityTool: AgentTool = {
  name: 'similarity',
  description: 'Calculate similarity between two manga titles using various algorithms (combined, dice, levenshtein, jaccard). Returns similarity score (0-1) with confidence and normalized titles.',
  parameters: {
    type: 'object',
    properties: {
      title1: {
        type: 'string',
        description: 'First title to compare',
      },
      title2: {
        type: 'string',
        description: 'Second title to compare',
      },
      algorithm: {
        type: 'string',
        description: 'Similarity algorithm to use: combined (default), dice, levenshtein, jaccard, or all',
      },
    },
    additionalProperties: false,
  } as const,
  async execute(params: unknown): Promise<AsyncResult<unknown, Error>> {
    // Validate parameters
    const validationResult = validateParams(params);
    if (isError(validationResult)) {
      log.error('Parameter validation failed', { error: validationResult.error });
      return validationResult;
    }
    if (!isSuccess(validationResult)) {
      return createErrorResult(new Error(`Validation result in unexpected state: ${validationResult.status}`));
    }

    // Execute similarity calculation
    return executeSimilarity(validationResult.data);
  },
};