/**
 * Feedback Action Handler
 * 
 * Handles feedback submission for ML model predictions.
 */

import type { MLMetricsService } from '@/server/services/ml/MLMetricsService';

import {
  safeGetString,
  safeGetBoolean,
  createSuccessResponse,
  createValidationErrorResponse,
  type FeedbackRequestBody
} from '../metrics-utils';

import type { NextApiResponse } from 'next';

/**
 * Handle feedback action
 */
export async function handleFeedbackAction(
  body: unknown,
  res: NextApiResponse,
  metricsService: MLMetricsService
): Promise<void> {
  const feedbackBody = body as FeedbackRequestBody;

  // Extract and validate required fields
  const predictionId = safeGetString(feedbackBody, 'predictionId');
  const correct = safeGetBoolean(feedbackBody, 'correct');
  const actualValue = safeGetString(feedbackBody, 'actualValue');
  const feedback = safeGetString(feedbackBody, 'feedback');

  // Validate required fields
  if (!predictionId || correct === undefined) {
    const missingFields = [];
    if (!predictionId) missingFields.push('predictionId');
    if (correct === undefined) missingFields.push('correct');
    return createValidationErrorResponse(res, missingFields);
  }

  // Record feedback
  await metricsService.recordFeedback(
    predictionId,
    correct,
    actualValue,
    feedback
  );

  return createSuccessResponse(res, 'Feedback recorded successfully');
}
