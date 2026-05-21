/**
 * Core Mutation Functions Module
 *
 * Core mutation functions for pattern learning operations.
 * These functions handle the actual API communication.
 *
 * Extracted from: mutations.ts (lines 30-86)
 */

import { logger } from '@/utils/logger';

import { handleError, PatternFeedback, PatternCorrection } from '../utils';

/**
 * Submit pattern feedback to the API
 */
export async function submitFeedback(feedback: PatternFeedback): Promise<void> {
  try {
    const response = await fetch('/api/pattern-recognition/feedback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(feedback),
    });

    if (!response.ok) {
      throw new Error(`Failed to submit feedback: ${response.statusText}`);
    }
  } catch (error) {
    logger.error('Error submitting pattern feedback', error);
    throw handleError(error);
  }
}

/**
 * Submit pattern correction to the API
 */
export async function submitCorrection(correction: PatternCorrection): Promise<void> {
  try {
    const response = await fetch('/api/pattern-recognition/correction', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(correction),
    });

    if (!response.ok) {
      throw new Error(`Failed to submit correction: ${response.statusText}`);
    }
  } catch (error) {
    logger.error('Error submitting pattern correction', error);
    throw handleError(error);
  }
}

/**
 * Trigger pattern training using tRPC
 */
export function triggerTraining(): Promise<void> {
  try {
    // TODO: Fix tRPC type issues
    // return trpc.patternLearning.triggerTraining.mutate();
    throw new Error('tRPC patternLearning not implemented yet');
  } catch (error) {
    logger.error('Error triggering pattern training', error);
    throw handleError(error);
  }
}