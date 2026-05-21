import React from 'react';

import {
  Modal,
  Stack,
  TextInput,
  MultiSelect,
  Group,
  Button,
} from '@mantine/core';
import { useForm } from '@mantine/form';

import type { ApiKeyFormValues } from '../types';

interface CreateApiKeyModalProps {
  opened: boolean;
  onClose: () => void;
  onSubmit: (values: ApiKeyFormValues) => void;
  permissionResources: ReadonlyArray<{ value: string; label: string }>;
}

export function CreateApiKeyModal({
  opened,
  onClose,
  onSubmit,
  permissionResources,
}: CreateApiKeyModalProps): React.ReactElement {
  const apiKeyForm = useForm<ApiKeyFormValues>({
    initialValues: {
      name: '',
      permissions: [],
      expiresIn: '',
    },
    validate: {
      name: (value: string) => (!value.trim() ? 'Name is required' : null),
      permissions: (value: string[]) => (value.length === 0 ? 'At least one permission is required' : null),
    },
  });

  const handleSubmit = (values: ApiKeyFormValues): void => {
    onSubmit(values);
    apiKeyForm.reset();
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Create API Key"
      size="md"
    >
      <form onSubmit={apiKeyForm.onSubmit(handleSubmit)}>
        <Stack gap="md">
          <TextInput
            label="Name"
            placeholder="My Application"
            description="A friendly name to identify this API key"
            required
            {...apiKeyForm.getInputProps('name')}
          />

          <MultiSelect
            label="Permissions"
            placeholder="Select permissions"
            description="Choose what resources this API key can access"
            data={permissionResources}
            required
            {...apiKeyForm.getInputProps('permissions')}
          />

          <TextInput
            label="Expiration (days)"
            placeholder="0"
            description="Number of days until expiration (0 = never expires)"
            {...apiKeyForm.getInputProps('expiresIn')}
          />

          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">
              Create API Key
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}