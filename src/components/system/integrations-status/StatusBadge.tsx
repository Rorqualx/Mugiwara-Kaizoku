/**
 * StatusBadge Component
 *
 * Reusable badge for displaying status indicators
 */
import React from 'react';

import { Badge } from '@mantine/core';

import { getStatusColor, getStatusText } from './utils';

import type { ConnectionStatus } from './types';

interface StatusBadgeProps {
  status: ConnectionStatus;
}

/**
 * Displays a connection status badge
 */
export function StatusBadge({ status }: StatusBadgeProps): React.ReactElement {
  return (
    <Badge color={getStatusColor(status)} size="lg">
      {getStatusText(status)}
    </Badge>
  );
}
