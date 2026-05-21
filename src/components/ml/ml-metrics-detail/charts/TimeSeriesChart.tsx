/**
 * Time Series Chart Component
 *
 * Displays a line chart for ML metrics over time.
 */

import React from 'react';

import { Paper } from '@mantine/core';
import { Line } from 'react-chartjs-2';

import type { MetricType } from '@/types/ml/ml-dashboard-types';

import type { ChartData } from 'chart.js';

interface TimeSeriesChartProps {
  timeSeries: Array<{ timestamp: string; value: number }>;
  selectedMetric: MetricType;
}

/**
 * Formats metric type into a human-readable label
 */
function formatMetricLabel(metric: MetricType): string {
  return metric.charAt(0).toUpperCase() + metric.slice(1).replace('_', ' ');
}

/**
 * Renders the time series line chart
 */
export function TimeSeriesChart({
  timeSeries,
  selectedMetric
}: TimeSeriesChartProps): React.ReactElement {
  const chartData: ChartData<'line'> = {
    labels: timeSeries.map(p => new Date(p.timestamp).toLocaleString()),
    datasets: [
      {
        label: formatMetricLabel(selectedMetric),
        data: timeSeries.map(p => p.value),
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        tension: 0.1
      }
    ]
  };

  return (
    <Paper shadow="sm" p="lg">
      <Line data={chartData} height={100} />
    </Paper>
  );
}
