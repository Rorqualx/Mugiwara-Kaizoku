/**
 * ConfirmationHeader Component
 *
 * Header section for the confirmation step with title and action buttons
 */
import React from 'react';

import { Paper, Group, Title, Text, Button } from '@mantine/core';
import { IconCheck } from '@tabler/icons-react';

interface ConfirmationHeaderProps {
  isLoading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmationHeader({
  isLoading,
  onCancel,
  onConfirm
}: ConfirmationHeaderProps): React.ReactElement {
  return (
    <Paper p="md" radius="md" withBorder>
      <Group justify="space-between">
        <div>
          <Title order={3}>Confirm Manga Selection</Title>
          <Text size="sm" c="dimmed" mt="xs">
            Review and confirm the manga details before adding to your library
          </Text>
        </div>
        <Group>
          <Button variant="subtle" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onConfirm} loading={isLoading} leftSection={<IconCheck size={16} />}>
            Confirm & Add
          </Button>
        </Group>
      </Group>
    </Paper>
  );
}
