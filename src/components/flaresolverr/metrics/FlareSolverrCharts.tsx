/**
 * FlareSolverr Charts
 *
 * Time-series visualization components for metrics: response time, uptime history, throughput
 *
 * @module components/flaresolverr/metrics/FlareSolverrCharts
 */

import React from 'react';

import { Card, Stack, Text, Center, Loader, Box } from '@mantine/core';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

import type { FlareSolverrHourlyMetrics } from '@/server/services/flaresolverr/types';

import {
  prepareResponseTimeFromHourly,
  prepareUptimeFromHourly,
  prepareThroughputFromHourly,
  buildResponseTimeChartData,
  buildUptimeChartData,
  buildThroughputChartData,
  getCommonChartOptions,
  getUptimeChartOptions,
  getThroughputChartOptions,
} from './chart-utils';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// ============================================================================
// Types
// ============================================================================

interface ChartProps {
  metrics: FlareSolverrHourlyMetrics[] | undefined;
  isLoading?: boolean;
  height?: number;
}

// ============================================================================
// Helper Components
// ============================================================================

function ChartSkeleton({ height = 250 }: { height?: number }): React.ReactElement {
  return (
    <Center h={height}>
      <Stack align="center" gap="xs">
        <Loader size="sm" />
        <Text size="sm" c="dimmed">Loading chart data...</Text>
      </Stack>
    </Center>
  );
}

function NoDataMessage({ height = 250 }: { height?: number }): React.ReactElement {
  return (
    <Center h={height}>
      <Text size="sm" c="dimmed">No metrics data available</Text>
    </Center>
  );
}

// ============================================================================
// Chart Components
// ============================================================================

/** Response time history line chart */
export function ResponseTimeChart({ metrics, isLoading, height = 250 }: ChartProps): React.ReactElement {
  if (isLoading) return <ChartSkeleton height={height} />;
  if (!metrics || metrics.length === 0) return <NoDataMessage height={height} />;

  const config = prepareResponseTimeFromHourly(metrics);
  const chartData = buildResponseTimeChartData(config);
  const options = getCommonChartOptions();

  return (
    <Card shadow="sm" p="md" radius="md" withBorder>
      <Text fw={500} mb="md">Response Time History</Text>
      <Box h={height}>
        <Line data={chartData} options={options} />
      </Box>
    </Card>
  );
}

/** Uptime history bar chart */
export function UptimeHistoryChart({ metrics, isLoading, height = 200 }: ChartProps): React.ReactElement {
  if (isLoading) return <ChartSkeleton height={height} />;
  if (!metrics || metrics.length === 0) return <NoDataMessage height={height} />;

  const config = prepareUptimeFromHourly(metrics);
  const chartData = buildUptimeChartData(config);
  const options = getUptimeChartOptions();

  return (
    <Card shadow="sm" p="md" radius="md" withBorder>
      <Text fw={500} mb="md">Uptime History (7 days)</Text>
      <Box h={height}>
        <Bar data={chartData} options={options} />
      </Box>
    </Card>
  );
}

/** Request throughput stacked bar chart */
export function RequestThroughputChart({ metrics, isLoading, height = 200 }: ChartProps): React.ReactElement {
  if (isLoading) return <ChartSkeleton height={height} />;
  if (!metrics || metrics.length === 0) return <NoDataMessage height={height} />;

  const config = prepareThroughputFromHourly(metrics);
  const chartData = buildThroughputChartData(config);
  const options = getThroughputChartOptions();

  return (
    <Card shadow="sm" p="md" radius="md" withBorder>
      <Text fw={500} mb="md">Request Throughput</Text>
      <Box h={height}>
        <Bar data={chartData} options={options} />
      </Box>
    </Card>
  );
}

export default {
  ResponseTimeChart,
  UptimeHistoryChart,
  RequestThroughputChart,
};
