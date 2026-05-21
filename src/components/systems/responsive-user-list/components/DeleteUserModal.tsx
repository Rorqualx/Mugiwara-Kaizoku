/**
 * Modal for confirming user deletion
 */
import React from 'react';

import { Modal, Stack, Text, Group, Button } from '@mantine/core';

import type { DeleteUserModalProps } from '../types';

/**
 * DeleteUserModal component
 *
 * @param props - Component props
 * @returns React element
 */
export function DeleteUserModal({
  opened,
  onClose,
  user,
  onConfirm,
  isMobile,
}: DeleteUserModalProps): React.ReactElement {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Delete User"
      size={isMobile ? 'full' : 'sm'}
    >
      <Stack gap="md">
        <Text>
          Are you sure you want to delete user <strong>{user?.username}</strong>
          ? This action cannot be undone.
        </Text>
        <Group justify="flex-end" gap="sm">
          <Button variant="light" onClick={onClose}>
            Cancel
          </Button>
          <Button
            color="red"
            onClick={() => {
              void onConfirm();
            }}
          >
            Delete User
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
