/**
 * ML Metrics Detail Component
 *
 * Displays detailed metrics table and time series chart with configurable
 * metric type and time interval selection.
 *
 * This component has been decomposed to reduce cyclomatic complexity.
 */

import React from 'react';

import { Grid } from '@mantine/core';

import type { MLMetricsResponse, MLTimeSeriesPoint } from '@/types/ml/ml-api-types';
import type { MetricType, TimeInterval } from '@/types/ml/ml-dashboard-types';

import { TimeSeriesChart } from './charts/TimeSeriesChart';
import { MetricControls } from './sections/MetricControls';
import { MetricsTable } from './sections/MetricsTable';

interface MLMetricsDetailProps {
  metrics: MLMetricsResponse | null;
  timeSeries: MLTimeSeriesPoint[];
  selectedMetric: MetricType;
  selectedInterval: TimeInterval;
  onMetricChange: (metric: MetricType) => void;
  onIntervalChange: (interval: TimeInterval) => void;
  onRefresh: () => void;
}

/**
 * Renders detailed metrics view with configurable charts and tables
 */
export const MLMetricsDetail = ({
  metrics,
  timeSeries,
  selectedMetric,
  selectedInterval,
  onMetricChange,
  onIntervalChange,
  onRefresh
}: MLMetricsDetailProps): React.ReactElement => {
  return (
    <Grid>
      <Grid.Col span={12}>
        <MetricControls
          selectedMetric={selectedMetric}
          selectedInterval={selectedInterval}
          onMetricChange={onMetricChange}
          onIntervalChange={onIntervalChange}
          onRefresh={onRefresh}
        />

        <TimeSeriesChart timeSeries={timeSeries} selectedMetric={selectedMetric} />
      </Grid.Col>

      <Grid.Col span={12}>
        <MetricsTable metrics={metrics} />
      </Grid.Col>
    </Grid>
  );
};
