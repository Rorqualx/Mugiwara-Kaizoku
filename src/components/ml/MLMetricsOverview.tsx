/**
 * ML Metrics Overview Component
 *
 * Displays key metrics cards and overview charts for ML dashboard.
 * Shows total predictions, average confidence, accuracy, and inference time.
 */

import React from 'react';

import { Grid, Text } from '@mantine/core';

import type {
  MLMetricsResponse,
  MLTimeSeriesPoint,
  MLComparisonResponse
} from '@/types/ml/ml-api-types';

import {
  prepareTimeSeriesChartData,
  prepareConfidenceChartData,
  prepareModelComparisonChartData
} from './chart-data-utils';
import {
  TimeSeriesChartPanel,
  ConfidenceChartPanel,
  ModelComparisonChartPanel
} from './ChartPanels';
import {
  TotalPredictionsCard,
  AvgConfidenceCard,
  AccuracyCard,
  InferenceTimeCard
} from './MetricCards';

interface MLMetricsOverviewProps {
  metrics: MLMetricsResponse | null;
  timeSeries: MLTimeSeriesPoint[];
  modelComparison: MLComparisonResponse;
  loading: boolean;
}

/**
 * Renders the ML metrics overview panel with key statistics and charts
 */
export const MLMetricsOverview = ({
  metrics,
  timeSeries,
  modelComparison,
  loading
}: MLMetricsOverviewProps): React.ReactElement => {
  // Prepare chart data using utility functions
  const timeSeriesChartData = prepareTimeSeriesChartData(timeSeries);
  const confidenceChartData = prepareConfidenceChartData(metrics);
  const modelComparisonChartData = prepareModelComparisonChartData(modelComparison);

  if (loading) {
    return <Text>Loading metrics...</Text>;
  }

  return (
    <Grid>
      {/* Key Metrics Cards */}
      <Grid.Col span={3}>
        <TotalPredictionsCard metrics={metrics} />
      </Grid.Col>

      <Grid.Col span={3}>
        <AvgConfidenceCard metrics={metrics} />
      </Grid.Col>

      <Grid.Col span={3}>
        <AccuracyCard metrics={metrics} />
      </Grid.Col>

      <Grid.Col span={3}>
        <InferenceTimeCard metrics={metrics} />
      </Grid.Col>

      {/* Charts */}
      <Grid.Col span={6}>
        <TimeSeriesChartPanel data={timeSeriesChartData} />
      </Grid.Col>

      <Grid.Col span={6}>
        <ConfidenceChartPanel data={confidenceChartData} />
      </Grid.Col>

      <Grid.Col span={12}>
        <ModelComparisonChartPanel data={modelComparisonChartData} />
      </Grid.Col>
    </Grid>
  );
};
