/**
 * Scan Status Component
 *
 * Displays current scanning status and progress information.
 *
 * Extracted from: FullFunctionalityLibraryManager.tsx (lines 118-141)
 *
 * @module components/library/library-manager/components/ScanStatus
 */

import { memo } from 'react';

import { Stack, Text, Progress, Alert } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';

import type { ScanStatusProps } from '../types';

/**
 * Displays the current scan status with progress indicator and error handling
 *
 * Shows:
 * - Animated indeterminate progress bar when scanning
 * - Status message with current scan progress
 * - Error alert if scan failed
 * - Idle message when not scanning
 */
export const ScanStatus = memo<ScanStatusProps>(({
  scanning,
  scanProgressStatus,
  error
}): JSX.Element => {
  return (
    <Stack gap="md">
      <Text fw={500}>Scan Status</Text>

      {error && (
        <Alert
          icon={<IconAlertCircle size={16} />}
          title="Scan Error"
          color="red"
        >
          {error}
        </Alert>
      )}

      {scanning ? (
        <Stack gap="xs">
          <Progress
            value={100}
            animated
            color="blue"
            size="lg"
            radius="xl"
          />
          <Text size="sm" c="dimmed" ta="center">
            {scanProgressStatus || 'Scanning library... This may take a while.'}
          </Text>
        </Stack>
      ) : (
        <Text size="sm" c="dimmed">Idle - Ready to scan</Text>
      )}
    </Stack>
  );
});

ScanStatus.displayName = 'ScanStatus';
