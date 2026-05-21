/**
 * Metric Controls Section
 *
 * Displays metric type selector, time interval selector, and refresh button.
 */

import React from 'react';

import { Group, Select, Button } from '@mantine/core';

import type { MetricType, TimeInterval } from '@/types/ml/ml-dashboard-types';
import { METRIC_OPTIONS, INTERVAL_OPTIONS } from '@/types/ml/ml-dashboard-types';

interface MetricControlsProps {
  selectedMetric: MetricType;
  selectedInterval: TimeInterval;
  onMetricChange: (metric: MetricType) => void;
  onIntervalChange: (interval: TimeInterval) => void;
  onRefresh: () => void;
}

/**
 * Renders the control section for metric selection and data refresh
 */
export function MetricControls({
  selectedMetric,
  selectedInterval,
  onMetricChange,
  onIntervalChange,
  onRefresh
}: MetricControlsProps): React.ReactElement {
  return (
    <Group mb="md">
      <Select
        label="Metric Type"
        value={selectedMetric}
        onChange={(value) => value && onMetricChange(value as MetricType)}
        data={METRIC_OPTIONS}
      />
      <Select
        label="Time Interval"
        value={selectedInterval}
        onChange={(value) => value && onIntervalChange(value as TimeInterval)}
        data={INTERVAL_OPTIONS}
      />
      <Button onClick={onRefresh} variant="outline">
        Update Chart
      </Button>
    </Group>
  );
}
