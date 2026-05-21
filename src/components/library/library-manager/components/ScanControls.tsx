/**
 * Scan Controls Component
 *
 * Provides buttons for starting and stopping library scans.
 *
 * Extracted from: FullFunctionalityLibraryManager.tsx (lines 147-163)
 *
 * @module components/library/library-manager/components/ScanControls
 */

import { memo } from 'react';

import { Group, Button } from '@mantine/core';

import type { ScanControlsProps } from '../types';

/**
 * Scan control buttons for library operations
 *
 * Provides UI for initiating and stopping library scans with proper disabled states.
 */
export const ScanControls = memo<ScanControlsProps>(({
  onScan,
  onStopScan,
  disabled,
  scanning,
}: ScanControlsProps): JSX.Element => {
  return (
    <Group gap="sm">
      <Button
        onClick={() => {
          void onScan();
        }}
        disabled={disabled || scanning}
        loading={scanning}
      >
        {scanning ? 'Scanning...' : 'Start Scan'}
      </Button>

      <Button
        onClick={() => {
          void onStopScan();
        }}
        disabled={!scanning}
        color="red"
      >
        Stop Scan
      </Button>
    </Group>
  );
});

ScanControls.displayName = 'ScanControls';
