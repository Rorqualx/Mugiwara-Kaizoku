/**
 * Modal for updating a user's role
 */
import React from 'react';

import { Modal, Stack, Text, Select, Group, Button } from '@mantine/core';
import { UserRole } from '@prisma/client';

import type { UpdateRoleModalProps } from '../types';

/**
 * UpdateRoleModal component
 *
 * @param props - Component props
 * @returns React element
 */
export function UpdateRoleModal({
  opened,
  onClose,
  user,
  selectedRole,
  onRoleChange,
  onConfirm,
  isMobile,
}: UpdateRoleModalProps): React.ReactElement {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Update User Role"
      size={isMobile ? 'full' : 'sm'}
    >
      <Stack gap="md">
        <Text>
          Update role for <strong>{user?.username}</strong>
        </Text>
        <Select
          label="New Role"
          value={selectedRole}
          onChange={(value) => onRoleChange(value as UserRole)}
          data={[
            { value: UserRole.USER, label: 'User' },
            { value: UserRole.ADMIN, label: 'Admin' },
          ]}
        />
        <Group justify="flex-end" gap="sm">
          <Button variant="light" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              void onConfirm();
            }}
          >
            Update Role
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
