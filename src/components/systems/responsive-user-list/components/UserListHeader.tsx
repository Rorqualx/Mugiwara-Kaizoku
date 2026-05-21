/**
 * Header section for the user list
 */
import React from 'react';

import { Group, Text, Button } from '@mantine/core';
import { IconUserPlus } from '@tabler/icons-react';

interface UserListHeaderProps {
  userCount: number;
  onAddUser: () => void;
}

/**
 * UserListHeader component
 *
 * @param props - Component props
 * @returns React element
 */
export function UserListHeader({
  userCount,
  onAddUser,
}: UserListHeaderProps): React.ReactElement {
  return (
    <Group justify="space-between">
      <Text size="lg" fw={600}>
        Users ({userCount})
      </Text>
      <Button leftSection={<IconUserPlus size={16} />} onClick={onAddUser}>
        Add User
      </Button>
    </Group>
  );
}
