/**
 * Error Display Component for File Browser
 *
 * Displays error messages when directory browsing fails
 */

import React from 'react';

import { Alert, Text } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';

import { getErrorMessage } from '@/utils/type-guards';

import { ErrorDisplayProps } from './types';

/**
 * Error Display Component
 */
export function ErrorDisplay({ error }: ErrorDisplayProps): React.ReactElement {
  return (
    <Alert icon={<IconAlertCircle />} color="red" variant="light">
      <Text size="sm">
        Failed to browse directory: {getErrorMessage(error)}
      </Text>
    </Alert>
  );
}
