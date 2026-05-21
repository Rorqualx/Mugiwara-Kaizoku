/**
 * CoverSizeSelector component for poster view cover size selection
 */

import React from 'react';

import { Select } from '@mantine/core';
import { IconPhoto } from '@tabler/icons-react';

import type { CoverSize } from '@/store/index';

import type { CoverSizeSelectorProps } from '../types';

const COVER_SIZE_OPTIONS = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
] as const;

/**
 * Select dropdown for choosing cover size in poster view.
 */
export function CoverSizeSelector({
  coverSize,
  onCoverSizeChange,
}: CoverSizeSelectorProps): React.JSX.Element {
  return (
    <Select
      value={coverSize}
      onChange={(value) => onCoverSizeChange(value as CoverSize)}
      data={[...COVER_SIZE_OPTIONS]}
      size="sm"
      w={120}
      leftSection={<IconPhoto size={14} />}
      styles={{
        input: {
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          color: '#dddddd',
        },
        dropdown: {
          backgroundColor: '#303030',
        },
      }}
    />
  );
}
