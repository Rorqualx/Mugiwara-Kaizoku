/**
 * Manual Path Input Component for File Browser
 *
 * Allows users to enter paths manually for quick navigation
 */

import React from 'react';

import { Group, TextInput, Button } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';

import { ManualPathInputProps } from './types';

/**
 * Manual Path Input Component
 */
export function ManualPathInput({
  manualPath,
  onManualPathChange,
  onManualPathSubmit
}: ManualPathInputProps): React.ReactElement {
  return (
    <Group gap="xs">
      <TextInput
        placeholder="Enter path manually (e.g., /mnt/nas)"
        value={manualPath}
        onChange={(e) => onManualPathChange(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            onManualPathSubmit();
          }
        }}
        style={{ flex: 1 }}
        leftSection={<IconSearch size={16} /> as React.ReactNode}
      />
      <Button onClick={onManualPathSubmit} variant="light">
        Go
      </Button>
    </Group>
  );
}