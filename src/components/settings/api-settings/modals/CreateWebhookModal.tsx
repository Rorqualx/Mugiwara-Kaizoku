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

import type { WebhookFormValues } from '../types';

interface CreateWebhookModalProps {
  opened: boolean;
  onClose: () => void;
  onSubmit: (values: WebhookFormValues) => void;
  webhookEvents: ReadonlyArray<{ value: string; label: string }>;
}

export function CreateWebhookModal({
  opened,
  onClose,
  onSubmit,
  webhookEvents,
}: CreateWebhookModalProps): React.ReactElement {
  const webhookForm = useForm<WebhookFormValues>({
    initialValues: {
      url: '',
      events: [],
      secret: '',
    },
    validate: {
      url: (value: string) => {
        if (!value.trim()) {
          return 'URL is required';
        }
        try {
          const url = new URL(value);
          if (url.protocol !== 'https:') {
            return 'Webhook URL must use HTTPS';
          }
        } catch {
          return 'Please enter a valid URL';
        }
        return null;
      },
      events: (value: string[]) => (value.length === 0 ? 'At least one event is required' : null),
    },
  });

  const handleSubmit = (values: WebhookFormValues): void => {
    onSubmit(values);
    webhookForm.reset();
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Create Webhook"
      size="md"
    >
      <form onSubmit={webhookForm.onSubmit(handleSubmit)}>
        <Stack gap="md">
          <TextInput
            label="Webhook URL"
            placeholder="https://example.com/webhook"
            description="HTTPS endpoint that will receive event notifications"
            required
            {...webhookForm.getInputProps('url')}
          />

          <MultiSelect
            label="Events"
            placeholder="Select events"
            description="Choose which events will trigger this webhook"
            data={webhookEvents}
            required
            {...webhookForm.getInputProps('events')}
          />

          <TextInput
            label="Secret"
            placeholder="Optional secret for HMAC validation"
            description="Used to sign webhook payloads for security"
            {...webhookForm.getInputProps('secret')}
          />

          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">
              Create Webhook
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}