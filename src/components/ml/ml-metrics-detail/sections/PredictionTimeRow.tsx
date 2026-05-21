/**
 * Prediction Time Distribution Row
 *
 * Displays prediction time metric with progress bar.
 */

import React from 'react';

import { Progress } from '@mantine/core';

interface PredictionTimeRowProps {
  label: string;
  count: number;
  totalPredictions: number;
  color: 'green' | 'yellow' | 'red';
}

/**
 * Calculates the percentage for progress bar
 */
function calculatePercentage(count: number, total: number): number {
  if (total === 0) return 0;
  return (count / total) * 100;
}

/**
 * Renders a prediction time distribution table row with progress bar
 */
export function PredictionTimeRow({
  label,
  count,
  totalPredictions,
  color
}: PredictionTimeRowProps): React.ReactElement {
  const percentage = calculatePercentage(count, totalPredictions);

  return (
    <tr>
      <td>{label}</td>
      <td>{count}</td>
      <td>
        <Progress value={percentage} color={color} />
      </td>
    </tr>
  );
}
