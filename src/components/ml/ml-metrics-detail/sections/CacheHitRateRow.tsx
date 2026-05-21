/**
 * Cache Hit Rate Table Row
 *
 * Displays cache hit rate metric with status badge.
 */

import React from 'react';

import { Badge } from '@mantine/core';

interface CacheHitRateRowProps {
  cacheHitRate: number;
}

/**
 * Determines the badge color based on cache hit rate
 */
function getBadgeColor(rate: number): 'green' | 'orange' {
  return rate > 0.5 ? 'green' : 'orange';
}

/**
 * Determines the status text based on cache hit rate
 */
function getStatusText(rate: number): string {
  return rate > 0.5 ? 'Good' : 'Low';
}

/**
 * Renders the cache hit rate table row
 */
export function CacheHitRateRow({ cacheHitRate }: CacheHitRateRowProps): React.ReactElement {
  const percentage = (cacheHitRate * 100).toFixed(1);
  const badgeColor = getBadgeColor(cacheHitRate);
  const statusText = getStatusText(cacheHitRate);

  return (
    <tr>
      <td>Cache Hit Rate</td>
      <td>{percentage}%</td>
      <td>
        <Badge color={badgeColor}>{statusText}</Badge>
      </td>
    </tr>
  );
}
