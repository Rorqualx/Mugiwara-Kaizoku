/**
 * ML Chart Data Utilities
 *
 * Prepares chart data for ML metrics visualization.
 */

import type {
  MLMetricsResponse,
  MLTimeSeriesPoint,
  MLComparisonResponse
} from '@/types/ml/ml-api-types';

import type { ChartData } from 'chart.js';

/**
 * Prepares time series chart data for predictions over time
 */
export function prepareTimeSeriesChartData(
  timeSeries: MLTimeSeriesPoint[]
): ChartData<'line'> {
  return {
    labels: timeSeries.map(p => new Date(p.timestamp).toLocaleString()),
    datasets: [
      {
        label: 'Predictions Over Time',
        data: timeSeries.map(p => p.value),
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        tension: 0.1
      }
    ]
  };
}

/**
 * Prepares confidence distribution pie chart data
 */
export function prepareConfidenceChartData(
  metrics: MLMetricsResponse | null
): ChartData<'pie'> {
  return {
    labels: ['Low (<0.5)', 'Medium (0.5-0.8)', 'High (>0.8)'],
    datasets: [
      {
        data: metrics
          ? [
              metrics.confidenceDistribution.low,
              metrics.confidenceDistribution.medium,
              metrics.confidenceDistribution.high
            ]
          : [],
        backgroundColor: [
          'rgba(255, 99, 132, 0.5)',
          'rgba(255, 206, 86, 0.5)',
          'rgba(75, 192, 192, 0.5)'
        ],
        borderColor: [
          'rgba(255, 99, 132, 1)',
          'rgba(255, 206, 86, 1)',
          'rgba(75, 192, 192, 1)'
        ],
        borderWidth: 1
      }
    ]
  };
}

/**
 * Prepares model comparison bar chart data
 */
export function prepareModelComparisonChartData(
  modelComparison: MLComparisonResponse
): ChartData<'bar'> {
  return {
    labels: Object.keys(modelComparison),
    datasets: [
      {
        label: 'Total Predictions',
        data: Object.values(modelComparison).map(m => m.totalPredictions),
        backgroundColor: 'rgba(54, 162, 235, 0.5)'
      },
      {
        label: 'Avg Confidence',
        data: Object.values(modelComparison).map(m => m.averageConfidence * 100),
        backgroundColor: 'rgba(75, 192, 192, 0.5)'
      }
    ]
  };
}
