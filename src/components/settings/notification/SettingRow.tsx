/**
 * Setting Row Component
 *
 * Reusable row for displaying a setting with label, description, and control
 *
 * @module components/settings/notification/SettingRow
 */
import React from 'react';

import { Box, Group, Text } from '@mantine/core';

import classes from '../notification.module.css';

interface SettingRowProps {
  label: string;
  description: string;
  children: React.ReactNode;
}

/**
 * Reusable setting row with consistent styling
 *
 * @param props - Component props
 * @returns Rendered setting row
 */
export function SettingRow({ label, description, children }: SettingRowProps): React.ReactElement {
  return (
    <Group
      justify="apart"
      {...(classes['item'] !== undefined && { className: classes['item'] })}
      gap="xl"
      wrap="nowrap"
    >
      <Box>
        <Text fw={500}>{label}</Text>
        <Text size="xs" c="dimmed">
          {description}
        </Text>
      </Box>
      {children}
    </Group>
  );
}
