/**
 * Bulk Actions Component for Job History Page
 */
import React from 'react';

import { Group, Button, Menu, Text } from '@mantine/core';
import { IconTrash, IconChevronDown, IconCheck, IconX } from '@tabler/icons-react';

interface BulkActionsProps {
  selectedCount: number;
  completedCount: number;
  failedCount: number;
  onDeleteSelected: () => void;
  onDeleteCompleted: () => void;
  onDeleteFailed: () => void;
  isDeleting: boolean;
}

export function BulkActions({
  selectedCount,
  completedCount,
  failedCount,
  onDeleteSelected,
  onDeleteCompleted,
  onDeleteFailed,
  isDeleting
}: BulkActionsProps): React.ReactElement {
  return (
    <Group gap="sm">
      {selectedCount > 0 && (
        <Button
          size="xs"
          color="red"
          variant="light"
          leftSection={<IconTrash size={14} />}
          onClick={onDeleteSelected}
          loading={isDeleting}
        >
          Delete Selected ({selectedCount})
        </Button>
      )}

      <Menu shadow="md" width={200}>
        <Menu.Target>
          <Button
            size="xs"
            variant="light"
            rightSection={<IconChevronDown size={14} />}
            disabled={isDeleting}
          >
            Bulk Actions
          </Button>
        </Menu.Target>

        <Menu.Dropdown>
          <Menu.Label>Delete by Status</Menu.Label>
          <Menu.Item
            leftSection={<IconCheck size={14} />}
            color="green"
            onClick={onDeleteCompleted}
            disabled={completedCount === 0}
          >
            <Group gap="xs">
              <Text size="sm">Delete Completed</Text>
              {completedCount > 0 && (
                <Text size="xs" c="dimmed">({completedCount})</Text>
              )}
            </Group>
          </Menu.Item>
          <Menu.Item
            leftSection={<IconX size={14} />}
            color="red"
            onClick={onDeleteFailed}
            disabled={failedCount === 0}
          >
            <Group gap="xs">
              <Text size="sm">Delete Failed</Text>
              {failedCount > 0 && (
                <Text size="xs" c="dimmed">({failedCount})</Text>
              )}
            </Group>
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </Group>
  );
}
