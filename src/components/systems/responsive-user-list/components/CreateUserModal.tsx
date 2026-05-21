/**
 * Modal for creating a new user
 */
import React from 'react';

import {
  Modal,
  TextInput,
  PasswordInput,
  Select,
  Stack,
  Group,
  Button,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { UserRole } from '@prisma/client';

import type { CreateUserModalProps, CreateUserInput } from '../types';

/**
 * CreateUserModal component
 *
 * @param props - Component props
 * @returns React element
 */
export function CreateUserModal({
  opened,
  onClose,
  onSubmit,
  isMobile,
}: CreateUserModalProps): React.ReactElement {
  const form = useForm({
    initialValues: {
      username: '',
      email: '',
      password: '',
      role: UserRole.USER as UserRole,
    },
    validate: {
      username: (value: string): string | null =>
        value.length < 3 ? 'Username must be at least 3 characters' : null,
      email: (value: string): string | null =>
        !/^\S+@\S+$/.test(value) ? 'Invalid email' : null,
      password: (value: string): string | null =>
        value.length < 6 ? 'Password must be at least 6 characters' : null,
    },
  });

  const handleSubmit = (values: typeof form.values): void => {
    onSubmit(values as CreateUserInput)
      .then(() => {
        form.reset();
        onClose();
      })
      .catch(() => {});
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Create New User"
      size={isMobile ? 'full' : 'md'}
    >
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          <TextInput
            label="Username"
            placeholder="Enter username"
            required
            {...form.getInputProps('username')}
          />
          <TextInput
            label="Email"
            placeholder="user@example.com"
            required
            {...form.getInputProps('email')}
          />
          <PasswordInput
            label="Password"
            placeholder="Enter password"
            required
            {...form.getInputProps('password')}
          />
          <Select
            label="Role"
            data={[
              { value: UserRole.USER, label: 'User' },
              { value: UserRole.ADMIN, label: 'Admin' },
            ]}
            {...form.getInputProps('role')}
          />
          <Group justify="flex-end" gap="sm">
            <Button variant="light" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">Create User</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
