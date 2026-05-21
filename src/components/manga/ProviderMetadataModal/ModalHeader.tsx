import React from 'react';

import {
  Group,
  Text,
  Button
} from '@mantine/core';
import { IconRefresh } from '@tabler/icons-react';

interface ModalHeaderProps {
  title?: string;
  currentTitle?: string;
  onRefetch: () => Promise<void> | void;
}

export function ModalHeader({ title, currentTitle, onRefetch }: ModalHeaderProps): React.ReactElement {
  return (
    <Group justify="space-between">
      <Text size="lg" fw={500}>{title ?? currentTitle}</Text>
      <Button
        size="xs"
        variant="subtle"
        leftSection={<IconRefresh size={16} />}
        onClick={() => { void onRefetch(); }}
      >
        Refresh
      </Button>
    </Group>
  );
}
