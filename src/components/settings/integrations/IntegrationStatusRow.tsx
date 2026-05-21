import type { ReactElement } from 'react';

import { Group, Text, Badge } from '@mantine/core';

interface IntegrationStatusRowProps {
  label: string;
  value: string | ReactElement;
  valueColor?: string;
}

/**
 * Displays a status row with label and value/badge
 */
export function IntegrationStatusRow({
  label,
  value,
  valueColor
}: IntegrationStatusRowProps): ReactElement {
  return (
    <Group justify="space-between">
      <Text fw={500}>{label}</Text>
      {typeof value === 'string' ? (
        <Badge color={valueColor ?? 'blue'}>{value}</Badge>
      ) : (
        value
      )}
    </Group>
  );
}
