/**
 * Email Settings Component
 *
 * Settings panel for email notification configuration
 *
 * @module components/settings/notification/EmailSettings
 */
import React from 'react';

import {
  TextInput,
  NumberInput,
  Switch,
  MultiSelect,
  Button,
  Group,
  Stack,
  Text,
  Divider,
  Paper,
} from '@mantine/core';
import { UseFormReturnType } from '@mantine/form';
import { IconTestPipe } from '@tabler/icons-react';

import type { NotificationEventType } from '@prisma/client';

export interface EmailFormValues {
  enabled: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassword: string;
  fromAddress: string;
  toAddresses: string[];
  useTLS: boolean;
  events: NotificationEventType[];
}

interface EmailSettingsProps {
  form: UseFormReturnType<EmailFormValues>;
  onSubmit: (values: EmailFormValues) => void;
  onTest: () => void;
  isSubmitting: boolean;
  isTesting: boolean;
  eventOptions: ReadonlyArray<{ readonly value: string; readonly label: string }>;
}

/**
 * Email notification settings panel
 *
 * @param props - Component props
 * @returns Rendered email settings
 */
export function EmailSettings({
  form,
  onSubmit,
  onTest,
  isSubmitting,
  isTesting,
  eventOptions,
}: EmailSettingsProps): React.ReactElement {
  return (
    <Paper p="lg" withBorder>
      <form onSubmit={form.onSubmit(onSubmit)}>
        <Stack gap="md">
          <Group justify="space-between" align="center">
            <div>
              <Text fw={500}>Email Notifications</Text>
              <Text size="sm" c="dimmed">
                Send notifications via email
              </Text>
            </div>
            <Switch
              checked={form.values.enabled}
              onChange={(event) =>
                form.setFieldValue('enabled', event.currentTarget.checked)
              }
              label={form.values.enabled ? 'Enabled' : 'Disabled'}
              color="green"
              size="md"
            />
          </Group>

          <Divider />

          <Group grow>
            <TextInput
              label="SMTP Host"
              placeholder="smtp.gmail.com"
              required
              disabled={!form.values.enabled}
              {...form.getInputProps('smtpHost')}
            />

            <NumberInput
              label="SMTP Port"
              placeholder="587"
              required
              disabled={!form.values.enabled}
              {...form.getInputProps('smtpPort')}
            />
          </Group>

          <Group grow>
            <TextInput
              label="SMTP Username"
              placeholder="your@email.com"
              required
              disabled={!form.values.enabled}
              {...form.getInputProps('smtpUser')}
            />

            <TextInput
              label="SMTP Password"
              type="password"
              placeholder="••••••••"
              required
              disabled={!form.values.enabled}
              {...form.getInputProps('smtpPassword')}
            />
          </Group>

          <TextInput
            label="From Address"
            placeholder="noreply@mugiwara-kaizoku.com"
            required
            disabled={!form.values.enabled}
            {...form.getInputProps('fromAddress')}
          />

          <MultiSelect
            label="To Addresses"
            placeholder="Add email addresses"
            data={form.values.toAddresses}
            searchable
            disabled={!form.values.enabled}
            {...form.getInputProps('toAddresses')}
          />

          <Switch
            label="Use TLS/SSL"
            description="Enable secure connection (recommended)"
            disabled={!form.values.enabled}
            {...form.getInputProps('useTLS', { type: 'checkbox' })}
          />

          <MultiSelect
            label="Notification Events"
            placeholder="Select events to be notified about"
            data={eventOptions}
            disabled={!form.values.enabled}
            {...form.getInputProps('events')}
          />

          <Group justify="space-between" mt="lg">
            <Button
              variant="subtle"
              leftSection={<IconTestPipe />}
              onClick={onTest}
              disabled={!form.values.enabled}
              loading={isTesting}
            >
              Send Test Email
            </Button>

            <Button
              type="submit"
              loading={isSubmitting}
              disabled={!form.isDirty()}
            >
              Save Email Settings
            </Button>
          </Group>
        </Stack>
      </form>
    </Paper>
  );
}
