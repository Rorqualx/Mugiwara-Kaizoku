/**
 * ML Metric Card Components
 *
 * Individual metric display cards for the ML dashboard.
 */

import React from 'react';

import { Card, Text, Group, RingProgress, Progress } from '@mantine/core';
import { IconClock } from '@tabler/icons-react';

import type { MLMetricsResponse } from '@/types/ml/ml-api-types';

interface MetricCardProps {
  metrics: MLMetricsResponse | null;
}

/**
 * Total Predictions metric card
 */
export const TotalPredictionsCard = ({ metrics }: MetricCardProps): React.ReactElement => (
  <Card shadow="sm" p="lg">
    <Text size="sm" c="dimmed" fw={500}>
      Total Predictions
    </Text>
    <Text size="xl" fw={700}>
      {metrics?.totalPredictions.toLocaleString() ?? 0}
    </Text>
  </Card>
);

/**
 * Average Confidence metric card with ring progress
 */
export const AvgConfidenceCard = ({ metrics }: MetricCardProps): React.ReactElement => {
  const confidenceValue = (metrics?.averageConfidence ?? 0) * 100;
  const color = (metrics?.averageConfidence ?? 0) > 0.7 ? 'green' : 'orange';

  return (
    <Card shadow="sm" p="lg">
      <Text size="sm" c="dimmed" fw={500}>
        Avg Confidence
      </Text>
      <Group gap="xs">
        <RingProgress
          size={60}
          thickness={6}
          sections={[{ value: confidenceValue, color }]}
        />
        <Text size="xl" fw={700}>
          {confidenceValue.toFixed(1)}%
        </Text>
      </Group>
    </Card>
  );
};

/**
 * Accuracy metric card with progress bar
 */
export const AccuracyCard = ({ metrics }: MetricCardProps): React.ReactElement => {
  const accuracyValue = (metrics?.accuracy ?? 0) * 100;
  const color = (metrics?.accuracy ?? 0) > 0.8 ? 'green' : 'orange';

  return (
    <Card shadow="sm" p="lg">
      <Text size="sm" c="dimmed" fw={500}>
        Accuracy
      </Text>
      <Group gap="xs">
        <Progress
          value={accuracyValue}
          color={color}
          size="xl"
          style={{ flex: 1 }}
        />
        <Text size="xl" fw={700}>
          {accuracyValue.toFixed(1)}%
        </Text>
      </Group>
    </Card>
  );
};

/**
 * Average Inference Time metric card
 */
export const InferenceTimeCard = ({ metrics }: MetricCardProps): React.ReactElement => (
  <Card shadow="sm" p="lg">
    <Text size="sm" c="dimmed" fw={500}>
      Avg Inference Time
    </Text>
    <Group gap="xs">
      <IconClock size={20} />
      <Text size="xl" fw={700}>
        {metrics?.averageInferenceTime.toFixed(1) ?? 0}ms
      </Text>
    </Group>
  </Card>
);
