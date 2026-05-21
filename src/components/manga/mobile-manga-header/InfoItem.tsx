/**
 * InfoItem Component
 *
 * Displays a single metadata info item with icon, label, and value.
 *
 * Extracted from: MobileMangaHeader.tsx
 */

import React from 'react';

import { Box, Group, Text } from '@mantine/core';

import type { InfoItemProps } from './types';

/**
 * Info item component for displaying metadata
 */
export function InfoItem({
  icon,
  label,
  value,
  color = 'dimmed'
}: InfoItemProps): React.ReactElement {
  return (
    <Group gap="xs" wrap="nowrap">
      <Box c={color}>{icon}</Box>
      <Box style={{ flex: 1 }}>
        <Text size="xs" c="dimmed">{label}</Text>
        <Text size="sm" fw={500}>{value}</Text>
      </Box>
    </Group>
  );
}
