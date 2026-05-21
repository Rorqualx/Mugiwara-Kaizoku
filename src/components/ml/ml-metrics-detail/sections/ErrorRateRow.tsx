/**
 * Error Rate Table Row
 *
 * Displays error rate metric with status badge.
 */

import React from 'react';

import { Badge } from '@mantine/core';

interface ErrorRateRowProps {
  errorRate: number;
}

/**
 * Determines the badge color based on error rate
 */
function getBadgeColor(rate: number): 'green' | 'red' {
  return rate < 0.05 ? 'green' : 'red';
}

/**
 * Determines the status text based on error rate
 */
function getStatusText(rate: number): string {
  return rate < 0.05 ? 'Good' : 'High';
}

/**
 * Renders the error rate table row
 */
export function ErrorRateRow({ errorRate }: ErrorRateRowProps): React.ReactElement {
  const percentage = (errorRate * 100).toFixed(1);
  const badgeColor = getBadgeColor(errorRate);
  const statusText = getStatusText(errorRate);

  return (
    <tr>
      <td>Error Rate</td>
      <td>{percentage}%</td>
      <td>
        <Badge color={badgeColor}>{statusText}</Badge>
      </td>
    </tr>
  );
}
