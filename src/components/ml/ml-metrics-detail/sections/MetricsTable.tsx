/**
 * Metrics Table Section
 *
 * Displays detailed metrics in a table format with cache hit rate,
 * error rate, and prediction time distribution.
 */

import React from 'react';

import { Paper, Text, Table } from '@mantine/core';

import type { MLMetricsResponse } from '@/types/ml/ml-api-types';

import { CacheHitRateRow } from './CacheHitRateRow';
import { ErrorRateRow } from './ErrorRateRow';
import { PredictionTimeRow } from './PredictionTimeRow';

interface MetricsTableProps {
  metrics: MLMetricsResponse | null;
}

/**
 * Renders the detailed metrics table with all metric rows
 */
export function MetricsTable({ metrics }: MetricsTableProps): React.ReactElement {
  const cacheHitRate = metrics?.cacheHitRate ?? 0;
  const errorRate = metrics?.errorRate ?? 0;
  const totalPredictions = metrics?.totalPredictions ?? 1;
  const fastCount = metrics?.timeDistribution.fast ?? 0;
  const normalCount = metrics?.timeDistribution.normal ?? 0;
  const slowCount = metrics?.timeDistribution.slow ?? 0;

  return (
    <Paper shadow="sm" p="lg">
      <Text size="lg" fw={500} mb="md">
        Detailed Metrics
      </Text>
      <Table>
        <thead>
          <tr>
            <th>Metric</th>
            <th>Value</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <CacheHitRateRow cacheHitRate={cacheHitRate} />
          <ErrorRateRow errorRate={errorRate} />
          <PredictionTimeRow
            label="Fast Predictions (<10ms)"
            count={fastCount}
            totalPredictions={totalPredictions}
            color="green"
          />
          <PredictionTimeRow
            label="Normal Predictions (10-50ms)"
            count={normalCount}
            totalPredictions={totalPredictions}
            color="yellow"
          />
          <PredictionTimeRow
            label="Slow Predictions (>50ms)"
            count={slowCount}
            totalPredictions={totalPredictions}
            color="red"
          />
        </tbody>
      </Table>
    </Paper>
  );
}
