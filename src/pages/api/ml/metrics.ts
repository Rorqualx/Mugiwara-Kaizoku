/**
 * ML Metrics API Endpoint
 * 
 * Provides access to ML model performance metrics, predictions analytics,
 * and feedback collection for the admin dashboard.
 */

import { getServerSession } from 'next-auth/next';

import { isFeatureEnabled } from '@/server/config/feature-flags';
import type { ModelType } from '@/server/config/ml-config';
import type {
  MetricType,
  MLMetricsService
} from '@/server/services/ml/MLMetricsService';
import {
  getMLMetricsService
} from '@/server/services/ml/MLMetricsService';
import { logger } from '@/utils/logger';

import { authOptions } from '../auth/[...nextauth]';

import { handleFeedbackAction } from './handlers/feedbackHandler';
import { handleRecordAction } from './handlers/recordHandler';

import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * API handler
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  try {
    // Check if ML metrics collection is enabled
    if (!isFeatureEnabled('metricsCollection')) {
      return res["status"](403).json({ 
        error: 'ML metrics collection is not enabled' 
      });
    }

    // Check authentication (admin only)
    const session = await getServerSession(req, res, authOptions);
    if (!session?.user) {
      return res["status"](401).json({ error: 'Unauthorized' });
    }

    // TODO: Add admin role check when role system is implemented
    // if (session.user.role !== 'admin') {
    //   return res["status"](403).json({ error: 'Admin access required' });
    // }

    const metricsService = getMLMetricsService();

    switch (req.method) {
      case 'GET':
        return await handleGet(req, res, metricsService);
      case 'POST':
        return await handlePost(req, res, metricsService);
      default:
        res.setHeader('Allow', ['GET', 'POST']);
        return res["status"](405).json({ error: 'Method not allowed' });
    }
  } catch (error: unknown) {
    logger.error('[ML Metrics API] Error:', error);
    return res["status"](500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Handle GET requests
 */
async function handleGet(
  req: NextApiRequest,
  res: NextApiResponse,
  metricsService: MLMetricsService
): Promise<void> {
  const { type, modelType, timeRange, interval } = req.query;

  // Parse time range if provided
  let parsedTimeRange;
  if (typeof timeRange === 'string') {
    try {
      const range: unknown = JSON.parse(timeRange);
      if (
        typeof range === 'object' &&
        range !== null &&
        'start' in range &&
        'end' in range &&
        (typeof range.start === 'string' || typeof range.start === 'number') &&
        (typeof range.end === 'string' || typeof range.end === 'number')
      ) {
        parsedTimeRange = {
          start: new Date(range.start),
          end: new Date(range.end)
        };
      } else {
        return res["status"](400).json({
          error: 'Invalid timeRange format'
        });
      }
    } catch (_error: unknown) {
      return res["status"](400).json({
        error: 'Invalid timeRange format'
      });
    }
  }

  // Route based on type parameter
  switch (type) {
    case 'aggregated': {
      const aggregated = await metricsService.getAggregatedMetrics(
        modelType as ModelType | undefined,
        parsedTimeRange
      );
      return res["status"](200).json(aggregated);
    }

    case 'timeseries': {
      if (!req.query["metricType"]) {
        return res["status"](400).json({
          error: 'metricType is required for timeseries'
        });
      }

      const intervalValue = (interval as 'minute' | 'hour' | 'day' | undefined) ?? 'hour';
      const timeseries = await metricsService.getTimeSeries(
        req.query["metricType"] as MetricType,
        modelType as ModelType | undefined,
        parsedTimeRange,
        intervalValue
      );
      return res["status"](200).json(timeseries);
    }

    case 'comparison': {
      const comparison = await metricsService.getModelComparison();
      return res["status"](200).json(comparison);
    }

    default: {
      // Default to aggregated metrics
      const defaultMetrics = await metricsService.getAggregatedMetrics();
      return res["status"](200).json(defaultMetrics);
    }
  }
}

/**
 * Handle POST requests (feedback)
 */
async function handlePost(
  req: NextApiRequest,
  res: NextApiResponse,
  metricsService: MLMetricsService
): Promise<void> {
  const { action } = req.query;

  switch (action) {
    case 'feedback':
      return handleFeedbackAction(req.body, res, metricsService);
    case 'record':
      return handleRecordAction(req.body, res, metricsService);
    default:
      return res["status"](400).json({
        error: 'Invalid action. Use "feedback" or "record"'
      });
  }
}
