/**
 * ChecklistItemDisplay Component
 *
 * Displays a single checklist item with its status and details.
 */
import React from 'react';

import { List, Group, Box, Text, Badge } from '@mantine/core';
import { IconCheck, IconX, IconAlertCircle } from '@tabler/icons-react';

import { ChecklistItem } from '../checklist-items';

export interface ChecklistItemDisplayProps {
  /** The checklist item to display */
  item: ChecklistItem;
}

/**
 * Get status icon for checklist item
 */
function getStatusIcon(status?: string): React.ReactElement | null {
  switch (status) {
    case 'pass':
      return <IconCheck size={20} color="var(--mantine-color-green-6)" />;
    case 'fail':
      return <IconX size={20} color="var(--mantine-color-red-6)" />;
    case 'warning':
      return <IconAlertCircle size={20} color="var(--mantine-color-yellow-6)" />;
    default:
      return null;
  }
}

export function ChecklistItemDisplay({
  item,
}: ChecklistItemDisplayProps): React.ReactElement {
  return (
    <List.Item
      key={item.id}
      icon={getStatusIcon(item.status)}
      mb="sm"
    >
      <Group justify="space-between" wrap="nowrap">
        <Box>
          <Text fw={500}>{item.title}</Text>
          <Text size="xs" c="dimmed">
            {item.description}
          </Text>
          {item.details && (
            <Text size="xs" c="red" mt={4}>
              {item.details}
            </Text>
          )}
        </Box>

        {item.status === 'checking' && (
          <Badge color="blue" variant="light">
            Checking...
          </Badge>
        )}
      </Group>
    </List.Item>
  );
}