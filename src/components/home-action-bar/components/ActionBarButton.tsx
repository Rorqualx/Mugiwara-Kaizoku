/**
 * ActionBarButton component for reusable action bar buttons
 */

import React from 'react';

import { Stack, ActionIcon, Text } from '@mantine/core';

import { ACTION_ICON_STYLES } from '../types';

import type { ActionBarButtonProps } from '../types';

/**
 * Reusable action bar button with icon and label
 */
export function ActionBarButton({
  icon,
  label,
  onClick,
  loading = false,
  disabled = false,
  title,
}: ActionBarButtonProps): React.JSX.Element {
  return (
    <Stack gap={2} align="center" style={{ width: '60px' }}>
      <ActionIcon
        variant="subtle"
        size="lg"
        title={title ?? label}
        loading={loading}
        disabled={disabled}
        onClick={onClick}
        styles={ACTION_ICON_STYLES}
      >
        {icon}
      </ActionIcon>
      <Text size="xs" c="dimmed" ta="center">
        {label}
      </Text>
    </Stack>
  );
}
