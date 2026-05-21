/**
 * Empty state component when no users exist
 */
import React from 'react';

import { Paper, Center, Stack, Text, Button } from '@mantine/core';
import { IconUser, IconUserPlus } from '@tabler/icons-react';

interface UserListEmptyProps {
  onAddUser: () => void;
}

/**
 * UserListEmpty component
 *
 * @param props - Component props
 * @returns React element
 */
export function UserListEmpty({
  onAddUser,
}: UserListEmptyProps): React.ReactElement {
  return (
    <Paper p="xl" withBorder>
      <Center>
        <Stack align="center" gap="md">
          <IconUser size={48} color="var(--mantine-color-gray-5)" />
          <Text c="dimmed">No users found</Text>
          <Button leftSection={<IconUserPlus size={16} />} onClick={onAddUser}>
            Add First User
          </Button>
        </Stack>
      </Center>
    </Paper>
  );
}
