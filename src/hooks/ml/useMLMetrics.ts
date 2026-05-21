/**
 * ML Metrics Hook
 *
 * Custom hook for fetching ML metrics including aggregated metrics,
 * time series data, and model comparison data.
 */

import { useState, useEffect, useCallback } from 'react';

import {
  MLMetricsResponse,
  MLTimeSeriesResponse,
  MLComparisonResponse,
  isMLMetricsResponse,
  isMLTimeSeriesResponse,
  isMLComparisonResponse
} from '@/types/ml/ml-api-types';
import { logger } from '@/utils/logger';

interface UseMLMetricsReturn {
  metrics: MLMetricsResponse | null;
  timeSeries: MLTimeSeriesResponse;
  modelComparison: MLComparisonResponse;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Fetches ML metrics data including aggregated metrics, time series, and model comparison
 *
 * @param selectedMetric - The metric type to fetch time series for
 * @param selectedInterval - The time interval for time series data
 * @returns ML metrics data and loading/error states
 */
export function useMLMetrics(
  selectedMetric: string,
  selectedInterval: string
): UseMLMetricsReturn {
  const [metrics, setMetrics] = useState<MLMetricsResponse | null>(null);
  const [timeSeries, setTimeSeries] = useState<MLTimeSeriesResponse>([]);
  const [modelComparison, setModelComparison] = useState<MLComparisonResponse>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      // Fetch aggregated metrics
      const metricsRes = await fetch('/api/ml/metrics?type=aggregated');
      if (metricsRes.ok) {
        const metricsData: unknown = await metricsRes.json();
        if (isMLMetricsResponse(metricsData)) {
          setMetrics(metricsData);
        } else {
          logger.warn('Invalid metrics response format', { data: metricsData });
        }
      } else {
        logger.error('Failed to fetch metrics', {
          status: metricsRes.status,
          statusText: metricsRes.statusText
        });
      }

      // Fetch time series data
      const timeSeriesRes = await fetch(
        `/api/ml/metrics?type=timeseries&metricType=${selectedMetric}&interval=${selectedInterval}`
      );
      if (timeSeriesRes.ok) {
        const timeSeriesData: unknown = await timeSeriesRes.json();
        if (isMLTimeSeriesResponse(timeSeriesData)) {
          setTimeSeries(timeSeriesData);
        } else {
          logger.warn('Invalid time series response format', { data: timeSeriesData });
        }
      } else {
        logger.error('Failed to fetch time series', {
          status: timeSeriesRes.status,
          statusText: timeSeriesRes.statusText
        });
      }

      // Fetch model comparison
      const comparisonRes = await fetch('/api/ml/metrics?type=comparison');
      if (comparisonRes.ok) {
        const comparisonData: unknown = await comparisonRes.json();
        if (isMLComparisonResponse(comparisonData)) {
          setModelComparison(comparisonData);
        } else {
          logger.warn('Invalid comparison response format', { data: comparisonData });
        }
      } else {
        logger.error('Failed to fetch model comparison', {
          status: comparisonRes.status,
          statusText: comparisonRes.statusText
        });
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      logger.error('Failed to fetch ML metrics', { error: err, message: errorMessage });
      setError('Failed to load metrics');
    } finally {
      setLoading(false);
    }
  }, [selectedMetric, selectedInterval]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  return {
    metrics,
    timeSeries,
    modelComparison,
    loading,
    error,
    refetch: fetchData
  };
}
