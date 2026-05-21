/**
 * Help Alert Component
 *
 * Displays information about path mapping configuration and provides
 * access to the network storage setup guide documentation.
 */

import React from 'react';

import { Alert, Stack, Text, Group, Anchor } from '@mantine/core';
import { IconInfoCircle, IconBook } from '@tabler/icons-react';

interface HelpAlertProps {
  onOpenDocumentation: () => void;
}

/**
 * Help Alert - Displays guidance and documentation link
 */
export function HelpAlert({ onOpenDocumentation }: HelpAlertProps): React.ReactElement {
  return (
    <Alert icon={<IconInfoCircle />} color="blue" variant="light">
      <Stack gap="xs">
        <Text size="sm" fw={500}>
          How does this work?
        </Text>
        <Text size="sm">
          Your download clients (Transmission, Deluge, etc.) save completed files to a folder.
          Tell the app where that folder is mounted on your system so it can find and import the files.
        </Text>
        <Text size="sm" c="dimmed" fs="italic">
          Example: If your NAS is mounted at <code>/mnt/public/data</code> and Transmission saves
          to the <code>completed</code> folder, enter <code>/mnt/public/data/completed</code>
        </Text>
        <Group gap="xs" mt="xs">
          <IconBook size={16} />
          <Anchor
            size="sm"
            onClick={onOpenDocumentation}
            style={{ cursor: 'pointer' }}
          >
            View Network Storage Setup Guide
          </Anchor>
        </Group>
      </Stack>
    </Alert>
  );
}

export type { HelpAlertProps };
