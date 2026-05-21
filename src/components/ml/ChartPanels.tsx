/**
 * ML Chart Panel Components
 *
 * Chart display panels for the ML dashboard.
 */

import React from 'react';

import { Text, Paper } from '@mantine/core';
import { Line, Pie, Bar } from 'react-chartjs-2';

import type { ChartData } from 'chart.js';

interface TimeSeriesChartPanelProps {
  data: ChartData<'line'>;
}

/**
 * Predictions over time line chart panel
 */
export const TimeSeriesChartPanel = ({ data }: TimeSeriesChartPanelProps): React.ReactElement => (
  <Paper shadow="sm" p="lg">
    <Text size="lg" fw={500} mb="md">
      Predictions Over Time
    </Text>
    <Line data={data} />
  </Paper>
);

interface ConfidenceChartPanelProps {
  data: ChartData<'pie'>;
}

/**
 * Confidence distribution pie chart panel
 */
export const ConfidenceChartPanel = ({ data }: ConfidenceChartPanelProps): React.ReactElement => (
  <Paper shadow="sm" p="lg">
    <Text size="lg" fw={500} mb="md">
      Confidence Distribution
    </Text>
    <Pie data={data} />
  </Paper>
);

interface ModelComparisonChartPanelProps {
  data: ChartData<'bar'>;
}

/**
 * Model comparison bar chart panel
 */
export const ModelComparisonChartPanel = ({ data }: ModelComparisonChartPanelProps): React.ReactElement => (
  <Paper shadow="sm" p="lg">
    <Text size="lg" fw={500} mb="md">
      Model Comparison
    </Text>
    <Bar data={data} />
  </Paper>
);
