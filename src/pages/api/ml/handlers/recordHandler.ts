/**
 * Record Action Handler
 * 
 * Handles recording of ML model predictions and metrics.
 */

import { ModelType } from '@/server/config/ml-config';
import type { MLMetricsService, PredictionMetric } from '@/server/services/ml/MLMetricsService';

import {
  safeGetString,
  safeGetNumber,
  safeGetObject,
  createSuccessResponse,
  createValidationErrorResponse,
  type RecordRequestBody
} from '../metrics-utils';

import type { NextApiResponse } from 'next';

/**
 * Check if a string is a valid ModelType
 */
function isValidModelType(value: string): value is ModelType {
  return Object.values(ModelType).includes(value as ModelType);
}

/**
 * Handle record action
 */
export async function handleRecordAction(
  body: unknown,
  res: NextApiResponse,
  metricsService: MLMetricsService
): Promise<void> {
  const recordBody = body as RecordRequestBody;

  // Extract and validate required fields
  const modelType = safeGetString(recordBody, 'modelType');
  const modelVersion = safeGetString(recordBody, 'modelVersion');
  const inputHash = safeGetString(recordBody, 'inputHash');
  const confidence = safeGetNumber(recordBody, 'confidence');
  const inferenceTime = safeGetNumber(recordBody, 'inferenceTime');
  const prediction = safeGetObject(recordBody, 'prediction');
  const metadata = safeGetObject(recordBody, 'metadata');

  // Validate required fields
  const missingFields = [];
  if (!modelType) missingFields.push('modelType');
  if (!modelVersion) missingFields.push('modelVersion');
  if (!inputHash) missingFields.push('inputHash');
  if (confidence === undefined) missingFields.push('confidence');

  if (missingFields.length > 0) {
    return createValidationErrorResponse(res, missingFields);
  }

  // Validate model type
  if (!modelType || !isValidModelType(modelType)) {
    const validTypes = Object.values(ModelType).join(', ');
    return createValidationErrorResponse(res, [`modelType must be one of: ${validTypes}`]);
  }

  // At this point, we know these fields are not undefined due to validation above
  const validatedModelType = modelType as ModelType;
  const validatedModelVersion = modelVersion as string;
  const validatedInputHash = inputHash as string;
  const validatedConfidence = confidence as number;
  const validatedInferenceTime = inferenceTime ?? 0;

  // Record prediction
  const predictionData: Omit<PredictionMetric, 'id' | 'timestamp'> = {
    modelType: validatedModelType,
    modelVersion: validatedModelVersion,
    inputHash: validatedInputHash,
    confidence: validatedConfidence,
    inferenceTime: validatedInferenceTime,
    prediction,
    ...(metadata ? { metadata } : {})
  };

  await metricsService.recordPrediction(predictionData);

  return createSuccessResponse(res, 'Prediction recorded successfully');
}
